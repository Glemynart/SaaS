#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
BACKUP_SCRIPT="${SCRIPT_DIR}/backup-postgres.sh"
REAL_RM=$(command -v rm)
TEST_ROOT=$(mktemp -d)
MOCK_BIN="${TEST_ROOT}/bin"
MOCK_CALLS="${TEST_ROOT}/calls"
mkdir -p -- "$MOCK_BIN" "$MOCK_CALLS"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

cat >"${MOCK_BIN}/docker" <<'MOCK_DOCKER'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' called >>"${MOCK_CALLS}/docker"
args=("$@")
if [[ "${args[-1]:-}" == "--version" ]]; then
  expected=(exec --user postgres postgres pg_dump --version)
  [[ "${#args[@]}" -eq "${#expected[@]}" ]]
  for index in "${!expected[@]}"; do [[ "${args[$index]}" == "${expected[$index]}" ]]; done
  printf 'pg_dump (PostgreSQL) 17.10\n'
  exit 0
fi

expected=(exec --user postgres postgres pg_dump --format=custom --no-owner --no-privileges --no-password --username oficina --dbname oficina_nitida)
[[ "${#args[@]}" -eq "${#expected[@]}" ]]
for index in "${!expected[@]}"; do [[ "${args[$index]}" == "${expected[$index]}" ]]; done
if [[ "${MOCK_DOCKER_FAIL:-0}" == "1" ]]; then
  printf 'DOCKER_ERROR_MARKER_MUST_NOT_REACH_LOG\n' >&2
  exit 23
fi
printf 'DUMP_CONTENT_MARKER_MUST_NOT_REACH_LOG\n'
MOCK_DOCKER

cat >"${MOCK_BIN}/gpg" <<'MOCK_GPG'
#!/usr/bin/env bash
set -Eeuo pipefail
args=("$@")
expected=(--no-options --homedir "$GNUPGHOME" --batch --no-tty --no-auto-key-retrieve --trust-model always --recipient 409E5155F39E0A78! --output)
[[ "${#args[@]}" -eq "$((${#expected[@]} + 2))" ]]
for index in "${!expected[@]}"; do [[ "${args[$index]}" == "${expected[$index]}" ]]; done
output_file="${args[-2]}"
[[ "${args[-1]}" == "--encrypt" ]]
[[ "$output_file" == */tmp/run-*/postgres.dump.gpg ]]
if [[ "${MOCK_GPG_FAIL:-0}" == "1" ]]; then
  cat >/dev/null
  printf 'GPG_ERROR_MARKER_MUST_NOT_REACH_LOG\n' >&2
  printf 'partial-encrypted-artifact' >"$output_file"
  exit 33
fi
cat >"$output_file"
MOCK_GPG

cat >"${MOCK_BIN}/oci" <<'MOCK_OCI'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${1:-}" == "os" && "${2:-}" == "object" && "${3:-}" == "put" ]]
args=("$@")
shift 3
namespace=""
bucket=""
region=""
object_name=""
artifact=""
has_instance_principal=0
has_checksum=0
has_no_overwrite=0
while (($#)); do
  case "$1" in
    --namespace-name) namespace="$2"; shift 2 ;;
    --bucket-name) bucket="$2"; shift 2 ;;
    --region) region="$2"; shift 2 ;;
    --name) object_name="$2"; shift 2 ;;
    --file) artifact="$2"; shift 2 ;;
    --auth)
      [[ "$2" == "instance_principal" ]]
      has_instance_principal=1
      shift 2
      ;;
    --verify-checksum) has_checksum=1; shift ;;
    --no-overwrite) has_no_overwrite=1; shift ;;
    *) exit 94 ;;
  esac
done
[[ "$namespace" == "axfelzrsklz7" ]]
[[ "$bucket" == "dusema-backups-prod" ]]
[[ "$region" == "sa-bogota-1" ]]
[[ "$object_name" == postgres/dusema-oficina_nitida-*.dump.gpg ]]
[[ "$artifact" == */tmp/run-*/postgres.dump.gpg && -s "$artifact" ]]
[[ "$has_instance_principal" == 1 && "$has_checksum" == 1 ]]
printf '%s\n' called >>"${MOCK_CALLS}/oci"
if [[ "${MOCK_OCI_CONFLICT:-0}" == "1" ]]; then
  if [[ "$has_no_overwrite" != 1 ]]; then
    printf 'overwritten\n' >"$MOCK_REMOTE_MARKER"
    exit 0
  fi
  printf 'OCI_CONFLICT_MARKER_MUST_NOT_REACH_LOG\n' >&2
  exit 17
fi
[[ "$has_no_overwrite" == 1 ]]
if [[ "${MOCK_OCI_FAIL:-0}" == "1" ]]; then
  printf 'OCI_ERROR_MARKER_MUST_NOT_REACH_LOG\n' >&2
  exit 37
fi
printf 'mock-etag\n'
MOCK_OCI

cat >"${MOCK_BIN}/flock" <<'MOCK_FLOCK'
#!/usr/bin/env bash
if [[ "${MOCK_LOCK_FAIL:-0}" == "1" ]]; then
  exit 1
fi
exit 0
MOCK_FLOCK

cat >"${MOCK_BIN}/chmod" <<'MOCK_CHMOD'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${1:-}" == "0700" ]]
if [[ "${MOCK_CHMOD_FAIL:-0}" == "1" ]]; then
  printf 'CHMOD_ERROR_MARKER_MUST_NOT_REACH_LOG\n' >&2
  exit 41
fi
printf '%s\n' called >>"${MOCK_CALLS}/chmod"
MOCK_CHMOD

cat >"${MOCK_BIN}/mkdir" <<'MOCK_MKDIR'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${1:-}" == "-p" ]]
if [[ "${MOCK_MKDIR_FAIL:-0}" == "1" ]]; then
  printf 'MKDIR_ERROR_MARKER_MUST_NOT_REACH_LOG\n' >&2
  exit 42
fi
printf '%s\n' called >>"${MOCK_CALLS}/mkdir"
MOCK_MKDIR

cat >"${MOCK_BIN}/rm" <<'MOCK_RM'
#!/usr/bin/env bash
set -Eeuo pipefail
args=("$@")
[[ "${#args[@]}" -eq 3 && "${args[0]}" == "-rf" && "${args[1]}" == "--" ]]
[[ "${args[2]}" == */tmp/run-* ]]
if [[ "${MOCK_RM_FAIL:-0}" == "1" && "${*: -1}" == */tmp/run-* ]]; then
  printf 'RM_ERROR_MARKER_MUST_NOT_REACH_LOG\n' >&2
  exit 91
fi
exec "$REAL_RM" "$@"
MOCK_RM

chmod +x -- "$MOCK_BIN/docker" "$MOCK_BIN/gpg" "$MOCK_BIN/oci" "$MOCK_BIN/flock" "$MOCK_BIN/chmod" "$MOCK_BIN/mkdir" "$MOCK_BIN/rm"

fail_test() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

count_calls() {
  local file="$1"
  if [[ -f "$file" ]]; then
    wc -l <"$file"
  else
    printf '0\n'
  fi
}

run_case() {
  local case_name="$1"
  local expected_status="$2"
  local docker_fail="$3"
  local gpg_fail="$4"
  local oci_fail="$5"
  local lock_fail="$6"
  local rm_fail="$7"
  local oci_conflict="$8"
  local expected_leftovers="$9"
  local expected_docker_delta="${10}"
  local expected_oci_delta="${11}"
  local mkdir_fail="${12:-0}"
  local chmod_fail="${13:-0}"
  local state_dir="${TEST_ROOT}/state-${case_name}"
  local remote_marker="${state_dir}/remote-object.marker"
  mkdir -p -- "$state_dir" "${state_dir}/tmp"
  printf 'pre-existing artifact must survive\n' >"${state_dir}/pre-existing.backup"
  printf 'pre-existing remote marker must survive\n' >"$remote_marker"

  local docker_before oci_before docker_after oci_after output status leftover_count
  docker_before=$(count_calls "${MOCK_CALLS}/docker")
  oci_before=$(count_calls "${MOCK_CALLS}/oci")
  set +e
  output=$(PATH="${MOCK_BIN}:$PATH" \
    BACKUP_STATE_DIR="$state_dir" \
    GNUPGHOME="${TEST_ROOT}/mock-gnupg" \
    MOCK_CALLS="$MOCK_CALLS" \
    REAL_RM="$REAL_RM" \
    MOCK_DOCKER_FAIL="$docker_fail" \
    MOCK_GPG_FAIL="$gpg_fail" \
    MOCK_OCI_FAIL="$oci_fail" \
    MOCK_OCI_CONFLICT="$oci_conflict" \
    MOCK_LOCK_FAIL="$lock_fail" \
    MOCK_RM_FAIL="$rm_fail" \
    MOCK_MKDIR_FAIL="$mkdir_fail" \
    MOCK_CHMOD_FAIL="$chmod_fail" \
    MOCK_REMOTE_MARKER="$remote_marker" \
    "$BACKUP_SCRIPT" 2>&1)
  status=$?
  set -e

  if [[ "$status" != "$expected_status" ]]; then
    fail_test "${case_name}: expected exit ${expected_status}, got ${status}; output: ${output}"
  fi
  if [[ "$output" == *"MARKER_MUST_NOT_REACH_LOG"* || "$output" == *"DUMP_CONTENT_MARKER_MUST_NOT_REACH_LOG"* ]]; then
    fail_test "${case_name}: mock payload, raw tool error, or cleanup error reached logs"
  fi
  if [[ "$status" != 0 && "$output" == *"complete:"* ]]; then
    fail_test "${case_name}: completion event logged for a failed execution"
  fi
  if [[ "$(cat "${state_dir}/pre-existing.backup")" != 'pre-existing artifact must survive' ]]; then
    fail_test "${case_name}: pre-existing local artifact changed"
  fi
  if [[ "$(cat "$remote_marker")" != 'pre-existing remote marker must survive' ]]; then
    fail_test "${case_name}: pre-existing remote object marker changed"
  fi
  leftover_count=$(find "${state_dir}/tmp" -mindepth 1 -maxdepth 1 -print | wc -l)
  if [[ "$leftover_count" -ne "$expected_leftovers" ]]; then
    fail_test "${case_name}: expected ${expected_leftovers} temporary directories, found ${leftover_count}"
  fi
  docker_after=$(count_calls "${MOCK_CALLS}/docker")
  oci_after=$(count_calls "${MOCK_CALLS}/oci")
  if (( docker_after - docker_before != expected_docker_delta )); then
    fail_test "${case_name}: expected ${expected_docker_delta} Docker calls, got $((docker_after - docker_before))"
  fi
  if (( oci_after - oci_before != expected_oci_delta )); then
    fail_test "${case_name}: expected ${expected_oci_delta} OCI calls, got $((oci_after - oci_before))"
  fi
  printf '%s\n' "$output" >"${TEST_ROOT}/${case_name}.log"
  printf 'PASS: %s exits %s; temp dirs=%s; existing artifacts preserved\n' "$case_name" "$status" "$leftover_count"
}

run_case success 0 0 0 0 0 0 0 0 2 1
grep -q 'complete: OCI accepted the encrypted object and upload checksum verification passed; temporary files removed' "${TEST_ROOT}/success.log" || fail_test 'success: missing post-cleanup completion event'

run_case lock-failure 75 0 0 0 1 0 0 0 0 0
grep -q 'another PostgreSQL backup is already running' "${TEST_ROOT}/lock-failure.log" || fail_test 'lock-failure: missing sanitized category'

run_case mkdir-failure 70 0 0 0 0 0 0 0 0 0 1 0
grep -q 'could not prepare the temporary directory' "${TEST_ROOT}/mkdir-failure.log" || fail_test 'mkdir-failure: missing sanitized category'

run_case chmod-failure 70 0 0 0 0 0 0 0 0 0 0 1
grep -q 'could not restrict temporary directory permissions' "${TEST_ROOT}/chmod-failure.log" || fail_test 'chmod-failure: missing sanitized category'

run_case dump-failure 21 1 0 0 0 0 0 0 2 0
grep -q 'pg_dump failed' "${TEST_ROOT}/dump-failure.log" || fail_test 'dump-failure: missing sanitized failure category'

run_case gpg-failure 31 0 1 0 0 0 0 0 2 0
grep -q 'GPG encryption failed' "${TEST_ROOT}/gpg-failure.log" || fail_test 'gpg-failure: missing sanitized failure category'

run_case oci-failure 51 0 0 1 0 0 0 0 2 1
grep -q 'OCI upload failed' "${TEST_ROOT}/oci-failure.log" || fail_test 'oci-failure: missing sanitized failure category'

run_case no-overwrite-conflict 51 0 0 0 0 0 1 0 2 1
grep -q 'OCI upload failed' "${TEST_ROOT}/no-overwrite-conflict.log" || fail_test 'conflict: missing sanitized failure category'
if grep -q 'complete:' "${TEST_ROOT}/no-overwrite-conflict.log"; then fail_test 'conflict: completion event must not be logged'; fi

run_case cleanup-failure-after-success 70 0 0 0 0 1 0 1 2 1
grep -q 'temporary cleanup failed (category=temporary_cleanup); original_exit=0' "${TEST_ROOT}/cleanup-failure-after-success.log" || fail_test 'cleanup success-path failure: missing sanitized cleanup event'
if grep -q 'complete:' "${TEST_ROOT}/cleanup-failure-after-success.log"; then fail_test 'cleanup success-path failure: completion must not be logged'; fi

run_case cleanup-failure-after-dump-error 21 1 0 0 0 1 0 1 2 0
grep -q 'pg_dump failed' "${TEST_ROOT}/cleanup-failure-after-dump-error.log" || fail_test 'cleanup failure: original dump failure missing'
grep -q 'temporary cleanup failed (category=temporary_cleanup); original_exit=21' "${TEST_ROOT}/cleanup-failure-after-dump-error.log" || fail_test 'cleanup failure: original exit code was not preserved'

[[ "$(count_calls "${MOCK_CALLS}/chmod")" -eq 8 ]] || fail_test 'permission setup: expected mode 0700 for each scenario that passed mkdir'

printf 'All mocked backup checks passed. No real Docker, GPG, OCI, PostgreSQL, systemd, or network operation was used.\n'
