#!/usr/bin/env python3
"""Unit tests for the coordinated backup set manifest contract."""

from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path


SCRIPT = Path(__file__).with_name("backup-set-manifest.py")
SPEC = importlib.util.spec_from_file_location("backup_set_manifest", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
manifest_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(manifest_module)

SET_ID = "20261029T120000Z-0123456789abcdef"
NAMESPACE = "stagingnamespace"
BUCKET = "dusema-staging-backups"
REGION = "sa-bogota-1"
PREFIX = "backup-sets"


class BackupSetManifestTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.postgres_file = self.root / "postgres.dump.gpg"
        self.uploads_file = self.root / "uploads.tar.gpg"
        self.postgres_file.write_bytes(b"synthetic postgres ciphertext")
        self.uploads_file.write_bytes(b"synthetic uploads ciphertext")
        self.postgres_metadata = self.root / "postgres.json"
        self.uploads_metadata = self.root / "uploads.json"
        for kind, artifact, output in (
            ("postgres", self.postgres_file, self.postgres_metadata),
            ("uploads", self.uploads_file, self.uploads_metadata),
        ):
            manifest_module.record_artifact(
                Namespace(
                    set_id=SET_ID,
                    prefix=PREFIX,
                    kind=kind,
                    artifact=str(artifact),
                    output=str(output),
                )
            )
        self.manifest_file = self.root / "manifest.json"
        self.create_manifest()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def create_manifest(self) -> None:
        manifest_module.create_manifest(
            Namespace(
                set_id=SET_ID,
                prefix=PREFIX,
                environment="staging",
                started_at="2026-10-29T12:00:00Z",
                completed_at="2026-10-29T12:05:00Z",
                application_revision="a" * 40,
                storage_provider="OCI-Object-Storage",
                namespace=NAMESPACE,
                bucket=BUCKET,
                region=REGION,
                postgres_metadata=str(self.postgres_metadata),
                uploads_metadata=str(self.uploads_metadata),
                output=str(self.manifest_file),
            )
        )

    def validate(self, manifest: dict | None = None) -> None:
        decoded = manifest or manifest_module.read_regular_json(self.manifest_file, "test manifest")
        manifest_module.validate_manifest(decoded, SET_ID, PREFIX, NAMESPACE, BUCKET, REGION)

    def test_records_ciphertext_and_creates_a_minimal_pair_manifest(self) -> None:
        manifest = manifest_module.read_regular_json(self.manifest_file, "test manifest")
        self.validate(manifest)
        self.assertEqual(set(manifest["artifacts"]), {"postgres", "uploads"})
        self.assertEqual(manifest["artifacts"]["postgres"]["key"], f"{PREFIX}/{SET_ID}/postgres.dump.gpg")
        self.assertEqual(manifest["artifacts"]["uploads"]["key"], f"{PREFIX}/{SET_ID}/uploads.tar.gpg")
        self.assertEqual(manifest["artifacts"]["postgres"]["bytes"], self.postgres_file.stat().st_size)

    def test_rejects_artifacts_that_do_not_match_the_recorded_ciphertext(self) -> None:
        self.uploads_file.write_bytes(b"different ciphertext")
        with self.assertRaisesRegex(manifest_module.ManifestError, "size does not match"):
            manifest_module.validate_command(
                Namespace(
                    manifest=str(self.manifest_file),
                    expected_id=SET_ID,
                    prefix=PREFIX,
                    namespace=NAMESPACE,
                    bucket=BUCKET,
                    region=REGION,
                    postgres_file=str(self.postgres_file),
                    uploads_file=str(self.uploads_file),
                )
            )

    def test_rejects_pair_from_another_set(self) -> None:
        manifest = manifest_module.read_regular_json(self.manifest_file, "test manifest")
        manifest["artifacts"]["uploads"]["key"] = "backup-sets/20261029T120001Z-fedcba9876543210/uploads.tar.gpg"
        with self.assertRaisesRegex(manifest_module.ManifestError, "object key"):
            self.validate(manifest)

    def test_rejects_production_bucket(self) -> None:
        with self.assertRaisesRegex(manifest_module.ManifestError, "staging object-storage bucket"):
            manifest_module.create_manifest(
                Namespace(
                    set_id=SET_ID,
                    prefix=PREFIX,
                    environment="staging",
                    started_at="2026-10-29T12:00:00Z",
                    completed_at="2026-10-29T12:05:00Z",
                    application_revision="a" * 40,
                    storage_provider="OCI-Object-Storage",
                    namespace=NAMESPACE,
                    bucket="dusema-backups-prod",
                    region=REGION,
                    postgres_metadata=str(self.postgres_metadata),
                    uploads_metadata=str(self.uploads_metadata),
                    output=str(self.root / "unsafe.json"),
                )
            )

    def test_rejects_duplicate_manifest_fields(self) -> None:
        duplicated = self.root / "duplicate.json"
        duplicated.write_text('{"schema_version":1,"schema_version":1}', encoding="utf-8")
        with self.assertRaisesRegex(manifest_module.ManifestError, "duplicate field"):
            manifest_module.read_regular_json(duplicated, "test manifest")


if __name__ == "__main__":
    unittest.main()
