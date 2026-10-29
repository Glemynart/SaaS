#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

log() {
  printf 'dusema-uploads-backup: %s\n' "$*"
}

fail() {
  local code="$1"
  shift
  log "ERROR: $*"
  exit "$code"
}

UPLOADS_ROOT="${UPLOADS_ROOT:-}"
UPLOADS_QUIESCED="${UPLOADS_QUIESCED:-}"
TMP_PARENT="${TMP_PARENT:-}"
BACKUP_SET_ID="${BACKUP_SET_ID:-}"
GNUPGHOME="${GNUPGHOME:-}"
RECOVERY_RECIPIENT_FINGERPRINT="${RECOVERY_RECIPIENT_FINGERPRINT:-}"
OCI_NAMESPACE="${OCI_NAMESPACE:-}"
OCI_BUCKET="${OCI_BUCKET:-}"
OCI_REGION="${OCI_REGION:-}"
OCI_OBJECT_PREFIX="${OCI_OBJECT_PREFIX:-}"
OCI_UPLOAD_PROFILE="${OCI_UPLOAD_PROFILE:-}"
OCI_CLI="${OCI_CLI:-oci}"

if [[ -z "$UPLOADS_ROOT" || -z "$UPLOADS_QUIESCED" || -z "$TMP_PARENT" ||
  -z "$BACKUP_SET_ID" || -z "$GNUPGHOME" ||
  -z "$RECOVERY_RECIPIENT_FINGERPRINT" || -z "$OCI_NAMESPACE" ||
  -z "$OCI_BUCKET" || -z "$OCI_REGION" || -z "$OCI_OBJECT_PREFIX" ||
  -z "$OCI_UPLOAD_PROFILE" ]]; then
  fail 64 "required uploads source, quiescence, encryption, and OCI destination settings are missing"
fi
if [[ "$UPLOADS_QUIESCED" != "true" ]]; then
  fail 64 "set UPLOADS_QUIESCED=true only after writes and background jobs are stopped"
fi
if [[ ! "$BACKUP_SET_ID" =~ ^[A-Za-z0-9][A-Za-z0-9Tz._-]{0,63}$ ]]; then
  fail 64 "backup set ID is invalid"
fi
if [[ ! "$RECOVERY_RECIPIENT_FINGERPRINT" =~ ^[[:xdigit:]]{40,64}$ ]]; then
  fail 64 "recovery recipient fingerprint is invalid"
fi
if [[ ! "$OCI_UPLOAD_PROFILE" =~ ^[A-Za-z0-9._-]{1,64}$ ]]; then
  fail 64 "OCI upload profile name is invalid"
fi
if [[ ! "$OCI_OBJECT_PREFIX" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$ ||
  "$OCI_OBJECT_PREFIX" == */ || "$OCI_OBJECT_PREFIX" == *//* ]]; then
  fail 64 "OCI object prefix is invalid"
fi
case "/$OCI_OBJECT_PREFIX/" in
  */../*) fail 64 "OCI object prefix contains a traversal segment" ;;
esac

if [[ ! "$UPLOADS_ROOT" = /* || ! -d "$UPLOADS_ROOT" || -L "$UPLOADS_ROOT" ]]; then
  fail 64 "uploads source must be an existing absolute directory, not a symbolic link"
fi
if [[ -e "$UPLOADS_ROOT/.dusema-backup-meta" || -L "$UPLOADS_ROOT/.dusema-backup-meta" ]]; then
  fail 64 "uploads source already contains the reserved backup metadata path"
fi
if [[ ! "$TMP_PARENT" = /* || ! -d "$TMP_PARENT" || -L "$TMP_PARENT" || ! -w "$TMP_PARENT" ]]; then
  fail 64 "temporary parent must be an existing writable absolute directory, not a symbolic link"
fi
if [[ ! -d "$GNUPGHOME" || -L "$GNUPGHOME" ]]; then
  fail 64 "GnuPG home must be an existing directory, not a symbolic link"
fi

UPLOADS_ROOT=$(realpath -e -- "$UPLOADS_ROOT") || fail 64 "could not resolve uploads source"
TMP_PARENT=$(realpath -e -- "$TMP_PARENT") || fail 64 "could not resolve temporary parent"
GNUPGHOME=$(realpath -e -- "$GNUPGHOME") || fail 64 "could not resolve GnuPG home"
if [[ "$UPLOADS_ROOT" == "/" ]]; then
  fail 64 "filesystem root cannot be used as the uploads source"
fi
case "${TMP_PARENT%/}/" in
  "${UPLOADS_ROOT%/}/"* ) fail 64 "temporary parent must be outside the uploads source" ;;
esac

temporary_mode=$(stat -c '%a' -- "$TMP_PARENT" 2>/dev/null) || fail 64 "could not inspect temporary parent permissions"
if [[ ! "$temporary_mode" =~ ^[0-7]{3,4}$ ]]; then
  fail 64 "temporary parent permissions could not be interpreted safely"
fi
temporary_mode_value=$((8#$temporary_mode))
if (( (temporary_mode_value & 0022) != 0 && (temporary_mode_value & 01000) == 0 )); then
  fail 64 "temporary parent must not be shared-writable without the sticky bit"
fi

for binary in chmod df gpg mktemp oci realpath rm sha256sum stat tail tar tr python3; do
  if [[ "$binary" == "oci" && "$OCI_CLI" != "oci" ]]; then
    command -v "$OCI_CLI" >/dev/null 2>&1 || fail 64 "OCI CLI is unavailable"
  else
    command -v "$binary" >/dev/null 2>&1 || fail 64 "required executable is unavailable: ${binary}"
  fi
done

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P) || fail 64 "could not resolve script directory"
ARCHIVE_HELPER="${SCRIPT_DIR%/}/uploads-archive.py"
if [[ ! -f "$ARCHIVE_HELPER" || -L "$ARCHIVE_HELPER" ]]; then
  fail 64 "uploads archive verifier is unavailable"
fi
if ! key_listing=$(gpg --no-options --homedir "$GNUPGHOME" --batch --with-colons \
  --list-keys "${RECOVERY_RECIPIENT_FINGERPRINT}!" 2>/dev/null); then
  fail 64 "recovery public key is unavailable"
fi
if [[ "$key_listing" != *"${RECOVERY_RECIPIENT_FINGERPRINT^^}"* ]]; then
  fail 64 "recovery public key fingerprint does not match the configured recipient"
fi

require_free_space() {
  local path="$1"
  local required_bytes="$2"
  local available_bytes

  available_bytes=$(df -B1 --output=avail -- "$path" 2>/dev/null | tail -n 1 | tr -d '[:space:]') ||
    fail 64 "could not check available temporary disk space"
  if [[ ! "$available_bytes" =~ ^[0-9]+$ ]] ||
    ! python3 - "$required_bytes" "$available_bytes" <<'PY'
import sys
raise SystemExit(int(sys.argv[2]) < int(sys.argv[1]))
PY
  then
    fail 64 "insufficient free disk space for the uploads artifact"
  fi
}

workdir=$(mktemp -d "${TMP_PARENT%/}/dusema-uploads-backup.XXXXXX") || fail 70 "could not create a private temporary directory"
encrypted_file="${workdir%/}/uploads.tar.gpg"
upload_succeeded=0
object_name="${OCI_OBJECT_PREFIX%/}/${BACKUP_SET_ID}/uploads.tar.gpg"

cleanup() {
  local status=$?
  local cleanup_failed=0
  trap - EXIT
  case "$workdir" in
    "${TMP_PARENT%/}"/dusema-uploads-backup.*)
      if [[ -d "$workdir" && ! -L "$workdir" ]]; then
        rm -rf -- "$workdir" 2>/dev/null || cleanup_failed=1
      else
        cleanup_failed=1
      fi
      ;;
    *) cleanup_failed=1 ;;
  esac
  if (( cleanup_failed != 0 )); then
    log "ERROR: temporary cleanup failed (category=temporary_cleanup); original_exit=${status}"
    if (( status == 0 )); then status=70; fi
  elif (( status == 0 && upload_succeeded != 0 )); then
    log "artifact upload complete: backup_set_id=${BACKUP_SET_ID} object=${object_name}"
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP
chmod 0700 -- "$workdir" 2>/dev/null || fail 70 "could not restrict temporary directory permissions"

log "snapshot: hashing the quiesced uploads tree"
if ! source_totals=$(python3 "$ARCHIVE_HELPER" manifest "$UPLOADS_ROOT" "${workdir%/}/manifest.tsv" 2>"${workdir%/}/manifest.stderr"); then
  fail 21 "could not create the private uploads manifest"
fi
source_bytes="${source_totals##* bytes=}"
if [[ ! "$source_bytes" =~ ^[0-9]+$ ]] ||
  ! required_temp_bytes=$(python3 - "$source_bytes" <<'PY'
import sys
print(int(sys.argv[1]) * 2 + 67108864)
PY
); then
  fail 21 "uploads manifest returned invalid aggregate totals"
fi
require_free_space "$TMP_PARENT" "$required_temp_bytes"
if ! tar --create --one-file-system --file="${workdir%/}/uploads.tar" \
  --directory="$UPLOADS_ROOT" . 2>"${workdir%/}/tar-create.stderr"; then
  fail 22 "could not archive the uploads tree"
fi
if ! tar --append --file="${workdir%/}/uploads.tar" \
  --transform='s|^manifest.tsv$|.dusema-backup-meta/manifest.tsv|' \
  --directory="$workdir" manifest.tsv 2>"${workdir%/}/tar-append.stderr"; then
  fail 22 "could not add the private manifest to the archive"
fi
if ! archive_totals=$(python3 "$ARCHIVE_HELPER" validate "${workdir%/}/uploads.tar" 2>"${workdir%/}/archive-validation.stderr"); then
  fail 22 "uploads archive failed structural validation"
fi
if ! python3 "$ARCHIVE_HELPER" compare "$UPLOADS_ROOT" "${workdir%/}/manifest.tsv" \
  >/dev/null 2>"${workdir%/}/source-comparison.stderr"; then
  fail 23 "uploads changed while the archive was being created"
fi
if [[ "$source_totals" != "$archive_totals" ]]; then
  fail 23 "uploads archive does not match the source manifest"
fi

log "encrypt: protecting the archive with the recovery recipient"
if ! gpg --no-options --homedir "$GNUPGHOME" --batch --no-tty --no-auto-key-retrieve \
  --compress-algo none \
  --trust-model always --recipient "${RECOVERY_RECIPIENT_FINGERPRINT}!" \
  --output "$encrypted_file" --encrypt "${workdir%/}/uploads.tar" \
  2>"${workdir%/}/gpg-encrypt.stderr"; then
  fail 31 "GPG could not encrypt the uploads archive"
fi
if [[ ! -s "$encrypted_file" ]]; then
  fail 31 "GPG produced an empty encrypted uploads archive"
fi
if ! checksum_output=$(sha256sum -- "$encrypted_file" 2>/dev/null); then
  fail 40 "could not calculate encrypted uploads checksum"
fi
encrypted_sha256="${checksum_output%% *}"
if [[ ! "$encrypted_sha256" =~ ^[[:xdigit:]]{64}$ ]]; then
  fail 40 "encrypted uploads checksum is invalid"
fi
if ! artifact_bytes=$(stat -c '%s' -- "$encrypted_file" 2>/dev/null) ||
  [[ ! "$artifact_bytes" =~ ^[0-9]+$ ]] || (( artifact_bytes < 1 )); then
  fail 40 "encrypted uploads artifact size is invalid"
fi

log "upload: sending encrypted uploads artifact object=${object_name} sha256=${encrypted_sha256} bytes=${artifact_bytes}"
if "$OCI_CLI" os object put \
  --namespace-name "$OCI_NAMESPACE" \
  --bucket-name "$OCI_BUCKET" \
  --name "$object_name" \
  --file "$encrypted_file" \
  --region "$OCI_REGION" \
  --profile "$OCI_UPLOAD_PROFILE" \
  --verify-checksum \
  --no-overwrite \
  >/dev/null 2>"${workdir%/}/oci-upload.stderr"; then
  upload_succeeded=1
else
  upload_status=$?
  fail 51 "OCI rejected the encrypted uploads artifact (client exit=${upload_status})"
fi
