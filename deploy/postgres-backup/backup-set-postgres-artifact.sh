#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

log() {
  printf 'dusema-backup-set-postgres: %s\n' "$*"
}

fail() {
  local code="$1"
  shift
  log "ERROR: $*"
  exit "$code"
}

BACKUP_SET_ID="${BACKUP_SET_ID:-}"
BACKUP_SET_ENVIRONMENT="${BACKUP_SET_ENVIRONMENT:-}"
BACKUP_SET_ISOLATED_CONFIRMED="${BACKUP_SET_ISOLATED_CONFIRMED:-}"
BACKUP_SET_WRITES_QUIESCED="${BACKUP_SET_WRITES_QUIESCED:-}"
PG_CONTAINER="${BACKUP_SET_PG_CONTAINER:-}"
PG_DATABASE="${BACKUP_SET_PG_DATABASE:-}"
PG_ROLE="${BACKUP_SET_PG_ROLE:-}"
TMP_PARENT="${BACKUP_SET_TMP_PARENT:-}"
GNUPGHOME="${GNUPGHOME:-}"
RECOVERY_RECIPIENT_FINGERPRINT="${RECOVERY_RECIPIENT_FINGERPRINT:-}"
OCI_NAMESPACE="${OCI_NAMESPACE:-}"
OCI_BUCKET="${OCI_BUCKET:-}"
OCI_REGION="${OCI_REGION:-}"
OCI_OBJECT_PREFIX="${OCI_OBJECT_PREFIX:-}"
OCI_UPLOAD_PROFILE="${OCI_UPLOAD_PROFILE:-}"
OCI_CLI="${OCI_CLI:-oci}"
BACKUP_SET_METADATA_FILE="${BACKUP_SET_METADATA_FILE:-}"

if [[ -z "$BACKUP_SET_ID" || -z "$PG_CONTAINER" || -z "$PG_DATABASE" || -z "$PG_ROLE" ||
  -z "$TMP_PARENT" || -z "$GNUPGHOME" || -z "$RECOVERY_RECIPIENT_FINGERPRINT" ||
  -z "$OCI_NAMESPACE" || -z "$OCI_BUCKET" || -z "$OCI_REGION" ||
  -z "$OCI_OBJECT_PREFIX" || -z "$OCI_UPLOAD_PROFILE" || -z "$BACKUP_SET_METADATA_FILE" ]]; then
  fail 64 "required staging database, encryption, metadata, and object-storage settings are missing"
fi
if [[ "$BACKUP_SET_ENVIRONMENT" != "staging" || "$BACKUP_SET_ISOLATED_CONFIRMED" != "true" ||
  "$BACKUP_SET_WRITES_QUIESCED" != "true" ]]; then
  fail 64 "coordinated artifacts require isolated staging and a confirmed write barrier"
fi
if [[ ! "$BACKUP_SET_ID" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{16}$ ]]; then
  fail 64 "backup set ID is invalid"
fi
if [[ ! "$PG_CONTAINER" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ||
  ! "$PG_DATABASE" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ||
  ! "$PG_ROLE" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]; then
  fail 64 "staging PostgreSQL target is invalid"
fi
if [[ "$PG_CONTAINER" == "postgres" && "$PG_DATABASE" == "oficina_nitida" ]]; then
  fail 64 "refusing the known shared PostgreSQL production target"
fi
if [[ ! "$RECOVERY_RECIPIENT_FINGERPRINT" =~ ^[[:xdigit:]]{40,64}$ ]]; then
  fail 64 "recovery recipient fingerprint is invalid"
fi
if [[ ! "$OCI_NAMESPACE" =~ ^[A-Za-z0-9-]{1,64}$ ||
  ! "$OCI_BUCKET" =~ ^[A-Za-z0-9._-]{1,255}$ || "$OCI_BUCKET" == "dusema-backups-prod" || "$OCI_BUCKET" != *staging* ||
  ! "$OCI_REGION" =~ ^[A-Za-z0-9-]{1,64}$ || "$OCI_OBJECT_PREFIX" != "backup-sets" ||
  ! "$OCI_UPLOAD_PROFILE" =~ ^[A-Za-z0-9._-]{1,64}$ ]]; then
  fail 64 "coordinated backup destination is invalid or points to the production backup bucket"
fi
if [[ ! "$TMP_PARENT" = /* || ! -d "$TMP_PARENT" || -L "$TMP_PARENT" || ! -w "$TMP_PARENT" ]]; then
  fail 64 "temporary parent must be an existing writable absolute directory"
fi
if [[ ! -d "$GNUPGHOME" || -L "$GNUPGHOME" ]]; then
  fail 64 "GnuPG home must be an existing directory, not a symbolic link"
fi
if [[ ! "$BACKUP_SET_METADATA_FILE" = /* || -e "$BACKUP_SET_METADATA_FILE" || -L "$BACKUP_SET_METADATA_FILE" ]]; then
  fail 64 "artifact metadata destination must be a new absolute file path"
fi
metadata_parent=$(dirname -- "$BACKUP_SET_METADATA_FILE") || fail 64 "could not resolve metadata destination"
if [[ ! -d "$metadata_parent" || -L "$metadata_parent" || ! -w "$metadata_parent" ]]; then
  fail 64 "artifact metadata parent must be an existing writable directory"
fi

TMP_PARENT=$(realpath -e -- "$TMP_PARENT") || fail 64 "could not resolve temporary parent"
GNUPGHOME=$(realpath -e -- "$GNUPGHOME") || fail 64 "could not resolve GnuPG home"
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P) || fail 64 "could not resolve script directory"
MANIFEST_HELPER="${SCRIPT_DIR%/}/backup-set-manifest.py"
if [[ ! -f "$MANIFEST_HELPER" || -L "$MANIFEST_HELPER" ]]; then
  fail 64 "backup set manifest helper is unavailable"
fi

for binary in chmod docker gpg mktemp python3 realpath rm sha256sum stat; do
  command -v "$binary" >/dev/null 2>&1 || fail 64 "required executable is unavailable: ${binary}"
done
command -v "$OCI_CLI" >/dev/null 2>&1 || fail 64 "OCI CLI is unavailable"

if ! key_listing=$(gpg --no-options --homedir "$GNUPGHOME" --batch --with-colons \
  --list-keys "${RECOVERY_RECIPIENT_FINGERPRINT}!" 2>/dev/null); then
  fail 64 "recovery public key lookup failed"
fi
if [[ "$key_listing" != *"${RECOVERY_RECIPIENT_FINGERPRINT^^}"* ]]; then
  fail 64 "recovery public key fingerprint does not match the configured recipient"
fi

workdir=$(mktemp -d "${TMP_PARENT%/}/dusema-backup-set-postgres.XXXXXX") || fail 70 "could not create a private temporary directory"
encrypted_file="${workdir%/}/postgres.dump.gpg"
object_name="${OCI_OBJECT_PREFIX%/}/${BACKUP_SET_ID}/postgres.dump.gpg"
upload_succeeded=0

cleanup() {
  local status=$?
  local cleanup_failed=0
  trap - EXIT
  case "$workdir" in
    "${TMP_PARENT%/}"/dusema-backup-set-postgres.*)
      if [[ -d "$workdir" && ! -L "$workdir" ]]; then
        rm -rf -- "$workdir" 2>/dev/null || cleanup_failed=1
      else
        cleanup_failed=1
      fi
      ;;
    *) cleanup_failed=1 ;;
  esac
  if (( cleanup_failed != 0 )); then
    log "ERROR: private temporary cleanup failed"
    if (( status == 0 )); then status=70; fi
  elif (( status == 0 && upload_succeeded != 0 )); then
    log "artifact uploaded: type=postgres backup_set_id=${BACKUP_SET_ID}"
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP
chmod 0700 -- "$workdir" 2>/dev/null || fail 70 "could not restrict temporary directory permissions"

if ! environment_label=$(docker inspect --format '{{index .Config.Labels "dusema.backup.environment"}}' "$PG_CONTAINER" 2>/dev/null) ||
  [[ "$environment_label" != "staging" ]]; then
  fail 64 "PostgreSQL container must be explicitly labeled dusema.backup.environment=staging"
fi
if ! pg_dump_version=$(docker exec --user postgres "$PG_CONTAINER" pg_dump --version 2>/dev/null); then
  fail 20 "staging pg_dump client is unavailable"
fi
case "$pg_dump_version" in
  'pg_dump (PostgreSQL) 17.'*) ;;
  *) fail 20 "staging pg_dump client major version is not PostgreSQL 17" ;;
esac

set +e
docker exec --user postgres "$PG_CONTAINER" pg_dump \
  --format=custom --no-owner --no-privileges --no-password \
  --username "$PG_ROLE" --dbname "$PG_DATABASE" \
  2>"${workdir%/}/pg_dump.stderr" |
  gpg --no-options --homedir "$GNUPGHOME" --batch --no-tty --no-auto-key-retrieve \
    --trust-model always --recipient "${RECOVERY_RECIPIENT_FINGERPRINT}!" \
    --output "$encrypted_file" --encrypt 2>"${workdir%/}/gpg.stderr"
pipeline_status=("${PIPESTATUS[@]}")
set -e
if [[ "${pipeline_status[0]:-1}" != 0 ]]; then
  fail 21 "staging pg_dump failed; no artifact was uploaded"
fi
if [[ "${pipeline_status[1]:-1}" != 0 || ! -s "$encrypted_file" ]]; then
  fail 31 "GPG did not produce a valid PostgreSQL artifact"
fi
if ! checksum_output=$(sha256sum -- "$encrypted_file" 2>/dev/null); then
  fail 40 "could not calculate PostgreSQL artifact SHA-256"
fi
if ! artifact_bytes=$(stat -c '%s' -- "$encrypted_file" 2>/dev/null) ||
  [[ ! "$artifact_bytes" =~ ^[0-9]+$ ]] || (( artifact_bytes < 1 )); then
  fail 40 "PostgreSQL artifact size is invalid"
fi

if ! "$OCI_CLI" os object put \
  --namespace-name "$OCI_NAMESPACE" --bucket-name "$OCI_BUCKET" \
  --region "$OCI_REGION" --profile "$OCI_UPLOAD_PROFILE" \
  --name "$object_name" --file "$encrypted_file" \
  --verify-checksum --no-overwrite \
  >/dev/null 2>"${workdir%/}/oci.stderr"; then
  fail 51 "OCI rejected the PostgreSQL artifact; no completion marker will be published"
fi
upload_succeeded=1
if ! python3 "$MANIFEST_HELPER" record-artifact \
  --set-id "$BACKUP_SET_ID" --prefix "$OCI_OBJECT_PREFIX" --kind postgres \
  --artifact "$encrypted_file" --output "$BACKUP_SET_METADATA_FILE" \
  2>"${workdir%/}/metadata.stderr"; then
  fail 52 "could not record uploaded PostgreSQL artifact metadata"
fi
