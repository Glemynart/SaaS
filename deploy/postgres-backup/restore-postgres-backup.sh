#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

log() {
  printf 'dusema-postgres-restore: %s\n' "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

ENCRYPTED_BACKUP_FILE="${ENCRYPTED_BACKUP_FILE:-}"
EXPECTED_CIPHERTEXT_SHA256="${EXPECTED_CIPHERTEXT_SHA256:-}"
RECOVERY_GNUPGHOME="${RECOVERY_GNUPGHOME:-}"
RESTORE_CONTAINER_ID="${RESTORE_CONTAINER_ID:-}"
RESTORE_DATABASE="${RESTORE_DATABASE:-}"
RESTORE_TMP_ROOT="${RESTORE_TMP_ROOT:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}}"

if [[ -z "$ENCRYPTED_BACKUP_FILE" || -z "$EXPECTED_CIPHERTEXT_SHA256" || -z "$RECOVERY_GNUPGHOME" || -z "$RESTORE_CONTAINER_ID" || -z "$RESTORE_DATABASE" ]]; then
  fail "set ENCRYPTED_BACKUP_FILE, EXPECTED_CIPHERTEXT_SHA256, RECOVERY_GNUPGHOME, RESTORE_CONTAINER_ID, and RESTORE_DATABASE"
fi
if [[ ! "$EXPECTED_CIPHERTEXT_SHA256" =~ ^[[:xdigit:]]{64}$ ]]; then
  fail "expected ciphertext SHA-256 is invalid"
fi
if [[ ! "$RESTORE_CONTAINER_ID" =~ ^[[:xdigit:]]{12,64}$ ]]; then
  fail "restore target container ID is invalid"
fi
if [[ ! "$RESTORE_DATABASE" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ || "$RESTORE_DATABASE" != dusema_recovery_* ]]; then
  fail "restore database must use the dusema_recovery_ prefix and a valid PostgreSQL identifier"
fi
if [[ ! -f "$ENCRYPTED_BACKUP_FILE" || -L "$ENCRYPTED_BACKUP_FILE" ]]; then
  fail "encrypted backup must be an existing regular file, not a symbolic link"
fi
if [[ ! -d "$RECOVERY_GNUPGHOME" || -L "$RECOVERY_GNUPGHOME" ]]; then
  fail "recovery GPG home must be an existing directory, not a symbolic link"
fi
if [[ ! -d "$RESTORE_TMP_ROOT" || -L "$RESTORE_TMP_ROOT" || ! -w "$RESTORE_TMP_ROOT" ]]; then
  fail "restore temporary root must be an existing writable directory, not a symbolic link"
fi

ENCRYPTED_BACKUP_FILE=$(realpath -e -- "$ENCRYPTED_BACKUP_FILE") || fail "could not resolve encrypted backup path"
RECOVERY_GNUPGHOME=$(realpath -e -- "$RECOVERY_GNUPGHOME") || fail "could not resolve recovery GPG home"
RESTORE_TMP_ROOT=$(realpath -e -- "$RESTORE_TMP_ROOT") || fail "could not resolve restore temporary root"

for binary in docker gpg mktemp realpath rm sha256sum sleep tr; do
  command -v "$binary" >/dev/null 2>&1 || fail "required executable is unavailable: ${binary}"
done

if ! image=$(docker inspect --format '{{.Config.Image}}' "$RESTORE_CONTAINER_ID" 2>/dev/null) || [[ "$image" != "postgres:17" ]]; then
  fail "restore target must use the postgres:17 image"
fi
if ! running=$(docker inspect --format '{{.State.Running}}' "$RESTORE_CONTAINER_ID" 2>/dev/null) || [[ "$running" != "true" ]]; then
  fail "restore target container is not running"
fi
if ! network_mode=$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$RESTORE_CONTAINER_ID" 2>/dev/null) || [[ "$network_mode" != "none" ]]; then
  fail "restore target must have Docker network mode none"
fi
if ! port_bindings=$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$RESTORE_CONTAINER_ID" 2>/dev/null) || [[ "$port_bindings" != "null" && "$port_bindings" != "{}" ]]; then
  fail "restore target must not publish host ports"
fi
if ! target_label=$(docker inspect --format '{{index .Config.Labels "dusema.recovery"}}' "$RESTORE_CONTAINER_ID" 2>/dev/null) || [[ "$target_label" != "isolated" ]]; then
  fail "restore target is not labeled dusema.recovery=isolated"
fi
if ! mount_types=$(docker inspect --format '{{range .Mounts}}{{.Type}} {{end}}' "$RESTORE_CONTAINER_ID" 2>/dev/null); then
  fail "could not inspect restore target mounts"
fi
if [[ " $mount_types " == *" bind "* ]]; then
  fail "restore target must not have host bind mounts"
fi
target_ready=false
for attempt in {1..30}; do
  if docker exec "$RESTORE_CONTAINER_ID" pg_isready --username postgres --dbname postgres >/dev/null 2>&1; then
    target_ready=true
    break
  fi
  sleep 1
done
if [[ "$target_ready" != true ]]; then
  fail "isolated PostgreSQL restore target is not ready"
fi
if ! server_version=$(docker exec "$RESTORE_CONTAINER_ID" psql --no-psqlrc --quiet --tuples-only --no-align \
  --username postgres --dbname postgres --command 'SHOW server_version_num;' 2>/dev/null) || [[ "$server_version" != 17* ]]; then
  fail "restore target is not running PostgreSQL 17"
fi

WORK_DIR=$(mktemp -d "${RESTORE_TMP_ROOT%/}/dusema-postgres-restore.XXXXXX") || fail "could not create a private restore directory"
database_created=0
restore_completed=0

cleanup() {
  local status=$?
  local cleanup_failed=0
  trap - EXIT

  if (( database_created != 0 && restore_completed == 0 )); then
    if ! docker exec "$RESTORE_CONTAINER_ID" dropdb --if-exists --username postgres "$RESTORE_DATABASE" >/dev/null 2>&1; then
      cleanup_failed=1
    fi
  fi

  case "$WORK_DIR" in
    "${RESTORE_TMP_ROOT%/}"/dusema-postgres-restore.*)
      if [[ -d "$WORK_DIR" && ! -L "$WORK_DIR" ]]; then
        rm -rf -- "$WORK_DIR" 2>/dev/null || cleanup_failed=1
      else
        cleanup_failed=1
      fi
      ;;
    *) cleanup_failed=1 ;;
  esac

  if (( cleanup_failed != 0 )); then
    log "ERROR: private restore cleanup failed"
    if (( status == 0 )); then status=1; fi
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

if ! gpg --no-options --homedir "$RECOVERY_GNUPGHOME" --batch --with-colons --list-secret-keys \
  >"${WORK_DIR%/}/secret-keys" 2>/dev/null || [[ ! -s "${WORK_DIR%/}/secret-keys" ]]; then
  fail "recovery GPG home does not contain a usable private key"
fi

if ! checksum_output=$(sha256sum -- "$ENCRYPTED_BACKUP_FILE" 2>/dev/null); then
  fail "could not calculate encrypted backup SHA-256"
fi
actual_sha256="${checksum_output%% *}"
expected_sha256=$(printf '%s' "$EXPECTED_CIPHERTEXT_SHA256" | tr '[:upper:]' '[:lower:]')
actual_sha256=$(printf '%s' "$actual_sha256" | tr '[:upper:]' '[:lower:]')
if [[ "$actual_sha256" != "$expected_sha256" ]]; then
  fail "encrypted backup SHA-256 does not match the recorded value"
fi

dump_file="${WORK_DIR%/}/postgres.dump"
log "decrypt: verifying the encrypted artifact and reading it with the recovery key"
if ! gpg --no-options --homedir "$RECOVERY_GNUPGHOME" --batch --no-tty --no-auto-key-retrieve \
  --output "$dump_file" --decrypt "$ENCRYPTED_BACKUP_FILE" 2>"${WORK_DIR%/}/gpg-decrypt.stderr"; then
  fail "GPG could not decrypt the backup"
fi
if [[ ! -s "$dump_file" ]]; then
  fail "decryption produced an empty PostgreSQL archive"
fi

log "restore: creating a new database in the isolated PostgreSQL 17 container"
if ! docker exec "$RESTORE_CONTAINER_ID" createdb --username postgres --template template0 "$RESTORE_DATABASE" \
  >/dev/null 2>"${WORK_DIR%/}/createdb.stderr"; then
  fail "could not create the new recovery database; existing databases were left untouched"
fi
database_created=1

if docker exec -i "$RESTORE_CONTAINER_ID" pg_restore \
  --username postgres \
  --dbname "$RESTORE_DATABASE" \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  --single-transaction \
  <"$dump_file" >/dev/null 2>"${WORK_DIR%/}/pg_restore.stderr"; then
  :
else
  restore_status=$?
  fail "PostgreSQL restore failed (exit=${restore_status}); partial recovery database will be removed"
fi

if ! table_count=$(docker exec "$RESTORE_CONTAINER_ID" psql --no-psqlrc --quiet --tuples-only --no-align \
  --username postgres --dbname "$RESTORE_DATABASE" \
  --command "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema');" \
  2>"${WORK_DIR%/}/table-count.stderr"); then
  fail "could not verify restored table count"
fi
if [[ ! "$table_count" =~ ^[0-9]+$ ]] || (( table_count < 1 )); then
  fail "restored database contains no user tables"
fi
if ! database_size=$(docker exec "$RESTORE_CONTAINER_ID" psql --no-psqlrc --quiet --tuples-only --no-align \
  --username postgres --dbname "$RESTORE_DATABASE" \
  --command 'SELECT pg_database_size(current_database());' 2>"${WORK_DIR%/}/database-size.stderr"); then
  fail "could not verify restored database size"
fi
if [[ ! "$database_size" =~ ^[0-9]+$ ]] || (( database_size < 1 )); then
  fail "restored database size is invalid"
fi

restore_completed=1
log "PASS: restored database=${RESTORE_DATABASE} user_tables=${table_count} size_bytes=${database_size} container=${RESTORE_CONTAINER_ID:0:12}"
