#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

log() {
  printf 'dusema-uploads-restore: %s\n' "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

ENCRYPTED_BACKUP_FILE="${ENCRYPTED_BACKUP_FILE:-}"
EXPECTED_CIPHERTEXT_SHA256="${EXPECTED_CIPHERTEXT_SHA256:-}"
RECOVERY_GNUPGHOME="${RECOVERY_GNUPGHOME:-}"
RESTORE_PARENT="${RESTORE_PARENT:-}"
RESTORE_DIR_NAME="${RESTORE_DIR_NAME:-}"
RESTORE_WORK_PARENT="${RESTORE_WORK_PARENT:-${TMPDIR:-/tmp}}"

if [[ -z "$ENCRYPTED_BACKUP_FILE" || -z "$EXPECTED_CIPHERTEXT_SHA256" ||
  -z "$RECOVERY_GNUPGHOME" || -z "$RESTORE_PARENT" || -z "$RESTORE_DIR_NAME" ]]; then
  fail "set ENCRYPTED_BACKUP_FILE, EXPECTED_CIPHERTEXT_SHA256, RECOVERY_GNUPGHOME, RESTORE_PARENT, and RESTORE_DIR_NAME"
fi
if [[ ! "$EXPECTED_CIPHERTEXT_SHA256" =~ ^[[:xdigit:]]{64}$ ]]; then
  fail "expected ciphertext SHA-256 is invalid"
fi
if [[ ! "$RESTORE_DIR_NAME" =~ ^dusema-uploads-restored-[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]]; then
  fail "restore directory name must use the dusema-uploads-restored- prefix"
fi
if [[ ! -f "$ENCRYPTED_BACKUP_FILE" || -L "$ENCRYPTED_BACKUP_FILE" ]]; then
  fail "encrypted uploads artifact must be an existing regular file, not a symbolic link"
fi
if [[ ! -d "$RECOVERY_GNUPGHOME" || -L "$RECOVERY_GNUPGHOME" ]]; then
  fail "recovery GnuPG home must be an existing directory, not a symbolic link"
fi
if [[ ! "$RESTORE_PARENT" = /* || ! -d "$RESTORE_PARENT" || -L "$RESTORE_PARENT" || ! -w "$RESTORE_PARENT" ]]; then
  fail "restore parent must be an existing writable absolute directory, not a symbolic link"
fi
if [[ ! "$RESTORE_WORK_PARENT" = /* || ! -d "$RESTORE_WORK_PARENT" ||
  -L "$RESTORE_WORK_PARENT" || ! -w "$RESTORE_WORK_PARENT" ]]; then
  fail "restore temporary parent must be an existing writable absolute directory, not a symbolic link"
fi

ENCRYPTED_BACKUP_FILE=$(realpath -e -- "$ENCRYPTED_BACKUP_FILE") || fail "could not resolve encrypted uploads artifact"
RECOVERY_GNUPGHOME=$(realpath -e -- "$RECOVERY_GNUPGHOME") || fail "could not resolve recovery GnuPG home"
RESTORE_PARENT=$(realpath -e -- "$RESTORE_PARENT") || fail "could not resolve restore parent"
RESTORE_WORK_PARENT=$(realpath -e -- "$RESTORE_WORK_PARENT") || fail "could not resolve restore temporary parent"
if [[ "$RESTORE_PARENT" == "/" ]]; then
  fail "filesystem root cannot be used as the restore parent"
fi

for directory in "$RESTORE_PARENT" "$RESTORE_WORK_PARENT"; do
  directory_mode=$(stat -c '%a' -- "$directory" 2>/dev/null) || fail "could not inspect restore directory permissions"
  if [[ ! "$directory_mode" =~ ^[0-7]{3,4}$ ]]; then
    fail "restore directory permissions could not be interpreted safely"
  fi
  directory_mode_value=$((8#$directory_mode))
  if (( (directory_mode_value & 0022) != 0 && (directory_mode_value & 01000) == 0 )); then
    fail "restore directories must not be shared-writable without the sticky bit"
  fi
done

for binary in chmod df gpg mkdir mktemp python3 realpath rm sha256sum stat tail tar tr; do
  command -v "$binary" >/dev/null 2>&1 || fail "required executable is unavailable: ${binary}"
done

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P) || fail "could not resolve script directory"
ARCHIVE_HELPER="${SCRIPT_DIR%/}/uploads-archive.py"
if [[ ! -f "$ARCHIVE_HELPER" || -L "$ARCHIVE_HELPER" ]]; then
  fail "uploads archive verifier is unavailable"
fi

require_free_space() {
  local path="$1"
  local required_bytes="$2"
  local available_bytes

  available_bytes=$(df -B1 --output=avail -- "$path" 2>/dev/null | tail -n 1 | tr -d '[:space:]') ||
    fail "could not check available restore disk space"
  if [[ ! "$available_bytes" =~ ^[0-9]+$ ]] ||
    ! python3 - "$required_bytes" "$available_bytes" <<'PY'
import sys
raise SystemExit(int(sys.argv[2]) < int(sys.argv[1]))
PY
  then
    fail "insufficient free disk space for uploads restoration"
  fi
}

WORK_DIR=$(mktemp -d "${RESTORE_WORK_PARENT%/}/dusema-uploads-restore.XXXXXX") || fail "could not create a private restore workspace"
RESTORE_ROOT="${RESTORE_PARENT%/}/${RESTORE_DIR_NAME}"
restore_root_created=0
restore_completed=0

cleanup() {
  local status=$?
  local cleanup_failed=0
  trap - EXIT

  if (( restore_root_created != 0 && restore_completed == 0 )); then
    case "$RESTORE_ROOT" in
      "${RESTORE_PARENT%/}"/dusema-uploads-restored-*)
        if [[ -d "$RESTORE_ROOT" && ! -L "$RESTORE_ROOT" ]]; then
          rm -rf -- "$RESTORE_ROOT" 2>/dev/null || cleanup_failed=1
        else
          cleanup_failed=1
        fi
        ;;
      *) cleanup_failed=1 ;;
    esac
  fi

  case "$WORK_DIR" in
    "${RESTORE_WORK_PARENT%/}"/dusema-uploads-restore.*)
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
chmod 0700 -- "$WORK_DIR" 2>/dev/null || fail "could not restrict restore workspace permissions"

if [[ -e "$RESTORE_ROOT" || -L "$RESTORE_ROOT" ]]; then
  fail "restore destination already exists; existing files were left untouched"
fi
if ! secret_keys=$(gpg --no-options --homedir "$RECOVERY_GNUPGHOME" --batch \
  --with-colons --list-secret-keys 2>/dev/null) || [[ -z "$secret_keys" ]]; then
  fail "recovery GnuPG home does not contain a private key"
fi

if ! checksum_output=$(sha256sum -- "$ENCRYPTED_BACKUP_FILE" 2>/dev/null); then
  fail "could not calculate encrypted uploads SHA-256"
fi
actual_sha256="${checksum_output%% *}"
expected_sha256=$(printf '%s' "$EXPECTED_CIPHERTEXT_SHA256" | tr '[:upper:]' '[:lower:]')
actual_sha256=$(printf '%s' "$actual_sha256" | tr '[:upper:]' '[:lower:]')
if [[ "$actual_sha256" != "$expected_sha256" ]]; then
  fail "encrypted uploads SHA-256 does not match the recorded value"
fi
if ! encrypted_bytes=$(stat -c '%s' -- "$ENCRYPTED_BACKUP_FILE" 2>/dev/null) ||
  [[ ! "$encrypted_bytes" =~ ^[0-9]+$ ]]; then
  fail "encrypted uploads artifact size is invalid"
fi
if ! required_work_bytes=$(python3 - "$encrypted_bytes" <<'PY'
import sys
print(int(sys.argv[1]) + 67108864)
PY
); then
  fail "could not calculate required restore workspace space"
fi
require_free_space "$RESTORE_WORK_PARENT" "$required_work_bytes"
available_work_bytes=$(df -B1 --output=avail -- "$RESTORE_WORK_PARENT" 2>/dev/null | tail -n 1 | tr -d '[:space:]') ||
  fail "could not check available restore workspace space"
if [[ ! "$available_work_bytes" =~ ^[0-9]+$ ]] ||
  ! max_decrypted_archive_bytes=$(python3 - "$available_work_bytes" <<'PY'
import sys
reserve = 67108864
available = int(sys.argv[1])
if available <= reserve:
    raise SystemExit(1)
print(available - reserve)
PY
); then
  fail "insufficient free disk space for a bounded uploads decryption"
fi

log "decrypt: verifying the encrypted artifact and reading it with the recovery key"
if ! gpg --no-options --homedir "$RECOVERY_GNUPGHOME" --batch --no-tty \
  --no-auto-key-retrieve --max-output "$max_decrypted_archive_bytes" \
  --output "${WORK_DIR%/}/uploads.tar" \
  --decrypt "$ENCRYPTED_BACKUP_FILE" 2>"${WORK_DIR%/}/gpg-decrypt.stderr"; then
  fail "GPG could not decrypt the uploads artifact"
fi
if [[ ! -s "${WORK_DIR%/}/uploads.tar" ]]; then
  fail "decryption produced an empty uploads archive"
fi
if ! archive_totals=$(python3 "$ARCHIVE_HELPER" validate "${WORK_DIR%/}/uploads.tar" \
  2>"${WORK_DIR%/}/archive-validation.stderr"); then
  fail "uploads archive failed structural or manifest validation"
fi
archive_bytes="${archive_totals##* bytes=}"
if [[ ! "$archive_bytes" =~ ^[0-9]+$ ]] ||
  ! required_restore_bytes=$(python3 - "$archive_bytes" <<'PY'
import sys
print(int(sys.argv[1]) + 67108864)
PY
); then
  fail "uploads archive returned invalid aggregate totals"
fi
require_free_space "$RESTORE_PARENT" "$required_restore_bytes"

if ! mkdir -m 0700 -- "$RESTORE_ROOT" 2>"${WORK_DIR%/}/restore-directory.stderr"; then
  fail "could not create a new empty restore directory; existing files were left untouched"
fi
restore_root_created=1
if ! tar --extract --file="${WORK_DIR%/}/uploads.tar" --directory="$RESTORE_ROOT" \
  --no-same-owner --no-same-permissions --no-overwrite-dir \
  2>"${WORK_DIR%/}/tar-extract.stderr"; then
  fail "could not extract the validated uploads archive"
fi
if ! restored_totals=$(python3 "$ARCHIVE_HELPER" compare "$RESTORE_ROOT" \
  "${RESTORE_ROOT%/}/.dusema-backup-meta/manifest.tsv" \
  2>"${WORK_DIR%/}/restore-comparison.stderr"); then
  fail "restored uploads do not match the encrypted manifest"
fi
if [[ "$restored_totals" != "$archive_totals" ]]; then
  fail "restored uploads totals do not match the encrypted archive"
fi

restore_completed=1
log "restore complete: directory=${RESTORE_DIR_NAME} ${restored_totals}"
