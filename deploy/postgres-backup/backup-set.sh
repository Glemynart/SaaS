#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

log() {
  printf 'dusema-backup-set: %s\n' "$*"
}

fail() {
  local code="$1"
  shift
  log "ERROR: $*"
  exit "$code"
}

BACKUP_SET_ENVIRONMENT="${BACKUP_SET_ENVIRONMENT:-}"
BACKUP_SET_ISOLATED_CONFIRMED="${BACKUP_SET_ISOLATED_CONFIRMED:-}"
UPLOADS_QUIESCED="${UPLOADS_QUIESCED:-}"
BACKUP_SET_APPLICATION_REVISION="${BACKUP_SET_APPLICATION_REVISION:-}"
BACKUP_SET_STORAGE_PROVIDER="${BACKUP_SET_STORAGE_PROVIDER:-}"
BACKUP_SET_PG_CONTAINER="${BACKUP_SET_PG_CONTAINER:-}"
BACKUP_SET_PG_DATABASE="${BACKUP_SET_PG_DATABASE:-}"
BACKUP_SET_PG_ROLE="${BACKUP_SET_PG_ROLE:-}"
UPLOADS_ROOT="${UPLOADS_ROOT:-}"
TMP_PARENT="${TMP_PARENT:-}"
GNUPGHOME="${GNUPGHOME:-}"
RECOVERY_RECIPIENT_FINGERPRINT="${RECOVERY_RECIPIENT_FINGERPRINT:-}"
OCI_NAMESPACE="${OCI_NAMESPACE:-}"
OCI_BUCKET="${OCI_BUCKET:-}"
OCI_REGION="${OCI_REGION:-}"
OCI_OBJECT_PREFIX="${OCI_OBJECT_PREFIX:-}"
OCI_UPLOAD_PROFILE="${OCI_UPLOAD_PROFILE:-}"
OCI_CLI="${OCI_CLI:-oci}"
BACKUP_SET_ID=""
BACKUP_SET_WORK_PARENT="${BACKUP_SET_WORK_PARENT:-${TMP_PARENT:-}}"

if [[ "$BACKUP_SET_ENVIRONMENT" != "staging" || "$BACKUP_SET_ISOLATED_CONFIRMED" != "true" || "$UPLOADS_QUIESCED" != "true" ]]; then
  fail 64 "backup sets require isolated staging and an operator-confirmed write barrier"
fi
if [[ -z "$BACKUP_SET_APPLICATION_REVISION" || ! "$BACKUP_SET_APPLICATION_REVISION" =~ ^[[:xdigit:]]{7,40}$ ||
  -z "$BACKUP_SET_STORAGE_PROVIDER" || ! "$BACKUP_SET_STORAGE_PROVIDER" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]]; then
  fail 64 "application revision and storage provider reference are required"
fi
if [[ -z "$BACKUP_SET_PG_CONTAINER" || -z "$BACKUP_SET_PG_DATABASE" || -z "$BACKUP_SET_PG_ROLE" ||
  -z "$UPLOADS_ROOT" || -z "$TMP_PARENT" || -z "$GNUPGHOME" ||
  -z "$RECOVERY_RECIPIENT_FINGERPRINT" || -z "$OCI_NAMESPACE" || -z "$OCI_BUCKET" ||
  -z "$OCI_REGION" || -z "$OCI_UPLOAD_PROFILE" ]]; then
  fail 64 "staging database, uploads, encryption, and object-storage settings are required"
fi
if [[ "$OCI_OBJECT_PREFIX" != "backup-sets" || "$OCI_BUCKET" == "dusema-backups-prod" || "$OCI_BUCKET" != *staging* ||
  ! "$OCI_NAMESPACE" =~ ^[A-Za-z0-9-]{1,64}$ || ! "$OCI_BUCKET" =~ ^[A-Za-z0-9._-]{1,255}$ ||
  ! "$OCI_REGION" =~ ^[A-Za-z0-9-]{1,64}$ || ! "$OCI_UPLOAD_PROFILE" =~ ^[A-Za-z0-9._-]{1,64}$ ]]; then
  fail 64 "coordinated backup destination is invalid or points to the production backup bucket"
fi
if [[ ! "$BACKUP_SET_WORK_PARENT" = /* || ! -d "$BACKUP_SET_WORK_PARENT" ||
  -L "$BACKUP_SET_WORK_PARENT" || ! -w "$BACKUP_SET_WORK_PARENT" ]]; then
  fail 64 "backup set work parent must be an existing writable absolute directory"
fi
if [[ ! -d "$GNUPGHOME" || -L "$GNUPGHOME" || ! -d "$TMP_PARENT" || -L "$TMP_PARENT" ]]; then
  fail 64 "temporary and GPG directories must exist and must not be symbolic links"
fi
if [[ ! "$RECOVERY_RECIPIENT_FINGERPRINT" =~ ^[[:xdigit:]]{40,64}$ ]]; then
  fail 64 "recovery recipient fingerprint is invalid"
fi
for binary in bash chmod date docker env gpg mktemp od python3 realpath rm sha256sum stat tr; do
  command -v "$binary" >/dev/null 2>&1 || fail 64 "required executable is unavailable: ${binary}"
done
command -v "$OCI_CLI" >/dev/null 2>&1 || fail 64 "OCI CLI is unavailable"

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P) || fail 64 "could not resolve script directory"
POSTGRES_BACKUP_SCRIPT="${SCRIPT_DIR%/}/backup-set-postgres-artifact.sh"
UPLOADS_BACKUP_SCRIPT="${SCRIPT_DIR%/}/backup-uploads-artifact.sh"
MANIFEST_HELPER="${SCRIPT_DIR%/}/backup-set-manifest.py"
for required_file in "$POSTGRES_BACKUP_SCRIPT" "$UPLOADS_BACKUP_SCRIPT" "$MANIFEST_HELPER"; do
  if [[ ! -f "$required_file" || -L "$required_file" ]]; then
    fail 64 "a coordinated backup component is unavailable"
  fi
done

TMP_PARENT=$(realpath -e -- "$TMP_PARENT") || fail 64 "could not resolve temporary parent"
BACKUP_SET_WORK_PARENT=$(realpath -e -- "$BACKUP_SET_WORK_PARENT") || fail 64 "could not resolve backup set work parent"
GNUPGHOME=$(realpath -e -- "$GNUPGHOME") || fail 64 "could not resolve GPG home"
timestamp=$(date -u '+%Y%m%dT%H%M%SZ') || fail 70 "could not determine a UTC timestamp"
random_suffix=$(od -An -N8 -tx1 /dev/urandom 2>/dev/null | tr -d '[:space:]') || fail 70 "could not generate a unique backup set ID"
BACKUP_SET_ID="${timestamp}-${random_suffix}"
if [[ ! "$BACKUP_SET_ID" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{16}$ ]]; then
  fail 70 "generated backup set ID is invalid"
fi
capture_started=$(date -u '+%Y-%m-%dT%H:%M:%SZ') || fail 70 "could not record capture start time"

workdir=$(mktemp -d "${BACKUP_SET_WORK_PARENT%/}/dusema-backup-set.XXXXXX") || fail 70 "could not create a private backup set workspace"
completed=0
cleanup() {
  local status=$?
  local cleanup_failed=0
  trap - EXIT
  case "$workdir" in
    "${BACKUP_SET_WORK_PARENT%/}"/dusema-backup-set.*)
      if [[ -d "$workdir" && ! -L "$workdir" ]]; then
        rm -rf -- "$workdir" 2>/dev/null || cleanup_failed=1
      else
        cleanup_failed=1
      fi
      ;;
    *) cleanup_failed=1 ;;
  esac
  if (( cleanup_failed != 0 )); then
    if (( completed != 0 )); then
      log "ERROR: marker was uploaded but private workspace cleanup failed backup_set_id=${BACKUP_SET_ID} manifest_sha256=${manifest_sha256}"
    else
      log "ERROR: private backup set workspace cleanup failed before marker publication"
    fi
    if (( status == 0 )); then status=70; fi
  elif (( status == 0 && completed != 0 )); then
    log "complete: backup set marker published backup_set_id=${BACKUP_SET_ID} manifest_sha256=${manifest_sha256} manifest_bytes=${manifest_bytes}"
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP
chmod 0700 -- "$workdir" 2>/dev/null || fail 70 "could not restrict backup set workspace permissions"

common_env=(
  "BACKUP_SET_ID=$BACKUP_SET_ID"
  "BACKUP_SET_ENVIRONMENT=staging"
  "BACKUP_SET_ISOLATED_CONFIRMED=true"
  "BACKUP_SET_WRITES_QUIESCED=true"
  "BACKUP_SET_PG_CONTAINER=$BACKUP_SET_PG_CONTAINER"
  "BACKUP_SET_PG_DATABASE=$BACKUP_SET_PG_DATABASE"
  "BACKUP_SET_PG_ROLE=$BACKUP_SET_PG_ROLE"
  "BACKUP_SET_TMP_PARENT=$TMP_PARENT"
  "GNUPGHOME=$GNUPGHOME"
  "RECOVERY_RECIPIENT_FINGERPRINT=$RECOVERY_RECIPIENT_FINGERPRINT"
  "OCI_NAMESPACE=$OCI_NAMESPACE"
  "OCI_BUCKET=$OCI_BUCKET"
  "OCI_REGION=$OCI_REGION"
  "OCI_OBJECT_PREFIX=$OCI_OBJECT_PREFIX"
  "OCI_UPLOAD_PROFILE=$OCI_UPLOAD_PROFILE"
  "OCI_CLI=$OCI_CLI"
)

log "capture: starting PostgreSQL artifact for staging backup set"
if ! env "${common_env[@]}" "BACKUP_SET_METADATA_FILE=${workdir%/}/postgres.json" \
  bash "$POSTGRES_BACKUP_SCRIPT"; then
  fail 21 "PostgreSQL artifact failed; no completion marker was published"
fi

log "capture: starting uploads artifact for staging backup set"
if ! env "${common_env[@]}" \
  "UPLOADS_ROOT=$UPLOADS_ROOT" "UPLOADS_QUIESCED=true" "TMP_PARENT=$TMP_PARENT" \
  "BACKUP_SET_METADATA_FILE=${workdir%/}/uploads.json" \
  bash "$UPLOADS_BACKUP_SCRIPT"; then
  fail 22 "uploads artifact failed; no completion marker was published"
fi

capture_completed=$(date -u '+%Y-%m-%dT%H:%M:%SZ') || fail 70 "could not record capture completion time"
manifest_file="${workdir%/}/manifest.json"
encrypted_manifest="${workdir%/}/manifest.json.gpg"
manifest_object="${OCI_OBJECT_PREFIX%/}/${BACKUP_SET_ID}/manifest.json.gpg"
if ! python3 "$MANIFEST_HELPER" create \
  --set-id "$BACKUP_SET_ID" --prefix "$OCI_OBJECT_PREFIX" \
  --environment staging --started-at "$capture_started" --completed-at "$capture_completed" \
  --application-revision "${BACKUP_SET_APPLICATION_REVISION,,}" \
  --storage-provider "$BACKUP_SET_STORAGE_PROVIDER" \
  --namespace "$OCI_NAMESPACE" --bucket "$OCI_BUCKET" --region "$OCI_REGION" \
  --postgres-metadata "${workdir%/}/postgres.json" \
  --uploads-metadata "${workdir%/}/uploads.json" --output "$manifest_file" \
  2>"${workdir%/}/manifest.stderr"; then
  fail 31 "could not create the coordinated backup set manifest"
fi
if ! gpg --no-options --homedir "$GNUPGHOME" --batch --no-tty --no-auto-key-retrieve \
  --compress-algo none --trust-model always \
  --recipient "${RECOVERY_RECIPIENT_FINGERPRINT}!" \
  --output "$encrypted_manifest" --encrypt "$manifest_file" \
  2>"${workdir%/}/manifest-gpg.stderr" || [[ ! -s "$encrypted_manifest" ]]; then
  fail 32 "could not encrypt the coordinated backup set manifest"
fi
if ! manifest_checksum_output=$(sha256sum -- "$encrypted_manifest" 2>/dev/null); then
  fail 32 "could not calculate the encrypted completion marker SHA-256"
fi
manifest_sha256="${manifest_checksum_output%% *}"
if [[ ! "$manifest_sha256" =~ ^[[:xdigit:]]{64}$ ]] ||
  ! manifest_bytes=$(stat -c '%s' -- "$encrypted_manifest" 2>/dev/null) ||
  [[ ! "$manifest_bytes" =~ ^[0-9]+$ ]] || (( manifest_bytes < 1 )); then
  fail 32 "encrypted completion marker metadata is invalid"
fi
if ! "$OCI_CLI" os object put \
  --namespace-name "$OCI_NAMESPACE" --bucket-name "$OCI_BUCKET" \
  --region "$OCI_REGION" --profile "$OCI_UPLOAD_PROFILE" \
  --name "$manifest_object" --file "$encrypted_manifest" \
  --verify-checksum --no-overwrite \
  >/dev/null 2>"${workdir%/}/manifest-oci.stderr"; then
  fail 33 "OCI did not confirm completion marker publication; verify the object before treating the set as complete"
fi
completed=1
