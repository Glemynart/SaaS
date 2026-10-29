#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

log() {
  printf 'uploads-backup-restore-roundtrip: %s\n' "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

if [[ "${GITHUB_ACTIONS:-}" != "true" || "${CI:-}" != "true" ]]; then
  fail "run only in CI with synthetic data and a mocked OCI CLI"
fi

WORK_ROOT="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
if [[ ! -d "$WORK_ROOT" || -L "$WORK_ROOT" || ! -w "$WORK_ROOT" ]]; then
  fail "private test root is unavailable"
fi
WORK_ROOT=$(realpath -e -- "$WORK_ROOT") || fail "could not resolve private test root"
WORK_DIR=$(mktemp -d "${WORK_ROOT%/}/dusema-uploads-roundtrip.XXXXXX") || fail "could not create private test directory"
chmod 0700 -- "$WORK_DIR" || fail "could not restrict test directory permissions"
GNUPGHOME="${WORK_DIR%/}/gnupg"
MOCK_BIN="${WORK_DIR%/}/mock-bin"
SOURCE_ROOT="${WORK_DIR%/}/source"
TMP_PARENT="${WORK_DIR%/}/backup-tmp"
RESTORE_PARENT="${WORK_DIR%/}/restored"
MOCK_UPLOAD="${WORK_DIR%/}/captured-uploads.tar.gpg"
MOCK_OBJECT="${WORK_DIR%/}/captured-object-name"

cleanup() {
  local status=$?
  trap - EXIT
  case "$WORK_DIR" in
    "${WORK_ROOT%/}"/dusema-uploads-roundtrip.*)
      if [[ -d "$WORK_DIR" && ! -L "$WORK_DIR" ]]; then
        rm -rf -- "$WORK_DIR" 2>/dev/null || status=1
      else
        status=1
      fi
      ;;
    *) status=1 ;;
  esac
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

for binary in awk chmod cmp cp grep gpg mkdir mktemp python3 realpath rm sha256sum stat tar; do
  command -v "$binary" >/dev/null 2>&1 || fail "required executable is unavailable: ${binary}"
done

mkdir -m 0700 -- "$GNUPGHOME" "$MOCK_BIN" "$SOURCE_ROOT" "$TMP_PARENT" "$RESTORE_PARENT"
mkdir -m 0700 -- "${SOURCE_ROOT%/}/expedientes" "${SOURCE_ROOT%/}/firmas" "${SOURCE_ROOT%/}/empty"
printf 'synthetic expediente payload\n' >"${SOURCE_ROOT%/}/expedientes/documento-á.pdf"
printf '\000\001\177\200\377' >"${SOURCE_ROOT%/}/firmas/firma.png"
: >"${SOURCE_ROOT%/}/empty/zero-byte.bin"

key_user_id="uploads-restore-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}@example.invalid"
if ! gpg --no-options --homedir "$GNUPGHOME" --batch --pinentry-mode loopback \
  --passphrase '' --quick-generate-key "$key_user_id" rsa2048 encrypt 1d \
  >/dev/null 2>"${WORK_DIR%/}/gpg-keygen.stderr"; then
  fail "could not create the ephemeral uploads encryption key"
fi
if ! fingerprint=$(gpg --no-options --homedir "$GNUPGHOME" --batch --with-colons \
  --list-keys "$key_user_id" 2>"${WORK_DIR%/}/gpg-fingerprint.stderr" |
  awk -F: '$1 == "fpr" { print $10; exit }'); then
  fail "could not read the ephemeral public key fingerprint"
fi
if [[ ! "$fingerprint" =~ ^[[:xdigit:]]{40,64}$ ]]; then
  fail "ephemeral public key fingerprint is invalid"
fi

cat >"${MOCK_BIN%/}/oci" <<'MOCK'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$#" -lt 3 || "$1" != os || "$2" != object || "$3" != put ]]; then
  printf 'synthetic OCI private diagnostic\n' >&2
  exit 90
fi
shift 3
file=""
object=""
namespace=""
bucket=""
profile=""
region=""
verify=0
no_overwrite=0
while (($#)); do
  case "$1" in
    --file) file="${2:-}"; shift 2 ;;
    --name) object="${2:-}"; shift 2 ;;
    --namespace-name) namespace="${2:-}"; shift 2 ;;
    --bucket-name) bucket="${2:-}"; shift 2 ;;
    --profile) profile="${2:-}"; shift 2 ;;
    --region) region="${2:-}"; shift 2 ;;
    --verify-checksum) verify=1; shift ;;
    --no-overwrite) no_overwrite=1; shift ;;
    *) printf 'synthetic OCI private diagnostic\n' >&2; exit 91 ;;
  esac
done
if [[ -n "${OCI_MOCK_FAIL:-}" ]]; then
  printf 'synthetic OCI private diagnostic\n' >&2
  exit 19
fi
if [[ "$namespace" != ci-namespace || "$bucket" != ci-uploads-bucket ||
  "$profile" != ci-only-profile || "$region" != ci-region ||
  "$object" != "${UPLOADS_EXPECTED_OBJECT:-}" || "$verify" != 1 ||
  "$no_overwrite" != 1 || ! -s "$file" ]]; then
  printf 'synthetic OCI private diagnostic\n' >&2
  exit 92
fi
cp -- "$file" "$UPLOADS_CAPTURE_FILE"
printf '%s' "$object" >"$UPLOADS_CAPTURE_OBJECT"
MOCK
chmod 0700 -- "${MOCK_BIN%/}/oci"

BACKUP_SET_ID="ci-${GITHUB_RUN_ID:-1}-${GITHUB_RUN_ATTEMPT:-1}"
OCI_OBJECT_PREFIX="backup-sets"
UPLOADS_EXPECTED_OBJECT="${OCI_OBJECT_PREFIX}/${BACKUP_SET_ID}/uploads.tar.gpg"
export UPLOADS_CAPTURE_FILE="$MOCK_UPLOAD"
export UPLOADS_CAPTURE_OBJECT="$MOCK_OBJECT"
export UPLOADS_EXPECTED_OBJECT

log "backup: creating the encrypted artifact and sending it through the OCI mock"
if ! UPLOADS_ROOT="$SOURCE_ROOT" \
  UPLOADS_QUIESCED=true \
  TMP_PARENT="$TMP_PARENT" \
  BACKUP_SET_ID="$BACKUP_SET_ID" \
  GNUPGHOME="$GNUPGHOME" \
  RECOVERY_RECIPIENT_FINGERPRINT="$fingerprint" \
  OCI_NAMESPACE=ci-namespace \
  OCI_BUCKET=ci-uploads-bucket \
  OCI_REGION=ci-region \
  OCI_OBJECT_PREFIX="$OCI_OBJECT_PREFIX" \
  OCI_UPLOAD_PROFILE=ci-only-profile \
  OCI_CLI="${MOCK_BIN%/}/oci" \
  bash deploy/postgres-backup/backup-uploads-artifact.sh \
  >"${WORK_DIR%/}/backup.stdout" 2>"${WORK_DIR%/}/backup.stderr"; then
  cat "${WORK_DIR%/}/backup.stdout" >&2
  cat "${WORK_DIR%/}/backup.stderr" >&2
  fail "uploads backup artifact creation failed"
fi
if [[ ! -s "$MOCK_UPLOAD" || ! -s "$MOCK_OBJECT" ||
  "$(cat "$MOCK_OBJECT")" != "$UPLOADS_EXPECTED_OBJECT" ]]; then
  fail "OCI mock did not capture the expected encrypted object"
fi
if grep -En 'synthetic OCI private diagnostic|documento-á|firma\.png' \
  "${WORK_DIR%/}/backup.stdout" "${WORK_DIR%/}/backup.stderr" >/dev/null 2>&1; then
  fail "backup output exposed private fixture or OCI diagnostic data"
fi

log "guard: rejecting shared-writable parents without the sticky bit"
UNSAFE_PARENT="${WORK_DIR%/}/unsafe-shared-parent"
mkdir -- "$UNSAFE_PARENT"
if chmod 0770 -- "$UNSAFE_PARENT" 2>/dev/null &&
  [[ "$(stat -c '%a' -- "$UNSAFE_PARENT")" == 770 ]]; then
  if UPLOADS_ROOT="$SOURCE_ROOT" \
    UPLOADS_QUIESCED=true \
    TMP_PARENT="$UNSAFE_PARENT" \
    BACKUP_SET_ID="$BACKUP_SET_ID-unsafe" \
    GNUPGHOME="$GNUPGHOME" \
    RECOVERY_RECIPIENT_FINGERPRINT="$fingerprint" \
    OCI_NAMESPACE=ci-namespace \
    OCI_BUCKET=ci-uploads-bucket \
    OCI_REGION=ci-region \
    OCI_OBJECT_PREFIX="$OCI_OBJECT_PREFIX" \
    OCI_UPLOAD_PROFILE=ci-only-profile \
    OCI_CLI="${MOCK_BIN%/}/oci" \
    bash deploy/postgres-backup/backup-uploads-artifact.sh \
    >"${WORK_DIR%/}/unsafe-backup.stdout" 2>"${WORK_DIR%/}/unsafe-backup.stderr"; then
    fail "backup accepted a shared-writable temporary parent"
  fi
  if ENCRYPTED_BACKUP_FILE="$MOCK_UPLOAD" \
    EXPECTED_CIPHERTEXT_SHA256="$(sha256sum -- "$MOCK_UPLOAD" | awk '{print $1}')" \
    RECOVERY_GNUPGHOME="$GNUPGHOME" \
    RESTORE_PARENT="$UNSAFE_PARENT" \
    RESTORE_DIR_NAME=dusema-uploads-restored-unsafe-parent \
    RESTORE_WORK_PARENT="$TMP_PARENT" \
    bash deploy/postgres-backup/restore-uploads-artifact.sh \
    >"${WORK_DIR%/}/unsafe-restore.stdout" 2>"${WORK_DIR%/}/unsafe-restore.stderr"; then
    fail "restore accepted a shared-writable restore parent"
  fi
  if [[ -e "${UNSAFE_PARENT%/}/dusema-uploads-restored-unsafe-parent" ]]; then
    fail "unsafe restore parent unexpectedly received a directory"
  fi
else
  log "skip: filesystem cannot represent a 0770 shared-writable test directory"
fi

if ! checksum_output=$(sha256sum -- "$MOCK_UPLOAD" 2>/dev/null); then
  fail "could not calculate captured ciphertext SHA-256"
fi
encrypted_sha256="${checksum_output%% *}"
if [[ ! "$encrypted_sha256" =~ ^[[:xdigit:]]{64}$ ]]; then
  fail "captured ciphertext SHA-256 is invalid"
fi

log "guard: rejecting same-size archive content changes against the embedded manifest"
PLAIN_ARCHIVE="${WORK_DIR%/}/captured-uploads.tar"
ALTERED_ARCHIVE="${WORK_DIR%/}/altered-uploads.tar"
if ! gpg --no-options --homedir "$GNUPGHOME" --batch --no-tty \
  --output "$PLAIN_ARCHIVE" --decrypt "$MOCK_UPLOAD" \
  2>"${WORK_DIR%/}/gpg-inspection.stderr"; then
  fail "could not inspect the synthetic uploaded archive"
fi
if ! python3 - "$PLAIN_ARCHIVE" "$ALTERED_ARCHIVE" <<'PY'
import copy
import io
import sys
import tarfile

source_path, altered_path = sys.argv[1:]
target = "expedientes/documento-á.pdf"
changed = False
with tarfile.open(source_path, "r:") as source, tarfile.open(altered_path, "w:") as altered:
    for member in source:
        name = member.name
        while name.startswith("./"):
            name = name[2:]
        if member.isfile():
            stream = source.extractfile(member)
            if stream is None:
                raise SystemExit("could not read synthetic archive member")
            payload = stream.read()
            if name == target:
                payload = bytes((payload[0] ^ 1,)) + payload[1:]
                changed = True
            copied = copy.copy(member)
            copied.size = len(payload)
            altered.addfile(copied, io.BytesIO(payload))
        else:
            altered.addfile(copy.copy(member))
if not changed:
    raise SystemExit("synthetic target member was not found")
PY
then
  fail "could not create the same-size altered archive fixture"
fi
if python3 deploy/postgres-backup/uploads-archive.py validate "$ALTERED_ARCHIVE" \
  >"${WORK_DIR%/}/altered-validation.stdout" 2>"${WORK_DIR%/}/altered-validation.stderr"; then
  fail "archive validation accepted changed content with the original manifest"
fi

RESTORE_DIR_NAME="dusema-uploads-restored-$BACKUP_SET_ID"
RESTORE_ROOT="${RESTORE_PARENT%/}/${RESTORE_DIR_NAME}"
log "restore: verifying the ciphertext and restoring into a new private directory"
if ! ENCRYPTED_BACKUP_FILE="$MOCK_UPLOAD" \
  EXPECTED_CIPHERTEXT_SHA256="$encrypted_sha256" \
  RECOVERY_GNUPGHOME="$GNUPGHOME" \
  RESTORE_PARENT="$RESTORE_PARENT" \
  RESTORE_DIR_NAME="$RESTORE_DIR_NAME" \
  RESTORE_WORK_PARENT="$TMP_PARENT" \
  bash deploy/postgres-backup/restore-uploads-artifact.sh \
  >"${WORK_DIR%/}/restore.stdout" 2>"${WORK_DIR%/}/restore.stderr"; then
  cat "${WORK_DIR%/}/restore.stdout" >&2
  cat "${WORK_DIR%/}/restore.stderr" >&2
  fail "uploads restore failed"
fi
cmp -- "${SOURCE_ROOT%/}/expedientes/documento-á.pdf" "${RESTORE_ROOT%/}/expedientes/documento-á.pdf" ||
  fail "restored text fixture does not match"
cmp -- "${SOURCE_ROOT%/}/firmas/firma.png" "${RESTORE_ROOT%/}/firmas/firma.png" ||
  fail "restored binary fixture does not match"
cmp -- "${SOURCE_ROOT%/}/empty/zero-byte.bin" "${RESTORE_ROOT%/}/empty/zero-byte.bin" ||
  fail "restored empty fixture does not match"
if [[ ! -d "${RESTORE_ROOT%/}/empty" || ! -f "${RESTORE_ROOT%/}/.dusema-backup-meta/manifest.tsv" ]]; then
  fail "restore did not preserve the empty directory or private manifest"
fi
if [[ "$(stat -c '%a' -- "$RESTORE_ROOT")" != 700 ]]; then
  fail "restore directory permissions are not private"
fi

log "guard: rejecting a mismatched ciphertext hash without creating a restore directory"
wrong_sha="0${encrypted_sha256:1}"
[[ "$wrong_sha" != "$encrypted_sha256" ]] || wrong_sha="1${encrypted_sha256:1}"
if ENCRYPTED_BACKUP_FILE="$MOCK_UPLOAD" \
  EXPECTED_CIPHERTEXT_SHA256="$wrong_sha" \
  RECOVERY_GNUPGHOME="$GNUPGHOME" \
  RESTORE_PARENT="$RESTORE_PARENT" \
  RESTORE_DIR_NAME=dusema-uploads-restored-bad-hash \
  RESTORE_WORK_PARENT="$TMP_PARENT" \
  bash deploy/postgres-backup/restore-uploads-artifact.sh \
  >"${WORK_DIR%/}/bad-hash.stdout" 2>"${WORK_DIR%/}/bad-hash.stderr"; then
  fail "restore accepted a ciphertext with the wrong recorded hash"
fi
if [[ -e "${RESTORE_PARENT%/}/dusema-uploads-restored-bad-hash" ]]; then
  fail "hash mismatch created a restore directory"
fi

log "guard: bounding GPG output when a compressed artifact expands"
COMPRESSED_PLAIN="${WORK_DIR%/}/compressed-large.txt"
COMPRESSED_CIPHERTEXT="${WORK_DIR%/}/compressed-large.gpg"
python3 - "$COMPRESSED_PLAIN" <<'PY'
import sys
with open(sys.argv[1], "wb") as output:
    output.write(b"\0" * (2 * 1024 * 1024))
PY
if ! gpg --no-options --homedir "$GNUPGHOME" --batch --no-tty \
  --trust-model always --recipient "${fingerprint}!" \
  --output "$COMPRESSED_CIPHERTEXT" --encrypt "$COMPRESSED_PLAIN" \
  2>"${WORK_DIR%/}/gpg-compressed-fixture.stderr"; then
  fail "could not create a compressed synthetic expansion fixture"
fi
compressed_plain_bytes=$(stat -c '%s' -- "$COMPRESSED_PLAIN")
compressed_cipher_bytes=$(stat -c '%s' -- "$COMPRESSED_CIPHERTEXT")
if (( compressed_cipher_bytes >= compressed_plain_bytes )); then
  fail "synthetic GPG fixture did not exercise compression expansion"
fi
if ! compressed_checksum_output=$(sha256sum -- "$COMPRESSED_CIPHERTEXT" 2>/dev/null); then
  fail "could not checksum the compressed synthetic fixture"
fi
compressed_sha256="${compressed_checksum_output%% *}"
cat >"${MOCK_BIN%/}/df" <<'DFMOCK'
#!/usr/bin/env bash
printf 'Avail\n68108864\n'
DFMOCK
chmod 0700 -- "${MOCK_BIN%/}/df"
if PATH="${MOCK_BIN%/}:$PATH" \
  ENCRYPTED_BACKUP_FILE="$COMPRESSED_CIPHERTEXT" \
  EXPECTED_CIPHERTEXT_SHA256="$compressed_sha256" \
  RECOVERY_GNUPGHOME="$GNUPGHOME" \
  RESTORE_PARENT="$RESTORE_PARENT" \
  RESTORE_DIR_NAME=dusema-uploads-restored-compression-limit \
  RESTORE_WORK_PARENT="$TMP_PARENT" \
  bash deploy/postgres-backup/restore-uploads-artifact.sh \
  >"${WORK_DIR%/}/compression-limit.stdout" 2>"${WORK_DIR%/}/compression-limit.stderr"; then
  fail "restore accepted GPG output beyond the available disk budget"
fi
if [[ -e "${RESTORE_PARENT%/}/dusema-uploads-restored-compression-limit" ]]; then
  fail "GPG output limit failure created a restore directory"
fi

log "guard: preserving an existing restore directory"
EXISTING_ROOT="${RESTORE_PARENT%/}/dusema-uploads-restored-existing"
mkdir -m 0700 -- "$EXISTING_ROOT"
printf 'preserve-existing' >"${EXISTING_ROOT%/}/sentinel.txt"
if ENCRYPTED_BACKUP_FILE="$MOCK_UPLOAD" \
  EXPECTED_CIPHERTEXT_SHA256="$encrypted_sha256" \
  RECOVERY_GNUPGHOME="$GNUPGHOME" \
  RESTORE_PARENT="$RESTORE_PARENT" \
  RESTORE_DIR_NAME=dusema-uploads-restored-existing \
  RESTORE_WORK_PARENT="$TMP_PARENT" \
  bash deploy/postgres-backup/restore-uploads-artifact.sh \
  >"${WORK_DIR%/}/existing.stdout" 2>"${WORK_DIR%/}/existing.stderr"; then
  fail "restore accepted an existing destination"
fi
if [[ "$(cat "${EXISTING_ROOT%/}/sentinel.txt")" != preserve-existing ]]; then
  fail "restore modified the existing destination"
fi

log "guard: rejecting an archive path traversal before extraction"
MALICIOUS_ARCHIVE="${WORK_DIR%/}/malicious.tar"
MALICIOUS_CIPHERTEXT="${WORK_DIR%/}/malicious.tar.gpg"
python3 - "$MALICIOUS_ARCHIVE" <<'PY'
import csv
import hashlib
import io
import sys
import tarfile

payload = b"must never escape restore root\n"
manifest = io.StringIO(newline="")
csv.writer(manifest, delimiter="\t", lineterminator="\n").writerow(
    (hashlib.sha256(payload).hexdigest(), str(len(payload)), "escape-marker.txt")
)
with tarfile.open(sys.argv[1], "w") as archive:
    outside = tarfile.TarInfo("../escape-marker.txt")
    outside.size = len(payload)
    archive.addfile(outside, io.BytesIO(payload))
    metadata = tarfile.TarInfo(".dusema-backup-meta")
    metadata.type = tarfile.DIRTYPE
    archive.addfile(metadata)
    manifest_bytes = manifest.getvalue().encode("utf-8")
    manifest_entry = tarfile.TarInfo(".dusema-backup-meta/manifest.tsv")
    manifest_entry.size = len(manifest_bytes)
    archive.addfile(manifest_entry, io.BytesIO(manifest_bytes))
PY
if ! gpg --no-options --homedir "$GNUPGHOME" --batch --no-tty --trust-model always \
  --recipient "${fingerprint}!" --output "$MALICIOUS_CIPHERTEXT" --encrypt "$MALICIOUS_ARCHIVE" \
  2>"${WORK_DIR%/}/malicious-encrypt.stderr"; then
  fail "could not create the encrypted malicious-path test fixture"
fi
if ! checksum_output=$(sha256sum -- "$MALICIOUS_CIPHERTEXT" 2>/dev/null); then
  fail "could not calculate malicious fixture checksum"
fi
malicious_sha256="${checksum_output%% *}"
if ENCRYPTED_BACKUP_FILE="$MALICIOUS_CIPHERTEXT" \
  EXPECTED_CIPHERTEXT_SHA256="$malicious_sha256" \
  RECOVERY_GNUPGHOME="$GNUPGHOME" \
  RESTORE_PARENT="$RESTORE_PARENT" \
  RESTORE_DIR_NAME=dusema-uploads-restored-malicious \
  RESTORE_WORK_PARENT="$TMP_PARENT" \
  bash deploy/postgres-backup/restore-uploads-artifact.sh \
  >"${WORK_DIR%/}/malicious.stdout" 2>"${WORK_DIR%/}/malicious.stderr"; then
  fail "restore accepted a path-traversal archive"
fi
if [[ -e "${RESTORE_PARENT%/}/escape-marker.txt" ||
  -e "${RESTORE_PARENT%/}/dusema-uploads-restored-malicious" ]]; then
  fail "malicious archive wrote outside the restore directory or left a destination"
fi

log "guard: suppressing OCI diagnostics and withholding success on upload failure"
if UPLOADS_ROOT="$SOURCE_ROOT" \
  UPLOADS_QUIESCED=true \
  TMP_PARENT="$TMP_PARENT" \
  BACKUP_SET_ID="${BACKUP_SET_ID}-failure" \
  GNUPGHOME="$GNUPGHOME" \
  RECOVERY_RECIPIENT_FINGERPRINT="$fingerprint" \
  OCI_NAMESPACE=ci-namespace \
  OCI_BUCKET=ci-uploads-bucket \
  OCI_REGION=ci-region \
  OCI_OBJECT_PREFIX="$OCI_OBJECT_PREFIX" \
  OCI_UPLOAD_PROFILE=ci-only-profile \
  OCI_CLI="${MOCK_BIN%/}/oci" \
  OCI_MOCK_FAIL=true \
  bash deploy/postgres-backup/backup-uploads-artifact.sh \
  >"${WORK_DIR%/}/upload-failure.stdout" 2>"${WORK_DIR%/}/upload-failure.stderr"; then
  fail "uploads backup reported success after an OCI failure"
fi
if grep -En 'synthetic OCI private diagnostic|artifact upload complete' \
  "${WORK_DIR%/}/upload-failure.stdout" "${WORK_DIR%/}/upload-failure.stderr" >/dev/null 2>&1; then
  fail "OCI diagnostics leaked or false completion was logged"
fi

log "PASS: encrypted uploads artifact uploaded, restored, and verified; manifest, checksum, and traversal guards passed"
