#!/usr/bin/env python3
"""Exercise the coordinated backup and restore orchestrators with local mocks."""

from __future__ import annotations

import os
import hashlib
import shlex
import shutil
import subprocess
import sys
import tempfile
import re
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
BACKUP_SET = SCRIPT_DIR / "backup-set.sh"
RESTORE_SET = SCRIPT_DIR / "restore-backup-set.sh"
MANIFEST_HELPER = SCRIPT_DIR / "backup-set-manifest.py"
FINGERPRINT = "409E5155F39E0A78AABBCCDDEEFF001122334455"


def bash_executable() -> str:
    if os.name == "nt":
        candidates = (
            Path(os.environ.get("CODEX_GIT_BASH", r"C:\Program Files\Git\bin\bash.exe")),
            Path(r"C:\Program Files\Git\usr\bin\bash.exe"),
        )
        for candidate in candidates:
            if candidate.is_file():
                return str(candidate)
    return shutil.which("bash") or "bash"


BASH = bash_executable()


def shell_path(path: Path | str) -> str:
    value = str(path)
    if os.name != "nt":
        return value
    git_root = Path(BASH).parent.parent
    cygpath = git_root / "usr" / "bin" / "cygpath.exe"
    return subprocess.check_output([str(cygpath), "-u", value], text=True).strip()


def fail(message: str) -> None:
    raise SystemExit(f"FAIL: {message}")


def write_executable(path: Path, source: str) -> None:
    path.write_text(source, encoding="utf-8")
    path.chmod(0o700)


def build_mocks(bin_dir: Path) -> None:
    write_executable(
        bin_dir / "python3",
        f"#!/usr/bin/env bash\nexec {shlex.quote(shell_path(sys.executable))} \"$@\"\n",
    )
    write_executable(
        bin_dir / "docker",
        """#!/usr/bin/env python3
import os, sys
if sys.argv[1:2] == ["inspect"]:
    print("staging")
    raise SystemExit(0)
if sys.argv[-1:] == ["--version"]:
    print("pg_dump (PostgreSQL) 17.10")
    raise SystemExit(0)
if "pg_dump" not in sys.argv:
    raise SystemExit(90)
with open(os.path.join(os.environ["MOCK_CALLS"], "docker"), "a", encoding="utf-8") as stream:
    stream.write("pg_dump\\n")
if os.environ.get("MOCK_PG_DUMP_FAIL") == "1":
    raise SystemExit(21)
sys.stdout.buffer.write(b"synthetic postgres dump\\n")
""",
    )
    write_executable(
        bin_dir / "gpg",
        """#!/usr/bin/env python3
import os, shutil, sys
args = sys.argv[1:]
if "--list-keys" in args:
    print("fpr:::::::::" + os.environ["MOCK_FINGERPRINT"] + ":")
    raise SystemExit(0)
output = args[args.index("--output") + 1]
if "--encrypt" in args:
    if os.environ.get("MOCK_GPG_FAIL_ON") and output.endswith(os.environ["MOCK_GPG_FAIL_ON"]):
        raise SystemExit(32)
    candidate = args[-1]
    if candidate != "--encrypt" and os.path.isfile(candidate):
        shutil.copyfile(candidate, output)
    else:
        with open(output, "wb") as stream:
            stream.write(sys.stdin.buffer.read())
elif "--decrypt" in args:
    shutil.copyfile(args[args.index("--decrypt") + 1], output)
else:
    raise SystemExit(91)
""",
    )
    write_executable(
        bin_dir / "oci",
        """#!/usr/bin/env python3
import os, shutil, sys
args = sys.argv[1:]
if args[:3] != ["os", "object", "put"]:
    raise SystemExit(94)
def value(flag):
    return args[args.index(flag) + 1]
name = value("--name")
file = value("--file")
if value("--bucket-name") != "dusema-staging-backups" or value("--profile") != "staging":
    raise SystemExit(95)
if "--verify-checksum" not in args or "--no-overwrite" not in args or not os.path.getsize(file):
    raise SystemExit(96)
with open(os.path.join(os.environ["MOCK_CALLS"], "oci"), "a", encoding="utf-8") as stream:
    stream.write(name + "\\n")
if os.environ.get("MOCK_OCI_FAIL_OBJECT") and name.endswith(os.environ["MOCK_OCI_FAIL_OBJECT"]):
    raise SystemExit(52)
destination = os.path.join(os.environ["MOCK_REMOTE"], name)
os.makedirs(os.path.dirname(destination), exist_ok=True)
shutil.copyfile(file, destination)
""",
    )


def env_for(root: Path, bin_dir: Path, remote: Path, calls: Path) -> dict[str, str]:
    env = os.environ.copy()
    env.update(
        {
            "PATH": f"{shell_path(bin_dir)}:/usr/bin:/bin" if os.name == "nt" else f"{bin_dir}{os.pathsep}{env['PATH']}",
            "MOCK_BIN_POSIX": shell_path(bin_dir),
            "MOCK_CALLS": str(calls),
            "MOCK_REMOTE": str(remote),
            "MOCK_FINGERPRINT": FINGERPRINT,
            "BACKUP_SET_ENVIRONMENT": "staging",
            "BACKUP_SET_ISOLATED_CONFIRMED": "true",
            "UPLOADS_QUIESCED": "true",
            "BACKUP_SET_APPLICATION_REVISION": "a" * 40,
            "BACKUP_SET_STORAGE_PROVIDER": "OCI-Object-Storage",
            "BACKUP_SET_PG_CONTAINER": "staging-postgres",
            "BACKUP_SET_PG_DATABASE": "staging_db",
            "BACKUP_SET_PG_ROLE": "staging_role",
            "UPLOADS_ROOT": shell_path(root / "uploads"),
            "TMP_PARENT": shell_path(root / "tmp"),
            "BACKUP_SET_WORK_PARENT": shell_path(root / "tmp"),
            "GNUPGHOME": shell_path(root / "gnupg"),
            "RECOVERY_RECIPIENT_FINGERPRINT": FINGERPRINT,
            "OCI_NAMESPACE": "stagingnamespace",
            "OCI_BUCKET": "dusema-staging-backups",
            "OCI_REGION": "sa-bogota-1",
            "OCI_OBJECT_PREFIX": "backup-sets",
            "OCI_UPLOAD_PROFILE": "staging",
            "OCI_CLI": "oci",
            "MOCK_OCI_FAIL_OBJECT": "",
            "MOCK_PG_DUMP_FAIL": "0",
            "MOCK_GPG_FAIL_ON": "",
        }
    )
    return env


def run_backup(env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [BASH, "-c", 'export PATH="$MOCK_BIN_POSIX:/usr/bin:/bin"; exec "$1"', "backup-set-test", str(BACKUP_SET)],
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )


def test_backup(root: Path, bin_dir: Path, remote: Path, calls: Path) -> str:
    env = env_for(root, bin_dir, remote, calls)
    result = run_backup(env)
    match = re.search(r"backup_set_id=([0-9]{8}T[0-9]{6}Z-[0-9a-f]{16})", result.stdout)
    if result.returncode != 0 or match is None:
        fail(f"coordinated backup failed: {result.returncode}; {result.stdout}; {result.stderr}")
    set_id = match.group(1)
    expected = [
        f"backup-sets/{set_id}/postgres.dump.gpg",
        f"backup-sets/{set_id}/uploads.tar.gpg",
        f"backup-sets/{set_id}/manifest.json.gpg",
    ]
    actual = (calls / "oci").read_text(encoding="utf-8").splitlines()
    if actual != expected:
        fail("artifacts were not uploaded before the final manifest marker")

    set_dir = remote / "backup-sets" / set_id
    manifest_ciphertext = (set_dir / "manifest.json.gpg").read_bytes()
    manifest_digest = hashlib.sha256(manifest_ciphertext).hexdigest()
    if f"manifest_sha256={manifest_digest} manifest_bytes={len(manifest_ciphertext)}" not in result.stdout:
        fail("completion log did not record the manifest ciphertext digest and size")
    subprocess.run(
        [
            sys.executable,
            str(MANIFEST_HELPER),
            "validate",
            "--manifest",
            str(set_dir / "manifest.json.gpg"),
            "--expected-id",
            set_id,
            "--prefix",
            "backup-sets",
            "--namespace",
            "stagingnamespace",
            "--bucket",
            "dusema-staging-backups",
            "--region",
            "sa-bogota-1",
            "--postgres-file",
            str(set_dir / "postgres.dump.gpg"),
            "--uploads-file",
            str(set_dir / "uploads.tar.gpg"),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    if any((root / "tmp").iterdir()):
        fail("coordinator left a private temporary workspace behind")
    print("PASS: both artifacts and the encrypted completion marker use one immutable backup set")
    return set_id


def test_failed_component_has_no_marker(root: Path, bin_dir: Path, remote: Path, calls: Path) -> None:
    env = env_for(root, bin_dir, remote, calls)
    env["MOCK_OCI_FAIL_OBJECT"] = "uploads.tar.gpg"
    before = len((calls / "oci").read_text(encoding="utf-8").splitlines())
    result = run_backup(env)
    if result.returncode != 22 or "no completion marker was published" not in result.stdout:
        fail(f"uploads failure did not fail the set safely: {result.returncode}; {result.stdout}")
    after_names = (calls / "oci").read_text(encoding="utf-8").splitlines()[before:]
    if not after_names:
        fail("failed backup set did not attempt its PostgreSQL artifact")
    set_id = after_names[0].split("/")[1]
    if after_names != [
        f"backup-sets/{set_id}/postgres.dump.gpg",
        f"backup-sets/{set_id}/uploads.tar.gpg",
    ]:
        fail("manifest upload was attempted after an uploads artifact failure")
    if (remote / "backup-sets" / set_id / "manifest.json.gpg").exists():
        fail("failed set published a completion marker")
    print("PASS: a failed component leaves no completion marker")


def test_safety_gates(root: Path, bin_dir: Path, remote: Path, calls: Path) -> None:
    before = len((calls / "oci").read_text(encoding="utf-8").splitlines())
    env = env_for(root, bin_dir, remote, calls)
    env["BACKUP_SET_ISOLATED_CONFIRMED"] = "false"
    result = run_backup(env)
    if result.returncode != 64 or "require isolated staging" not in result.stdout:
        fail("coordinator did not refuse unconfirmed isolation")
    env = env_for(root, bin_dir, remote, calls)
    env["OCI_BUCKET"] = "dusema-backups-prod"
    result = run_backup(env)
    if result.returncode != 64 or "production backup bucket" not in result.stdout:
        fail("coordinator did not reject the known production bucket")
    after = len((calls / "oci").read_text(encoding="utf-8").splitlines())
    if before != after:
        fail("safety gates made external calls before rejecting the configuration")
    print("PASS: isolation and production-bucket gates reject before any upload")


def test_restore_wrapper(root: Path, bin_dir: Path, remote: Path, calls: Path, set_id: str) -> None:
    set_dir = remote / "backup-sets" / set_id
    restore_dir = root / "restore-scripts"
    restore_dir.mkdir()
    shutil.copy2(RESTORE_SET, restore_dir / "restore-backup-set.sh")
    shutil.copy2(MANIFEST_HELPER, restore_dir / "backup-set-manifest.py")
    stub = """#!/usr/bin/env bash
set -Eeuo pipefail
kind=postgres
[[ "${0##*/}" == "restore-uploads-artifact.sh" ]] && kind=uploads
printf '%s:%s\\n' "$kind" "$EXPECTED_CIPHERTEXT_SHA256" >>"$MOCK_RESTORE_CALLS"
"""
    for kind in ("postgres", "uploads"):
        script = restore_dir / ("restore-postgres-backup.sh" if kind == "postgres" else "restore-uploads-artifact.sh")
        script.write_text(stub, encoding="utf-8")
    manifest_digest = hashlib.sha256((set_dir / "manifest.json.gpg").read_bytes()).hexdigest()
    restore_calls = calls / "restore"
    env = os.environ.copy()
    env.update(
        {
            "PATH": f"{shell_path(bin_dir)}:/usr/bin:/bin" if os.name == "nt" else f"{bin_dir}{os.pathsep}{env['PATH']}",
            "MOCK_BIN_POSIX": shell_path(bin_dir),
            "MOCK_FINGERPRINT": FINGERPRINT,
            "MOCK_RESTORE_CALLS": shell_path(restore_calls),
            "BACKUP_SET_ID": set_id,
            "ENCRYPTED_MANIFEST_FILE": shell_path(set_dir / "manifest.json.gpg"),
            "EXPECTED_MANIFEST_CIPHERTEXT_SHA256": manifest_digest,
            "ENCRYPTED_POSTGRES_FILE": shell_path(set_dir / "postgres.dump.gpg"),
            "ENCRYPTED_UPLOADS_FILE": shell_path(set_dir / "uploads.tar.gpg"),
            "RECOVERY_GNUPGHOME": shell_path(root / "gnupg"),
            "RESTORE_SET_NAMESPACE": "stagingnamespace",
            "RESTORE_SET_BUCKET": "dusema-staging-backups",
            "RESTORE_SET_REGION": "sa-bogota-1",
            "RESTORE_CONTAINER_ID": "abcdef012345",
            "RESTORE_DATABASE": "dusema_recovery_roundtrip",
            "RESTORE_TMP_ROOT": shell_path(root / "restore-tmp"),
            "RESTORE_PARENT": shell_path(root / "restore-parent"),
            "RESTORE_DIR_NAME": "dusema-uploads-restored-roundtrip",
            "RESTORE_WORK_PARENT": shell_path(root / "restore-work"),
        }
    )
    result = subprocess.run(
        [BASH, "-c", 'export PATH="$MOCK_BIN_POSIX:/usr/bin:/bin"; exec "$1"', "backup-set-test", str(restore_dir / "restore-backup-set.sh")],
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0 or "both artifacts restored in isolated targets" not in result.stdout:
        fail(f"restore orchestrator rejected a valid set: {result.returncode}; {result.stdout}; {result.stderr}")
    calls_seen = restore_calls.read_text(encoding="utf-8").splitlines()
    postgres_sha = subprocess.check_output(
        [sys.executable, str(MANIFEST_HELPER), "artifact-field", "--manifest", str(set_dir / "manifest.json.gpg"), "--kind", "postgres", "--field", "sha256"],
        text=True,
    ).strip()
    uploads_sha = subprocess.check_output(
        [sys.executable, str(MANIFEST_HELPER), "artifact-field", "--manifest", str(set_dir / "manifest.json.gpg"), "--kind", "uploads", "--field", "sha256"],
        text=True,
    ).strip()
    if calls_seen != [f"postgres:{postgres_sha}", f"uploads:{uploads_sha}"]:
        fail("restore orchestrator did not pass each manifest digest to its isolated restore tool")
    print("PASS: restore wrapper validates the full set before restoring either artifact")


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="dusema-backup-set-test-") as temporary:
        root = Path(temporary)
        bin_dir = root / "bin"
        remote = root / "remote"
        calls = root / "calls"
        for path in (
            bin_dir,
            remote,
            calls,
            root / "tmp",
            root / "gnupg",
            root / "uploads",
            root / "restore-parent",
            root / "restore-work",
            root / "restore-tmp",
        ):
            path.mkdir()
        for path in (root / "tmp", root / "gnupg", root / "restore-parent", root / "restore-work", root / "restore-tmp"):
            path.chmod(0o700)
        (root / "uploads" / "example.txt").write_text("synthetic upload content\n", encoding="utf-8")
        (calls / "oci").touch()
        build_mocks(bin_dir)
        set_id = test_backup(root, bin_dir, remote, calls)
        test_failed_component_has_no_marker(root, bin_dir, remote, calls)
        test_safety_gates(root, bin_dir, remote, calls)
        test_restore_wrapper(root, bin_dir, remote, calls, set_id)


if __name__ == "__main__":
    main()
