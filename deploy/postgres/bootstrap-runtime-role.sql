\set ON_ERROR_STOP on

-- Read secrets from the process environment so the password is not placed in
-- this file or passed as a command-line argument.
\getenv runtime_role GOAL01_RUNTIME_DB_ROLE
\getenv runtime_password GOAL01_RUNTIME_DB_PASSWORD

\if :{?runtime_role}
\else
\echo 'GOAL01_RUNTIME_DB_ROLE is required'
\quit 1
\endif

\if :{?runtime_password}
\else
\echo 'GOAL01_RUNTIME_DB_PASSWORD is required'
\quit 1
\endif

SELECT format(
  'DO $guard$ BEGIN IF length(%L) = 0 OR length(%L) = 0 THEN RAISE EXCEPTION ''runtime role and password must be non-empty''; END IF; END $guard$;',
  :'runtime_role',
  :'runtime_password'
) \gexec

-- Fail closed for the protected database, administrative identities, and the
-- production runtime identity before changing any role or database privileges.
BEGIN;

SELECT format(
  'DO $guard$ BEGIN IF current_database() = %L THEN RAISE EXCEPTION ''runtime bootstrap cannot target the protected production database''; END IF; IF %L IN (''postgres'', ''rdsadmin'', ''oficina'', ''saas_api_runtime'') OR %L = current_user THEN RAISE EXCEPTION ''runtime role must be distinct from the administrative role and production runtime role''; END IF; END $guard$;',
  'oficina_nitida',
  :'runtime_role',
  :'runtime_role'
) \gexec

-- Only reconfigure roles already marked by this bootstrap. This prevents an
-- arbitrary pre-existing role from being adopted and having its password or
-- administrative attributes changed accidentally.
SELECT format(
  'DO $guard$ DECLARE existing_role oid; existing_comment text; BEGIN SELECT oid, shobj_description(oid, ''pg_authid'') INTO existing_role, existing_comment FROM pg_roles WHERE rolname = %L; IF existing_role IS NOT NULL AND existing_comment IS DISTINCT FROM %L THEN RAISE EXCEPTION ''runtime role already exists and is not managed by this bootstrap''; END IF; END $guard$;',
  :'runtime_role',
  'dusema:goal01-staging-runtime'
) \gexec

-- A non-superuser migration identity cannot remove these attributes. Reject a
-- managed runtime role that acquired them instead of attempting an impossible
-- ALTER ROLE or partially changing its privileges.
SELECT format(
  'DO $guard$ DECLARE has_superuser_only_attributes boolean; BEGIN SELECT rolsuper OR rolcreatedb OR rolreplication OR rolbypassrls INTO has_superuser_only_attributes FROM pg_roles WHERE rolname = %L; IF COALESCE(has_superuser_only_attributes, false) THEN RAISE EXCEPTION ''managed runtime role has attributes that require DBA correction''; END IF; END $guard$;',
  :'runtime_role'
) \gexec

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOINHERIT',
  :'runtime_role',
  :'runtime_password'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'runtime_role'
) \gexec

-- A non-secret comment marks the role as owned by this bootstrap and allows a
-- later run to repair its attributes without adopting another cluster role.
SELECT format(
  'COMMENT ON ROLE %I IS %L',
  :'runtime_role',
  'dusema:goal01-staging-runtime'
) \gexec

-- Rotate the password and re-apply attributes a CREATEROLE migration identity
-- can safely change. Privileged attributes were rejected above.
SELECT format(
  'ALTER ROLE %I LOGIN PASSWORD %L NOCREATEROLE NOINHERIT',
  :'runtime_role',
  :'runtime_password'
) \gexec

-- Check memberships after normalizing role attributes. The transaction rolls
-- these changes back if the runtime role still belongs to another role.
SELECT format(
  'DO $guard$ DECLARE runtime_role_oid oid; BEGIN SELECT oid INTO runtime_role_oid FROM pg_roles WHERE rolname = %L; IF runtime_role_oid IS NOT NULL AND EXISTS (SELECT 1 FROM pg_roles AS candidate WHERE candidate.oid <> runtime_role_oid AND pg_has_role(runtime_role_oid, candidate.oid, ''MEMBER'')) THEN RAISE EXCEPTION ''runtime role must not have membership in other roles''; END IF; END $guard$;',
  :'runtime_role'
) \gexec

SELECT format(
  'DO $guard$ DECLARE runtime_role_oid oid; BEGIN SELECT oid INTO runtime_role_oid FROM pg_roles WHERE rolname = %L; IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = ''public'' AND nspowner = runtime_role_oid) OR EXISTS (SELECT 1 FROM pg_class AS relation JOIN pg_namespace AS schema ON schema.oid = relation.relnamespace WHERE schema.nspname = ''public'' AND relation.relowner = runtime_role_oid) THEN RAISE EXCEPTION ''runtime role must not own the public schema or its relations''; END IF; END $guard$;',
  :'runtime_role'
) \gexec

SELECT format(
  'REVOKE CONNECT ON DATABASE %I FROM PUBLIC',
  current_database()
) \gexec

SELECT format(
  'GRANT CONNECT ON DATABASE %I TO %I',
  current_database(),
  :'runtime_role'
) \gexec

SELECT format(
  'DO $guard$ DECLARE production_runtime_oid oid; BEGIN SELECT oid INTO production_runtime_oid FROM pg_roles WHERE rolname = ''saas_api_runtime''; IF production_runtime_oid IS NOT NULL AND has_database_privilege(production_runtime_oid, current_database(), ''CONNECT'') THEN RAISE EXCEPTION ''production runtime role must not connect to the staging database''; END IF; END $guard$;'
) \gexec

SELECT format(
  'DO $guard$ BEGIN IF has_database_privilege(%L, %L, ''CONNECT'') THEN RAISE EXCEPTION ''staging runtime role must not connect to protected database oficina_nitida''; END IF; END $guard$;',
  :'runtime_role',
  'oficina_nitida'
) \gexec

SELECT format(
  'REVOKE CREATE ON DATABASE %I FROM %I',
  current_database(),
  :'runtime_role'
) \gexec

SELECT format(
  'DO $guard$ BEGIN IF has_database_privilege(%L, current_database(), ''CREATE'') THEN RAISE EXCEPTION ''staging runtime role must not have CREATE on its database''; END IF; END $guard$;',
  :'runtime_role'
) \gexec

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM :"runtime_role";
GRANT USAGE ON SCHEMA public TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"runtime_role";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO :"runtime_role";

-- Migrations must run with the same owner that is used here. These defaults
-- keep future tables and sequences usable without granting schema ownership
-- or CREATE to the application role.
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
  current_user,
  :'runtime_role'
) \gexec

SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I',
  current_user,
  :'runtime_role'
) \gexec

COMMIT;
