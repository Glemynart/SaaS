#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Production targets are fixed here. BACKUP_STATE_DIR is a test seam;
# GNUPGHOME is supplied explicitly by systemd for the installed service.
readonly PG_CONTAINER="postgres"
readonly PG_DATABASE="oficina_nitida"
readonly PG_ROLE="oficina"
readonly PG_DUMP_FORMAT="custom"
readonly OCI_NAMESPACE="axfelzrsklz7"
readonly OCI_BUCKET="dusema-backups-prod"
readonly OCI_REGION="sa-bogota-1"
readonly OCI_PREFIX="postgres"
readonly BACKUP_TZ="America/Bogota"
readonly RECIPIENT_FINGERPRINT="409E5155F39E0A78"

STATE_DIR="${BACKUP_STATE_DIR:-/var/lib/dusema-postgres-backup}"
TMP_ROOT="${STATE_DIR%/}/tmp"
GNUPGHOME="${GNUPGHOME:-/home/ubuntu/.gnupg}"
export GNUPGHOME

log() {
  printf 'dusema-postgres-backup: %s\n' "$*"
}

fail() {
  local code="$1"
  shift
  log "ERROR: $*"
  exit "$code"
}

for binary in docker gpg oci date mktemp sha256sum flock mkdir chmod rm; do
  if ! command -v "$binary" >/dev/null 2>&1; then
    fail 64 "required executable is unavailable: ${binary}"
  fi
done

if [[ ! -d "$STATE_DIR" || -L "$STATE_DIR" || ! -w "$STATE_DIR" ]]; then
  fail 64 "systemd state directory is unavailable; run through dusema-postgres-backup.service"
fi

if [[ -L "$TMP_ROOT" ]]; then
  fail 64 "temporary directory must not be a symbolic link"
fi
mkdir -p -- "$TMP_ROOT" 2>/dev/null || fail 70 "could not prepare the temporary directory"
chmod 0700 -- "$TMP_ROOT" 2>/dev/null || fail 70 "could not restrict temporary directory permissions"

# The same lock also protects manual invocations of the script from overlap.
if ! { exec 9>>"${STATE_DIR%/}/backup.lock"; } 2>/dev/null; then
  fail 70 "could not open the backup lock"
fi
if ! flock -n 9 >/dev/null 2>&1; then
  fail 75 "another PostgreSQL backup is already running"
fi

export TZ="$BACKUP_TZ"
timestamp=$(date '+%Y%m%dT%H%M%S%z' 2>/dev/null) || fail 70 "could not determine the backup timestamp"
workdir=$(mktemp -d "${TMP_ROOT%/}/run-${timestamp}.XXXXXX" 2>/dev/null) || fail 70 "could not create a private temporary directory"
encrypted_file="${workdir%/}/postgres.dump.gpg"
upload_succeeded=0

cleanup() {
  local status=$?
  local cleanup_failed=0
  local state_root="${TMP_ROOT%/}"
  trap - EXIT
  if [[ -n "${workdir:-}" && ( -e "$workdir" || -L "$workdir" ) ]]; then
    if [[ "${workdir%/*}" == "$state_root" && "${workdir##*/}" == run-* && -d "$workdir" && ! -L "$workdir" ]]; then
      if ! rm -rf -- "$workdir" 2>/dev/null; then
        cleanup_failed=1
      fi
    else
      cleanup_failed=1
    fi
  fi

  if (( cleanup_failed != 0 )); then
    log "ERROR: temporary cleanup failed (category=temporary_cleanup); original_exit=${status}"
    if (( status == 0 )); then
      status=70
    fi
  elif (( status == 0 && upload_succeeded != 0 )); then
    log "complete: OCI accepted the encrypted object and upload checksum verification passed; temporary files removed"
  fi

  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

log "preflight: checking the PostgreSQL container client"
if ! pg_dump_version=$(docker exec --user postgres "$PG_CONTAINER" pg_dump --version 2>/dev/null); then
  fail 20 "pg_dump is unavailable in the PostgreSQL container"
fi
case "$pg_dump_version" in
  'pg_dump (PostgreSQL) 17.'*) log "preflight: PostgreSQL 17 pg_dump is available" ;;
  *) fail 20 "pg_dump client major version is not PostgreSQL 17" ;;
esac

log "dump: starting a consistent custom-format export"
set +e
docker exec --user postgres "$PG_CONTAINER" pg_dump \
  --format="$PG_DUMP_FORMAT" \
  --no-owner \
  --no-privileges \
  --no-password \
  --username "$PG_ROLE" \
  --dbname "$PG_DATABASE" \
  2>"${workdir%/}/pg_dump.stderr" \
  | gpg \
      --no-options \
      --homedir "$GNUPGHOME" \
      --batch \
      --no-tty \
      --no-auto-key-retrieve \
      --trust-model always \
      --recipient "${RECIPIENT_FINGERPRINT}!" \
      --output "$encrypted_file" \
      --encrypt \
      2>"${workdir%/}/gpg.stderr"
pipeline_status=("${PIPESTATUS[@]}")
set -e

docker_status="${pipeline_status[0]:-1}"
gpg_status="${pipeline_status[1]:-1}"
if (( docker_status != 0 )); then
  fail 21 "pg_dump failed (exit=${docker_status}); encrypted upload skipped"
fi
if (( gpg_status != 0 )); then
  fail 31 "GPG encryption failed (exit=${gpg_status}); upload skipped"
fi
if [[ ! -s "$encrypted_file" ]]; then
  fail 31 "GPG produced an empty encrypted artifact; upload skipped"
fi

if ! checksum_output=$(sha256sum -- "$encrypted_file" 2>/dev/null); then
  fail 40 "could not calculate the encrypted artifact SHA-256; upload skipped"
fi
sha256="${checksum_output%% *}"
if [[ ! "$sha256" =~ ^[[:xdigit:]]{64}$ ]]; then
  fail 40 "encrypted artifact SHA-256 output was invalid; upload skipped"
fi

run_id="${workdir##*/}"
random_suffix="${run_id##*.}"
object_name="${OCI_PREFIX}/dusema-${PG_DATABASE}-${timestamp}-${random_suffix}.dump.gpg"

log "upload: sending encrypted artifact object=${object_name} sha256=${sha256}"
if oci os object put \
  --namespace-name "$OCI_NAMESPACE" \
  --bucket-name "$OCI_BUCKET" \
  --name "$object_name" \
  --file "$encrypted_file" \
  --auth instance_principal \
  --region "$OCI_REGION" \
  --verify-checksum \
  --no-overwrite \
  >/dev/null 2>"${workdir%/}/oci.stderr"; then
  upload_succeeded=1
else
  upload_status=$?
  fail 51 "OCI upload failed (client exit=${upload_status}); detailed CLI response suppressed"
fi
