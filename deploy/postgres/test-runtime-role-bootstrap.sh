#!/usr/bin/env bash
set -euo pipefail

if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "This integration test is restricted to the GitHub Actions PostgreSQL service." >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
postgres_container_id="${POSTGRES_SERVICE_CONTAINER_ID:-}"

if [[ -z "$postgres_container_id" ]]; then
  echo "The PostgreSQL GitHub Actions service container ID is required." >&2
  exit 1
fi

if ! docker inspect "$postgres_container_id" >/dev/null 2>&1; then
  echo "The configured PostgreSQL GitHub Actions service container was not found." >&2
  exit 1
fi

postgres_image="$(docker inspect --format '{{.Config.Image}}' "$postgres_container_id")"
if [[ "$postgres_image" != "postgres:16" ]]; then
  echo "The configured PostgreSQL service container is not the expected CI image." >&2
  exit 1
fi

staging_database="dusema_staging_bootstrap_ci"
runtime_role="dusema_ci_runtime"
migration_role="dusema_ci_migration"
export GOAL01_RUNTIME_DB_PASSWORD='ci-only-bootstrap-password'

psql_as_admin() {
  docker exec "$postgres_container_id" psql -X -v ON_ERROR_STOP=1 -U postgres "$@"
}

run_bootstrap_as_migration_role() {
  local database="$1"
  export GOAL01_RUNTIME_DB_ROLE="${2:-$runtime_role}"
  {
    printf 'SET ROLE %s;\n' "$migration_role"
    cat "$script_dir/bootstrap-runtime-role.sql"
  } | docker exec -i \
    -e GOAL01_RUNTIME_DB_ROLE \
    -e GOAL01_RUNTIME_DB_PASSWORD \
    "$postgres_container_id" \
    psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database"
}

psql_as_admin -d postgres -c 'CREATE DATABASE oficina_nitida' >/dev/null
psql_as_admin -d postgres -c "CREATE ROLE $migration_role LOGIN CREATEROLE" >/dev/null
psql_as_admin -d postgres -c "CREATE DATABASE $staging_database OWNER $migration_role" >/dev/null

if run_bootstrap_as_migration_role "$staging_database" >/dev/null 2>&1; then
  echo "Bootstrap unexpectedly accepted inherited PUBLIC CONNECT on the protected production database." >&2
  exit 1
fi

role_exists="$(psql_as_admin -d postgres -Atqc "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$runtime_role')")"
if [[ "$role_exists" != "f" ]]; then
  echo "The failed bootstrap left the runtime role behind instead of rolling back." >&2
  exit 1
fi

system_database_acl_before="$(psql_as_admin -d postgres -Atqc "SELECT COALESCE(datacl::text, '<default>') FROM pg_database WHERE datname = 'postgres'")"
if run_bootstrap_as_migration_role postgres >/dev/null 2>&1; then
  echo "Bootstrap unexpectedly accepted the PostgreSQL maintenance database as its target." >&2
  exit 1
fi
system_database_acl_after="$(psql_as_admin -d postgres -Atqc "SELECT COALESCE(datacl::text, '<default>') FROM pg_database WHERE datname = 'postgres'")"
if [[ "$system_database_acl_after" != "$system_database_acl_before" ]]; then
  echo "Rejected bootstrap changed the PostgreSQL maintenance database ACL." >&2
  exit 1
fi
role_exists="$(psql_as_admin -d postgres -Atqc "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$runtime_role')")"
if [[ "$role_exists" != "f" ]]; then
  echo "The rejected system-database bootstrap left the runtime role behind." >&2
  exit 1
fi

if run_bootstrap_as_migration_role "$staging_database" saas_api_runtime >/dev/null 2>&1; then
  echo "Bootstrap unexpectedly accepted the production runtime role." >&2
  exit 1
fi

psql_as_admin -d postgres -c 'REVOKE CONNECT ON DATABASE oficina_nitida FROM PUBLIC' >/dev/null
psql_as_admin -d postgres -c 'CREATE ROLE saas_api_runtime NOLOGIN' >/dev/null
run_bootstrap_as_migration_role "$staging_database" >/dev/null

psql_as_admin -d "$staging_database" -c "SET ROLE $migration_role; CREATE TABLE goal01_bootstrap_privilege_probe (id serial PRIMARY KEY, value text)" >/dev/null
default_object_privileges="$(psql_as_admin -d "$staging_database" -Atqc "SELECT has_table_privilege('$runtime_role', 'public.goal01_bootstrap_privilege_probe', 'SELECT')::text || '|' || has_table_privilege('$runtime_role', 'public.goal01_bootstrap_privilege_probe', 'INSERT')::text || '|' || has_sequence_privilege('$runtime_role', 'public.goal01_bootstrap_privilege_probe_id_seq', 'USAGE')::text")"
if [[ "$default_object_privileges" != 'true|true|true' ]]; then
  echo "Migration-created objects lack default runtime privileges: $default_object_privileges" >&2
  exit 1
fi

runtime_role_marker="$(psql_as_admin -d postgres -Atqc "SELECT shobj_description(oid, 'pg_authid') FROM pg_roles WHERE rolname = '$runtime_role'")"
if [[ "$runtime_role_marker" != 'dusema:goal01-staging-runtime' ]]; then
  echo "Bootstrap did not mark the runtime role it created." >&2
  exit 1
fi

privileged_role="dusema_ci_privileged_collision"
psql_as_admin -d postgres -c "CREATE ROLE $privileged_role LOGIN CREATEROLE" >/dev/null
if run_bootstrap_as_migration_role "$staging_database" "$privileged_role" >/dev/null 2>&1; then
  echo "Bootstrap unexpectedly accepted an existing role with administrative attributes." >&2
  exit 1
fi
privileged_attribute="$(psql_as_admin -d postgres -Atqc "SELECT rolcreaterole::text FROM pg_roles WHERE rolname = '$privileged_role'")"
if [[ "$privileged_attribute" != "true" ]]; then
  echo "Bootstrap changed the pre-existing administrative role before rejecting it." >&2
  exit 1
fi
psql_as_admin -d postgres -c "DROP ROLE $privileged_role" >/dev/null

privileges="$(psql_as_admin -d postgres -Atqc "SELECT has_database_privilege('$runtime_role', 'oficina_nitida', 'CONNECT')::text || '|' || has_database_privilege('$runtime_role', '$staging_database', 'CONNECT')::text || '|' || has_database_privilege('saas_api_runtime', '$staging_database', 'CONNECT')::text")"
if [[ "$privileges" != 'false|true|false' ]]; then
  echo "Unexpected runtime database CONNECT privileges: $privileges" >&2
  exit 1
fi

psql_as_admin -d postgres -c "GRANT CONNECT ON DATABASE $staging_database TO saas_api_runtime" >/dev/null
if run_bootstrap_as_migration_role "$staging_database" >/dev/null 2>&1; then
  echo "Bootstrap unexpectedly accepted CONNECT for the production runtime role on staging." >&2
  exit 1
fi
psql_as_admin -d postgres -c "REVOKE CONNECT ON DATABASE $staging_database FROM saas_api_runtime" >/dev/null
run_bootstrap_as_migration_role "$staging_database" >/dev/null

psql_as_admin -d postgres -c "GRANT CREATE ON DATABASE $staging_database TO $runtime_role" >/dev/null
run_bootstrap_as_migration_role "$staging_database" >/dev/null

database_create_privilege="$(psql_as_admin -d postgres -Atqc "SELECT has_database_privilege('$runtime_role', '$staging_database', 'CREATE')::text")"
if [[ "$database_create_privilege" != 'false' ]]; then
  echo "Bootstrap left CREATE on the staging database for the runtime role: $database_create_privilege" >&2
  exit 1
fi

psql_as_admin -d postgres -c "GRANT CREATE ON DATABASE $staging_database TO PUBLIC" >/dev/null
if run_bootstrap_as_migration_role "$staging_database" >/dev/null 2>&1; then
  echo "Bootstrap unexpectedly accepted CREATE inherited from PUBLIC on the staging database." >&2
  exit 1
fi
psql_as_admin -d postgres -c "REVOKE CREATE ON DATABASE $staging_database FROM PUBLIC" >/dev/null

psql_as_admin -d "$staging_database" -c "ALTER SCHEMA public OWNER TO $runtime_role" >/dev/null
if run_bootstrap_as_migration_role "$staging_database" >/dev/null 2>&1; then
  echo "Bootstrap unexpectedly accepted a runtime role that owns schema public." >&2
  exit 1
fi
psql_as_admin -d "$staging_database" -c "ALTER SCHEMA public OWNER TO $migration_role" >/dev/null

psql_as_admin -d "$staging_database" -c "GRANT CREATE ON SCHEMA public TO $runtime_role" >/dev/null
run_bootstrap_as_migration_role "$staging_database" >/dev/null

schema_privileges="$(psql_as_admin -d "$staging_database" -Atqc "SELECT has_schema_privilege('$runtime_role', 'public', 'CREATE')::text")"
if [[ "$schema_privileges" != 'false' ]]; then
  echo "Bootstrap left CREATE on schema public for the runtime role: $schema_privileges" >&2
  exit 1
fi

psql_as_admin -d postgres -c "ALTER ROLE $runtime_role SUPERUSER CREATEDB CREATEROLE INHERIT REPLICATION BYPASSRLS" >/dev/null
if run_bootstrap_as_migration_role "$staging_database" >/dev/null 2>&1; then
  echo "Bootstrap unexpectedly accepted runtime attributes that require superuser correction." >&2
  exit 1
fi

privileged_runtime_attributes="$(psql_as_admin -d postgres -Atqc "SELECT rolsuper::text || '|' || rolcreatedb::text || '|' || rolcreaterole::text || '|' || rolinherit::text || '|' || rolreplication::text || '|' || rolbypassrls::text FROM pg_roles WHERE rolname = '$runtime_role'")"
if [[ "$privileged_runtime_attributes" != 'true|true|true|true|true|true' ]]; then
  echo "Rejected bootstrap changed runtime privileges that require superuser correction: $privileged_runtime_attributes" >&2
  exit 1
fi

psql_as_admin -d postgres -c "ALTER ROLE $runtime_role NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS" >/dev/null
run_bootstrap_as_migration_role "$staging_database" >/dev/null

role_attributes="$(psql_as_admin -d postgres -Atqc "SELECT rolsuper::text || '|' || rolcreatedb::text || '|' || rolcreaterole::text || '|' || rolinherit::text || '|' || rolreplication::text || '|' || rolbypassrls::text FROM pg_roles WHERE rolname = '$runtime_role'")"
if [[ "$role_attributes" != 'false|false|false|false|false|false' ]]; then
  echo "Unexpected runtime role attributes after bootstrap: $role_attributes" >&2
  exit 1
fi

psql_as_admin -d postgres -c 'CREATE ROLE dusema_ci_member_role NOLOGIN' >/dev/null
psql_as_admin -d postgres -c "GRANT dusema_ci_member_role TO $runtime_role" >/dev/null

if run_bootstrap_as_migration_role "$staging_database" >/dev/null 2>&1; then
  echo "Bootstrap unexpectedly accepted a runtime role with role memberships." >&2
  exit 1
fi

protected_database_acl_before="$(psql_as_admin -d postgres -Atqc "SELECT COALESCE(datacl::text, '<default>') FROM pg_database WHERE datname = 'oficina_nitida'")"
if run_bootstrap_as_migration_role oficina_nitida >/dev/null 2>&1; then
  echo "Bootstrap unexpectedly accepted the protected production database as its target." >&2
  exit 1
fi
protected_database_acl_after="$(psql_as_admin -d postgres -Atqc "SELECT COALESCE(datacl::text, '<default>') FROM pg_database WHERE datname = 'oficina_nitida'")"
if [[ "$protected_database_acl_after" != "$protected_database_acl_before" ]]; then
  echo "Rejected bootstrap changed the protected database ACL." >&2
  exit 1
fi

protected_target_role="dusema_ci_protected_target"
if run_bootstrap_as_migration_role oficina_nitida "$protected_target_role" >/dev/null 2>&1; then
  echo "Bootstrap unexpectedly accepted the protected production database for a new runtime role." >&2
  exit 1
fi
protected_database_acl_after="$(psql_as_admin -d postgres -Atqc "SELECT COALESCE(datacl::text, '<default>') FROM pg_database WHERE datname = 'oficina_nitida'")"
if [[ "$protected_database_acl_after" != "$protected_database_acl_before" ]]; then
  echo "Rejected role bootstrap changed the protected database ACL." >&2
  exit 1
fi
protected_target_role_exists="$(psql_as_admin -d postgres -Atqc "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$protected_target_role')")"
if [[ "$protected_target_role_exists" != "f" ]]; then
  echo "Rejected bootstrap left a new runtime role behind on the protected database." >&2
  exit 1
fi

echo "PostgreSQL runtime role bootstrap isolation checks passed."
