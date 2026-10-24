#!/usr/bin/env bash
set -euo pipefail

if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "This integration test is restricted to the GitHub Actions PostgreSQL service." >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
postgres_container_id="$(docker ps --filter "ancestor=postgres:16" --format '{{.ID}}' | head -n 1)"

if [[ -z "$postgres_container_id" ]]; then
  echo "The PostgreSQL 16 GitHub Actions service container was not found." >&2
  exit 1
fi

staging_database="dusema_staging_bootstrap_ci"
runtime_role="dusema_ci_runtime"
export GOAL01_RUNTIME_DB_PASSWORD='ci-only-bootstrap-password'

psql_as_admin() {
  docker exec "$postgres_container_id" psql -X -v ON_ERROR_STOP=1 -U postgres "$@"
}

run_bootstrap() {
  local database="$1"
  local role="${2:-$runtime_role}"
  export GOAL01_RUNTIME_DB_ROLE="$role"
  docker exec -i \
    -e GOAL01_RUNTIME_DB_ROLE \
    -e GOAL01_RUNTIME_DB_PASSWORD \
    "$postgres_container_id" \
    psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database" \
    < "$script_dir/bootstrap-runtime-role.sql"
}

psql_as_admin -d postgres -c 'CREATE DATABASE oficina_nitida' >/dev/null
psql_as_admin -d postgres -c "CREATE DATABASE $staging_database" >/dev/null

if run_bootstrap "$staging_database" >/dev/null; then
  echo "Bootstrap unexpectedly accepted CONNECT inherited from PUBLIC." >&2
  exit 1
fi

role_exists="$(psql_as_admin -d postgres -Atqc "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$runtime_role')")"
if [[ "$role_exists" != "f" ]]; then
  echo "The failed bootstrap left the runtime role behind instead of rolling back." >&2
  exit 1
fi

if run_bootstrap "$staging_database" saas_api_runtime >/dev/null; then
  echo "Bootstrap unexpectedly accepted the production runtime role." >&2
  exit 1
fi

psql_as_admin -d postgres -c 'REVOKE CONNECT ON DATABASE oficina_nitida FROM PUBLIC' >/dev/null
psql_as_admin -d postgres -c 'CREATE ROLE saas_api_runtime NOLOGIN' >/dev/null
run_bootstrap "$staging_database" >/dev/null

privileges="$(psql_as_admin -d postgres -Atqc "SELECT has_database_privilege('$runtime_role', 'oficina_nitida', 'CONNECT')::text || '|' || has_database_privilege('$runtime_role', '$staging_database', 'CONNECT')::text || '|' || has_database_privilege('saas_api_runtime', '$staging_database', 'CONNECT')::text")"
if [[ "$privileges" != 'false|true|false' ]]; then
  echo "Unexpected runtime database CONNECT privileges: $privileges" >&2
  exit 1
fi

psql_as_admin -d postgres -c "GRANT CONNECT ON DATABASE $staging_database TO saas_api_runtime" >/dev/null
if run_bootstrap "$staging_database" >/dev/null 2>&1; then
  echo "Bootstrap unexpectedly accepted CONNECT for the production runtime role on staging." >&2
  exit 1
fi
psql_as_admin -d postgres -c "REVOKE CONNECT ON DATABASE $staging_database FROM saas_api_runtime" >/dev/null
run_bootstrap "$staging_database" >/dev/null

psql_as_admin -d postgres -c "GRANT CREATE ON DATABASE $staging_database TO $runtime_role" >/dev/null
run_bootstrap "$staging_database" >/dev/null

database_create_privilege="$(psql_as_admin -d postgres -Atqc "SELECT has_database_privilege('$runtime_role', '$staging_database', 'CREATE')::text")"
if [[ "$database_create_privilege" != 'false' ]]; then
  echo "Bootstrap left CREATE on the staging database for the runtime role: $database_create_privilege" >&2
  exit 1
fi

psql_as_admin -d postgres -c "GRANT CREATE ON DATABASE $staging_database TO PUBLIC" >/dev/null
if run_bootstrap "$staging_database" >/dev/null 2>&1; then
  echo "Bootstrap unexpectedly accepted CREATE inherited from PUBLIC on the staging database." >&2
  exit 1
fi
psql_as_admin -d postgres -c "REVOKE CREATE ON DATABASE $staging_database FROM PUBLIC" >/dev/null

psql_as_admin -d "$staging_database" -c "ALTER SCHEMA public OWNER TO $runtime_role" >/dev/null
if run_bootstrap "$staging_database" >/dev/null 2>&1; then
  echo "Bootstrap unexpectedly accepted a runtime role that owns schema public." >&2
  exit 1
fi
psql_as_admin -d "$staging_database" -c 'ALTER SCHEMA public OWNER TO postgres' >/dev/null

psql_as_admin -d "$staging_database" -c "GRANT CREATE ON SCHEMA public TO $runtime_role" >/dev/null
run_bootstrap "$staging_database" >/dev/null

schema_privileges="$(psql_as_admin -d "$staging_database" -Atqc "SELECT has_schema_privilege('$runtime_role', 'public', 'CREATE')::text")"
if [[ "$schema_privileges" != 'false' ]]; then
  echo "Bootstrap left CREATE on schema public for the runtime role: $schema_privileges" >&2
  exit 1
fi

psql_as_admin -d postgres -c "ALTER ROLE $runtime_role SUPERUSER CREATEDB CREATEROLE INHERIT REPLICATION BYPASSRLS" >/dev/null
run_bootstrap "$staging_database" >/dev/null

role_attributes="$(psql_as_admin -d postgres -Atqc "SELECT rolsuper::text || '|' || rolcreatedb::text || '|' || rolcreaterole::text || '|' || rolinherit::text || '|' || rolreplication::text || '|' || rolbypassrls::text FROM pg_roles WHERE rolname = '$runtime_role'")"
if [[ "$role_attributes" != 'false|false|false|false|false|false' ]]; then
  echo "Unexpected runtime role attributes after bootstrap: $role_attributes" >&2
  exit 1
fi

psql_as_admin -d postgres -c 'CREATE ROLE dusema_ci_member_role NOLOGIN' >/dev/null
psql_as_admin -d postgres -c "GRANT dusema_ci_member_role TO $runtime_role" >/dev/null

if run_bootstrap "$staging_database" >/dev/null; then
  echo "Bootstrap unexpectedly accepted a runtime role with role memberships." >&2
  exit 1
fi

if run_bootstrap oficina_nitida >/dev/null; then
  echo "Bootstrap unexpectedly accepted the protected production database as its target." >&2
  exit 1
fi

echo "PostgreSQL runtime role bootstrap isolation checks passed."
