#!/usr/bin/env python3
"""Create and validate the encrypted PostgreSQL/uploads recovery-set manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


SET_ID_RE = re.compile(r"^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{16}$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
REVISION_RE = re.compile(r"^[0-9a-f]{7,40}$")
SAFE_REFERENCE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$")
PREFIX_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$")
NAMESPACE_RE = re.compile(r"^[A-Za-z0-9-]{1,64}$")
BUCKET_RE = re.compile(r"^[A-Za-z0-9._-]{1,255}$")
REGION_RE = re.compile(r"^[A-Za-z0-9-]{1,64}$")
UTC_TIMESTAMP_RE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$")
MANIFEST_FIELDS = {
    "schema_version",
    "backup_set_id",
    "environment_reference",
    "capture_started_at_utc",
    "capture_completed_at_utc",
    "application_revision",
    "storage_provider",
    "object_store",
    "artifacts",
}
ARTIFACT_FIELDS = {"key", "bytes", "sha256"}
OBJECT_STORE_FIELDS = {"namespace", "bucket", "region", "prefix"}


class ManifestError(ValueError):
    """Raised when a manifest or component artifact record is invalid."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ManifestError(message)


def parse_utc(value: Any, label: str) -> datetime:
    require(isinstance(value, str) and UTC_TIMESTAMP_RE.fullmatch(value) is not None, f"{label} must use YYYY-MM-DDTHH:MM:SSZ")
    try:
        parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError as exc:
        raise ManifestError(f"{label} must use YYYY-MM-DDTHH:MM:SSZ") from exc
    return parsed


def validate_set_id(value: Any) -> str:
    require(isinstance(value, str) and SET_ID_RE.fullmatch(value) is not None, "backup set ID is invalid")
    return value


def validate_prefix(value: Any) -> str:
    require(isinstance(value, str) and PREFIX_RE.fullmatch(value) is not None, "object prefix is invalid")
    require(not value.endswith("/") and "//" not in value, "object prefix is invalid")
    require(".." not in value.split("/"), "object prefix contains a traversal segment")
    require(value == "backup-sets", "coordinated backups must use the backup-sets prefix")
    return value


def read_regular_json(path: str | Path, label: str, max_bytes: int = 1_048_576) -> dict[str, Any]:
    source = Path(path)
    try:
        metadata = source.lstat()
    except OSError as exc:
        raise ManifestError(f"{label} is unavailable") from exc
    require(stat.S_ISREG(metadata.st_mode), f"{label} must be a regular file, not a symbolic link")
    require(metadata.st_size <= max_bytes, f"{label} exceeds its size limit")

    def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            require(key not in result, f"{label} contains a duplicate field")
            result[key] = value
        return result

    try:
        decoded = json.loads(source.read_text(encoding="utf-8"), object_pairs_hook=unique_object)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ManifestError(f"{label} is not valid UTF-8 JSON") from exc
    require(isinstance(decoded, dict), f"{label} must contain a JSON object")
    return decoded


def digest_file(path: str | Path) -> tuple[int, str]:
    source = Path(path)
    try:
        metadata = source.lstat()
    except OSError as exc:
        raise ManifestError("encrypted artifact is unavailable") from exc
    require(stat.S_ISREG(metadata.st_mode), "encrypted artifact must be a regular file, not a symbolic link")
    digest = hashlib.sha256()
    with source.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return metadata.st_size, digest.hexdigest()


def expected_object_key(prefix: str, set_id: str, kind: str) -> str:
    suffix = "postgres.dump.gpg" if kind == "postgres" else "uploads.tar.gpg"
    return f"{prefix}/{set_id}/{suffix}"


def record_artifact(args: argparse.Namespace) -> None:
    set_id = validate_set_id(args.set_id)
    prefix = validate_prefix(args.prefix)
    require(args.kind in {"postgres", "uploads"}, "artifact kind is invalid")
    byte_count, digest = digest_file(args.artifact)
    require(byte_count > 0, "encrypted artifact is empty")
    record = {
        "backup_set_id": set_id,
        "artifact_type": args.kind,
        "key": expected_object_key(prefix, set_id, args.kind),
        "bytes": byte_count,
        "sha256": digest,
    }
    output = Path(args.output)
    try:
        descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except OSError as exc:
        raise ManifestError("artifact metadata destination must be a new file") from exc
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        json.dump(record, stream, ensure_ascii=True, separators=(",", ":"))
        stream.write("\n")


def read_artifact_record(path: str | Path, kind: str, set_id: str, prefix: str) -> dict[str, Any]:
    record = read_regular_json(path, f"{kind} artifact metadata", max_bytes=4096)
    require(set(record) == {"backup_set_id", "artifact_type", "key", "bytes", "sha256"}, "artifact metadata fields are invalid")
    require(record["backup_set_id"] == set_id, f"{kind} artifact belongs to another backup set")
    require(record["artifact_type"] == kind, f"artifact type is not {kind}")
    require(record["key"] == expected_object_key(prefix, set_id, kind), f"{kind} object key does not match the backup set")
    require(type(record["bytes"]) is int and record["bytes"] > 0, f"{kind} artifact size is invalid")
    require(isinstance(record["sha256"], str) and SHA256_RE.fullmatch(record["sha256"]) is not None, f"{kind} artifact SHA-256 is invalid")
    return {"key": record["key"], "bytes": record["bytes"], "sha256": record["sha256"]}


def create_manifest(args: argparse.Namespace) -> None:
    set_id = validate_set_id(args.set_id)
    prefix = validate_prefix(args.prefix)
    started = parse_utc(args.started_at, "capture start")
    completed = parse_utc(args.completed_at, "capture completion")
    require(started <= completed, "capture completion precedes its start")
    require(isinstance(args.application_revision, str) and REVISION_RE.fullmatch(args.application_revision) is not None, "application revision is invalid")
    require(isinstance(args.environment, str) and args.environment == "staging", "backup set environment must be staging")
    require(isinstance(args.storage_provider, str) and SAFE_REFERENCE_RE.fullmatch(args.storage_provider) is not None, "storage provider reference is invalid")
    require(NAMESPACE_RE.fullmatch(args.namespace) is not None, "object storage namespace is invalid")
    require(BUCKET_RE.fullmatch(args.bucket) is not None, "object storage bucket is invalid")
    require(args.bucket != "dusema-backups-prod" and "staging" in args.bucket.lower(), "coordinated sets require a staging object-storage bucket")
    require(REGION_RE.fullmatch(args.region) is not None, "object storage region is invalid")

    manifest = {
        "schema_version": 1,
        "backup_set_id": set_id,
        "environment_reference": args.environment,
        "capture_started_at_utc": args.started_at,
        "capture_completed_at_utc": args.completed_at,
        "application_revision": args.application_revision,
        "storage_provider": args.storage_provider,
        "object_store": {
            "namespace": args.namespace,
            "bucket": args.bucket,
            "region": args.region,
            "prefix": prefix,
        },
        "artifacts": {
            "postgres": read_artifact_record(args.postgres_metadata, "postgres", set_id, prefix),
            "uploads": read_artifact_record(args.uploads_metadata, "uploads", set_id, prefix),
        },
    }
    output = Path(args.output)
    try:
        descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except OSError as exc:
        raise ManifestError("manifest destination must be a new file") from exc
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        json.dump(manifest, stream, ensure_ascii=True, indent=2)
        stream.write("\n")


def validate_manifest(
    manifest: dict[str, Any],
    expected_id: str,
    expected_prefix: str,
    expected_namespace: str,
    expected_bucket: str,
    expected_region: str,
) -> dict[str, Any]:
    require(set(manifest) == MANIFEST_FIELDS, "manifest fields are invalid")
    require(manifest["schema_version"] == 1 and type(manifest["schema_version"]) is int, "manifest version is unsupported")
    set_id = validate_set_id(manifest["backup_set_id"])
    require(set_id == validate_set_id(expected_id), "manifest belongs to another backup set")
    require(manifest["environment_reference"] == "staging", "manifest is not a staging recovery set")
    started = parse_utc(manifest["capture_started_at_utc"], "capture start")
    completed = parse_utc(manifest["capture_completed_at_utc"], "capture completion")
    require(started <= completed, "capture completion precedes its start")
    require(isinstance(manifest["application_revision"], str) and REVISION_RE.fullmatch(manifest["application_revision"]) is not None, "application revision is invalid")
    require(isinstance(manifest["storage_provider"], str) and SAFE_REFERENCE_RE.fullmatch(manifest["storage_provider"]) is not None, "storage provider reference is invalid")

    prefix = validate_prefix(manifest["object_store"].get("prefix") if isinstance(manifest["object_store"], dict) else None)
    require(prefix == validate_prefix(expected_prefix), "manifest object prefix does not match")
    store = manifest["object_store"]
    require(set(store) == OBJECT_STORE_FIELDS, "manifest object-store fields are invalid")
    require(store["namespace"] == expected_namespace and NAMESPACE_RE.fullmatch(store["namespace"]) is not None, "manifest object-store namespace does not match")
    require(store["bucket"] == expected_bucket and BUCKET_RE.fullmatch(store["bucket"]) is not None, "manifest object-store bucket does not match")
    require(store["bucket"] != "dusema-backups-prod" and "staging" in store["bucket"].lower(), "coordinated sets require a staging object-storage bucket")
    require(store["region"] == expected_region and REGION_RE.fullmatch(store["region"]) is not None, "manifest object-store region does not match")

    artifacts = manifest["artifacts"]
    require(isinstance(artifacts, dict) and set(artifacts) == {"postgres", "uploads"}, "manifest must reference PostgreSQL and uploads")
    for kind in ("postgres", "uploads"):
        artifact = artifacts[kind]
        require(isinstance(artifact, dict) and set(artifact) == ARTIFACT_FIELDS, f"{kind} artifact fields are invalid")
        require(artifact["key"] == expected_object_key(prefix, set_id, kind), f"{kind} object key does not match the backup set")
        require(type(artifact["bytes"]) is int and artifact["bytes"] > 0, f"{kind} artifact size is invalid")
        require(isinstance(artifact["sha256"], str) and SHA256_RE.fullmatch(artifact["sha256"]) is not None, f"{kind} artifact SHA-256 is invalid")
    return manifest


def validate_command(args: argparse.Namespace) -> None:
    manifest = read_regular_json(args.manifest, "backup set manifest")
    validate_manifest(manifest, args.expected_id, args.prefix, args.namespace, args.bucket, args.region)
    for kind, path in (("postgres", args.postgres_file), ("uploads", args.uploads_file)):
        byte_count, digest = digest_file(path)
        expected = manifest["artifacts"][kind]
        require(byte_count == expected["bytes"], f"{kind} ciphertext size does not match the manifest")
        require(digest == expected["sha256"], f"{kind} ciphertext SHA-256 does not match the manifest")


def artifact_field(args: argparse.Namespace) -> None:
    manifest = read_regular_json(args.manifest, "backup set manifest")
    kind = args.kind
    require(kind in {"postgres", "uploads"}, "artifact kind is invalid")
    require(isinstance(manifest.get("artifacts"), dict), "manifest artifacts are invalid")
    artifact = manifest["artifacts"].get(kind)
    require(isinstance(artifact, dict), f"{kind} artifact is missing")
    require(args.field in ARTIFACT_FIELDS and args.field in artifact, "artifact field is invalid")
    print(artifact[args.field])


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    record = subparsers.add_parser("record-artifact")
    record.add_argument("--set-id", required=True)
    record.add_argument("--prefix", required=True)
    record.add_argument("--kind", choices=("postgres", "uploads"), required=True)
    record.add_argument("--artifact", required=True)
    record.add_argument("--output", required=True)
    record.set_defaults(run=record_artifact)

    create = subparsers.add_parser("create")
    create.add_argument("--set-id", required=True)
    create.add_argument("--prefix", required=True)
    create.add_argument("--environment", required=True)
    create.add_argument("--started-at", required=True)
    create.add_argument("--completed-at", required=True)
    create.add_argument("--application-revision", required=True)
    create.add_argument("--storage-provider", required=True)
    create.add_argument("--namespace", required=True)
    create.add_argument("--bucket", required=True)
    create.add_argument("--region", required=True)
    create.add_argument("--postgres-metadata", required=True)
    create.add_argument("--uploads-metadata", required=True)
    create.add_argument("--output", required=True)
    create.set_defaults(run=create_manifest)

    validate = subparsers.add_parser("validate")
    validate.add_argument("--manifest", required=True)
    validate.add_argument("--expected-id", required=True)
    validate.add_argument("--prefix", required=True)
    validate.add_argument("--namespace", required=True)
    validate.add_argument("--bucket", required=True)
    validate.add_argument("--region", required=True)
    validate.add_argument("--postgres-file", required=True)
    validate.add_argument("--uploads-file", required=True)
    validate.set_defaults(run=validate_command)

    field = subparsers.add_parser("artifact-field")
    field.add_argument("--manifest", required=True)
    field.add_argument("--kind", choices=("postgres", "uploads"), required=True)
    field.add_argument("--field", choices=tuple(sorted(ARTIFACT_FIELDS)), required=True)
    field.set_defaults(run=artifact_field)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        args.run(args)
    except ManifestError as exc:
        print(f"backup-set-manifest: ERROR: {exc}", file=sys.stderr)
        return 1
    except OSError:
        print("backup-set-manifest: ERROR: file operation failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
