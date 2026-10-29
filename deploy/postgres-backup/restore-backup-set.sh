#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

log() {
  printf 'dusema-backup-set-restore: %s\n' "$*"
}

fail() {
  local code="$1"
  shift
  log "ERROR: $*"
  exit "$code"
}

BACKUP_SET_ID="${BACKUP_SET_ID:-}"
ENCRYPTED_MANIFEST_FILE="${ENCRYPTED_MANIFEST_FILE:-}"
EXPECTED_MANIFEST_CIPHERTEXT_SHA256="${EXPECTED_MANIFEST_CIPHERTEXT_SHA256:-}"
ENCRYPTED_POSTGRES_FILE="${ENCRYPTED_POSTGRES_FILE:-}"
ENCRYPTED_UPLOADS_FILE="${ENCRYPTED_UPLOADS_FILE:-}"
RECOVERY_GNUPGHOME="${RECOVERY_GNUPGHOME:-}"
RESTORE_SET_NAMESPACE="${RESTORE_SET_NAMESPACE:-}"
RESTORE_SET_BUCKET="${RESTORE_SET_BUCKET:-}"
RESTORE_SET_REGION="${RESTORE_SET_REGION:-}"
RESTORE_SET_PREFIX="${RESTORE_SET_PREFIX:-backup-sets}"
RESTORE_CONTAINER_ID="${RESTORE_CONTAINER_ID:-}"
RESTORE_DATABASE="${RESTORE_DATABASE:-}"
RESTORE_TMP_ROOT="${RESTORE_TMP_ROOT:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}}"
RESTORE_PARENT="${RESTORE_PARENT:-}"
RESTORE_DIR_NAME="${RESTORE_DIR_NAME:-}"
RESTORE_WORK_PARENT="${RESTORE_WORK_PARENT:-${TMPDIR:-/tmp}}"

if [[ -z "$BACKUP_SET_ID" || -z "$ENCRYPTED_MANIFEST_FILE" || -z "$EXPECTED_MANIFEST_CIPHERTEXT_SHA256" ||
  -z "$ENCRYPTED_POSTGRES_FILE" || -z "$ENCRYPTED_UPLOADS_FILE" || -z "$RECOVERY_GNUPGHOME" ||
  -z "$RESTORE_SET_NAMESPACE" || -z "$RESTORE_SET_BUCKET" || -z "$RESTORE_SET_REGION" ||
  -z "$RESTORE_CONTAINER_ID" || -z "$RESTORE_DATABASE" || -z "$RESTORE_PARENT" || -z "$RESTORE_DIR_NAME" ]]; then
  fail 64 "manifest, both artifacts, expected object store, and isolated restore targets are required"
fi
if [[ ! "$BACKUP_SET_ID" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{16}$ ||
  ! "$EXPECTED_MANIFEST_CIPHERTEXT_SHA256" =~ ^[[:xdigit:]]{64}$ ||
  "$RESTORE_SET_PREFIX" != "backup-sets" ||
  ! "$RESTORE_SET_NAMESPACE" =~ ^[A-Za-z0-9-]{1,64}$ ||
  ! "$RESTORE_SET_BUCKET" =~ ^[A-Za-z0-9._-]{1,255}$ || "$RESTORE_SET_BUCKET" == "dusema-backups-prod" || "$RESTORE_SET_BUCKET" != *staging* ||
  ! "$RESTORE_SET_REGION" =~ ^[A-Za-z0-9-]{1,64}$ ]]; then
  fail 64 "backup set ID, ciphertext digest, or expected object-store reference is invalid"
fi
for input_file in "$ENCRYPTED_MANIFEST_FILE" "$ENCRYPTED_POSTGRES_FILE" "$ENCRYPTED_UPLOADS_FILE"; do
  if [[ ! -f "$input_file" || -L "$input_file" ]]; then
    fail 64 "manifest and artifact inputs must be regular files, not symbolic links"
  fi
done
if [[ ! -d "$RECOVERY_GNUPGHOME" || -L "$RECOVERY_GNUPGHOME" ]]; then
  fail 64 "recovery GnuPG home must be an existing directory, not a symbolic link"
fi
if [[ ! -d "$RESTORE_TMP_ROOT" || -L "$RESTORE_TMP_ROOT" || ! -w "$RESTORE_TMP_ROOT" ||
  ! -d "$RESTORE_WORK_PARENT" || -L "$RESTORE_WORK_PARENT" || ! -w "$RESTORE_WORK_PARENT" ]]; then
  fail 64 "restore work directories must exist, be writable, and not be symbolic links"
fi

for binary in bash chmod gpg mktemp python3 realpath rm sha256sum stat; do
  command -v "$binary" >/dev/null 2>&1 || fail 64 "required executable is unavailable: ${binary}"
done
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P) || fail 64 "could not resolve script directory"
MANIFEST_HELPER="${SCRIPT_DIR%/}/backup-set-manifest.py"
POSTGRES_RESTORE_SCRIPT="${SCRIPT_DIR%/}/restore-postgres-backup.sh"
UPLOADS_RESTORE_SCRIPT="${SCRIPT_DIR%/}/restore-uploads-artifact.sh"
for required_file in "$MANIFEST_HELPER" "$POSTGRES_RESTORE_SCRIPT" "$UPLOADS_RESTORE_SCRIPT"; do
  if [[ ! -f "$required_file" || -L "$required_file" ]]; then
    fail 64 "a coordinated restore component is unavailable"
  fi
done

ENCRYPTED_MANIFEST_FILE=$(realpath -e -- "$ENCRYPTED_MANIFEST_FILE") || fail 64 "could not resolve encrypted manifest"
ENCRYPTED_POSTGRES_FILE=$(realpath -e -- "$ENCRYPTED_POSTGRES_FILE") || fail 64 "could not resolve PostgreSQL ciphertext"
ENCRYPTED_UPLOADS_FILE=$(realpath -e -- "$ENCRYPTED_UPLOADS_FILE") || fail 64 "could not resolve uploads ciphertext"
RECOVERY_GNUPGHOME=$(realpath -e -- "$RECOVERY_GNUPGHOME") || fail 64 "could not resolve recovery GPG home"
RESTORE_TMP_ROOT=$(realpath -e -- "$RESTORE_TMP_ROOT") || fail 64 "could not resolve restore temporary root"
RESTORE_WORK_PARENT=$(realpath -e -- "$RESTORE_WORK_PARENT") || fail 64 "could not resolve restore work parent"

if ! manifest_bytes=$(stat -c '%s' -- "$ENCRYPTED_MANIFEST_FILE" 2>/dev/null) ||
  [[ ! "$manifest_bytes" =~ ^[0-9]+$ ]] || (( manifest_bytes < 1 || manifest_bytes > 1048576 )); then
  fail 64 "encrypted manifest must contain between 1 byte and 1 MiB"
fi
if ! checksum_output=$(sha256sum -- "$ENCRYPTED_MANIFEST_FILE" 2>/dev/null); then
  fail 64 "could not calculate encrypted manifest SHA-256"
fi
actual_manifest_sha256="${checksum_output%% *}"
expected_manifest_sha256="${EXPECTED_MANIFEST_CIPHERTEXT_SHA256,,}"
if [[ "${actual_manifest_sha256,,}" != "$expected_manifest_sha256" ]]; then
  fail 64 "encrypted manifest SHA-256 does not match the expected value"
fi

workdir=$(mktemp -d "${RESTORE_WORK_PARENT%/}/dusema-backup-set-restore.XXXXXX") || fail 70 "could not create a private restore workspace"
cleanup() {
  local status=$?
  local cleanup_failed=0
  trap - EXIT
  case "$workdir" in
    "${RESTORE_WORK_PARENT%/}"/dusema-backup-set-restore.*)
      if [[ -d "$workdir" && ! -L "$workdir" ]]; then
        rm -rf -- "$workdir" 2>/dev/null || cleanup_failed=1
      else
        cleanup_failed=1
      fi
      ;;
    *) cleanup_failed=1 ;;
  esac
  if (( cleanup_failed != 0 )); then
    log "ERROR: private restore workspace cleanup failed"
    if (( status == 0 )); then status=70; fi
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP
chmod 0700 -- "$workdir" 2>/dev/null || fail 70 "could not restrict restore workspace permissions"
manifest_file="${workdir%/}/manifest.json"

if ! gpg --no-options --homedir "$RECOVERY_GNUPGHOME" --batch --no-tty --no-auto-key-retrieve \
  --max-output 1048576 --output "$manifest_file" --decrypt "$ENCRYPTED_MANIFEST_FILE" \
  2>"${workdir%/}/manifest-gpg.stderr"; then
  fail 1 "could not decrypt the coordinated backup set manifest"
fi
if [[ ! -s "$manifest_file" ]]; then
  fail 1 "decrypted backup set manifest is empty"
fi
if ! python3 "$MANIFEST_HELPER" validate \
  --manifest "$manifest_file" --expected-id "$BACKUP_SET_ID" \
  --prefix "$RESTORE_SET_PREFIX" --namespace "$RESTORE_SET_NAMESPACE" \
  --bucket "$RESTORE_SET_BUCKET" --region "$RESTORE_SET_REGION" \
  --postgres-file "$ENCRYPTED_POSTGRES_FILE" --uploads-file "$ENCRYPTED_UPLOADS_FILE" \
  2>"${workdir%/}/manifest-validation.stderr"; then
  fail 1 "backup set manifest or one of its encrypted artifacts is invalid"
fi
if ! postgres_sha256=$(python3 "$MANIFEST_HELPER" artifact-field \
  --manifest "$manifest_file" --kind postgres --field sha256 2>/dev/null) ||
  ! uploads_sha256=$(python3 "$MANIFEST_HELPER" artifact-field \
    --manifest "$manifest_file" --kind uploads --field sha256 2>/dev/null); then
  fail 1 "could not read the validated artifact digests"
fi

log "restore: validating and restoring the isolated PostgreSQL artifact"
if ! ENCRYPTED_BACKUP_FILE="$ENCRYPTED_POSTGRES_FILE" \
  EXPECTED_CIPHERTEXT_SHA256="$postgres_sha256" \
  RECOVERY_GNUPGHOME="$RECOVERY_GNUPGHOME" \
  RESTORE_CONTAINER_ID="$RESTORE_CONTAINER_ID" RESTORE_DATABASE="$RESTORE_DATABASE" \
  RESTORE_TMP_ROOT="$RESTORE_TMP_ROOT" \
  bash "$POSTGRES_RESTORE_SCRIPT"; then
  fail 2 "PostgreSQL artifact restore failed; uploads restore was not started"
fi

log "restore: validating and restoring the private uploads artifact"
if ! ENCRYPTED_BACKUP_FILE="$ENCRYPTED_UPLOADS_FILE" \
  EXPECTED_CIPHERTEXT_SHA256="$uploads_sha256" \
  RECOVERY_GNUPGHOME="$RECOVERY_GNUPGHOME" \
  RESTORE_PARENT="$RESTORE_PARENT" RESTORE_DIR_NAME="$RESTORE_DIR_NAME" \
  RESTORE_WORK_PARENT="$RESTORE_WORK_PARENT" \
  bash "$UPLOADS_RESTORE_SCRIPT"; then
  fail 3 "uploads artifact restore failed; the PostgreSQL database remains isolated"
fi

log "complete: both artifacts restored in isolated targets backup_set_id=${BACKUP_SET_ID}"
