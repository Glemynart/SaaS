#!/usr/bin/env python3
"""Create and verify the private manifest carried inside an uploads archive."""

import argparse
import csv
import hashlib
import io
import os
import stat
import sys
import tarfile

META_DIRECTORY = ".dusema-backup-meta"
META_MANIFEST = f"{META_DIRECTORY}/manifest.tsv"


class ArchiveError(Exception):
    pass


def normalize_member_name(raw, allow_root=False, allow_meta=False):
    if not raw or raw.startswith("/") or "\\" in raw:
        raise ArchiveError
    parts = raw.split("/")
    if any(part == ".." for part in parts):
        raise ArchiveError
    normalized = [part for part in parts if part not in ("", ".")]
    if not normalized:
        if allow_root:
            return ""
        raise ArchiveError
    if normalized[0] == META_DIRECTORY and not allow_meta:
        raise ArchiveError
    return "/".join(normalized)


def rows_for_tree(root):
    root = os.path.realpath(root)
    root_info = os.lstat(root)
    if not stat.S_ISDIR(root_info.st_mode):
        raise ArchiveError
    root_device = root_info.st_dev
    rows = []

    def fail_walk(error):
        raise error

    for current, directories, files in os.walk(
        root, topdown=True, onerror=fail_walk, followlinks=False
    ):
        directories.sort()
        files.sort()
        if current == root:
            directories[:] = [name for name in directories if name != META_DIRECTORY]

        for name in directories:
            path = os.path.join(current, name)
            info = os.lstat(path)
            if not stat.S_ISDIR(info.st_mode) or info.st_dev != root_device:
                raise ArchiveError

        for name in files:
            path = os.path.join(current, name)
            before = os.lstat(path)
            if not stat.S_ISREG(before.st_mode) or before.st_dev != root_device:
                raise ArchiveError
            relative = os.path.relpath(path, root).replace(os.sep, "/")
            key = normalize_member_name(relative)
            if key == META_DIRECTORY or key.startswith(META_DIRECTORY + "/"):
                raise ArchiveError

            digest = hashlib.sha256()
            with open(path, "rb") as source:
                for chunk in iter(lambda: source.read(1024 * 1024), b""):
                    digest.update(chunk)
            after = os.lstat(path)
            if (
                before.st_dev != after.st_dev
                or before.st_ino != after.st_ino
                or before.st_size != after.st_size
                or before.st_mtime_ns != after.st_mtime_ns
            ):
                raise ArchiveError
            rows.append((digest.hexdigest(), str(after.st_size), key))

    rows.sort(key=lambda row: row[2])
    return rows


def encode_rows(rows):
    output = io.StringIO(newline="")
    writer = csv.writer(output, delimiter="\t", lineterminator="\n")
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


def parse_manifest(data):
    try:
        text = data.decode("utf-8")
        reader = csv.reader(io.StringIO(text, newline=""), delimiter="\t", strict=True)
        rows = []
        seen = set()
        for row in reader:
            if len(row) != 3:
                raise ArchiveError
            digest, size, raw_key = row
            if (
                len(digest) != 64
                or any(character not in "0123456789abcdef" for character in digest)
                or not size.isascii()
                or not size.isdigit()
            ):
                raise ArchiveError
            key = normalize_member_name(raw_key)
            if key != raw_key or key in seen:
                raise ArchiveError
            if key == META_DIRECTORY or key.startswith(META_DIRECTORY + "/"):
                raise ArchiveError
            seen.add(key)
            rows.append((digest, size, key))
        rows.sort(key=lambda row: row[2])
        return rows
    except (UnicodeDecodeError, csv.Error, ValueError):
        raise ArchiveError from None


def validate_archive(archive_path):
    try:
        with tarfile.open(archive_path, mode="r:") as archive:
            entries = {}
            files = {}
            for member in archive:
                name = normalize_member_name(
                    member.name, allow_root=True, allow_meta=True
                )
                if not name:
                    if not member.isdir():
                        raise ArchiveError
                    continue
                if name in entries or not (member.isdir() or member.isfile()):
                    raise ArchiveError
                entries[name] = "directory" if member.isdir() else "file"

                if name == META_DIRECTORY:
                    if not member.isdir():
                        raise ArchiveError
                elif name == META_MANIFEST:
                    if not member.isfile():
                        raise ArchiveError
                    files[name] = member
                elif name.startswith(META_DIRECTORY + "/"):
                    raise ArchiveError
                elif member.isfile():
                    files[name] = member

            if META_DIRECTORY in entries and entries[META_DIRECTORY] != "directory":
                raise ArchiveError
            manifest_member = files.get(META_MANIFEST)
            if manifest_member is None:
                raise ArchiveError

            for name in entries:
                parent = os.path.dirname(name)
                while parent:
                    if parent in entries and entries[parent] != "directory":
                        raise ArchiveError
                    parent = os.path.dirname(parent)

            manifest_stream = archive.extractfile(manifest_member)
            if manifest_stream is None:
                raise ArchiveError
            expected_rows = parse_manifest(manifest_stream.read())
            expected = {key: (digest, int(size)) for digest, size, key in expected_rows}

            archived_files = {
                name: member for name, member in files.items() if name != META_MANIFEST
            }
            if set(expected) != set(archived_files):
                raise ArchiveError
            for key, member in archived_files.items():
                stream = archive.extractfile(member)
                if stream is None:
                    raise ArchiveError
                digest = hashlib.sha256()
                size = 0
                with stream:
                    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                        digest.update(chunk)
                        size += len(chunk)
                if expected[key] != (digest.hexdigest(), size):
                    raise ArchiveError
            return expected_rows
    except (OSError, tarfile.TarError, EOFError, UnicodeError, ValueError):
        raise ArchiveError from None


def write_manifest(root, destination):
    payload = encode_rows(rows_for_tree(root))
    with open(destination, "xb") as output:
        output.write(payload)
    return payload


def compare_tree(root, manifest_path):
    with open(manifest_path, "rb") as source:
        expected = parse_manifest(source.read())
    actual = rows_for_tree(root)
    if actual != expected:
        raise ArchiveError
    return expected


def print_totals(rows):
    total_bytes = sum(int(size) for _, size, _ in rows)
    print(f"files={len(rows)} bytes={total_bytes}")


def main():
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    manifest = commands.add_parser("manifest")
    manifest.add_argument("root")
    manifest.add_argument("destination")
    validate = commands.add_parser("validate")
    validate.add_argument("archive")
    compare = commands.add_parser("compare")
    compare.add_argument("root")
    compare.add_argument("manifest")
    totals = commands.add_parser("totals")
    totals.add_argument("manifest")
    args = parser.parse_args()

    try:
        if args.command == "manifest":
            rows = rows_for_tree(args.root)
            with open(args.destination, "xb") as output:
                output.write(encode_rows(rows))
            print_totals(rows)
        elif args.command == "validate":
            print_totals(validate_archive(args.archive))
        elif args.command == "compare":
            print_totals(compare_tree(args.root, args.manifest))
        elif args.command == "totals":
            with open(args.manifest, "rb") as source:
                print_totals(parse_manifest(source.read()))
    except (ArchiveError, OSError):
        messages = {
            "manifest": "Uploads manifest could not be built from the source tree.",
            "validate": "Uploads archive failed structural validation.",
            "compare": "Restored files do not match the encrypted manifest.",
            "totals": "Uploads manifest is invalid.",
        }
        print(messages[args.command], file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
