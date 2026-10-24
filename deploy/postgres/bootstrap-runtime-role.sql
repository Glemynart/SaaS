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
  'DO $guard$ BEGIN IF current_database() = %L THEN RAISE EXCEPTION ''runtime bootstrap cannot target the protected production database''; END IF; IF %L IN (''postgres'', ''rdsadmin'', ''saas_api_runtime'') OR %L = current_user THEN RAISE EXCEPTION ''runtime role must be distinct from the administrative role and production runtime role''; END IF; END $guard$;',
  'oficina_nitida',
  :'runtime_role',
  :'runtime_role'
) \gexec

SELECT format(
  'DO $guard$ DECLARE runtime_role_oid oid; BEGIN SELECT oid INTO runtime_role_oid FROM pg_roles WHERE rolname = %L; IF runtime_role_oid IS NOT NULL AND EXISTS (SELECT 1 FROM pg_roles AS candidate WHERE candidate.oid <> runtime_role_oid AND pg_has_role(runtime_role_oid, candidate.oid, ''MEMBER'')) THEN RAISE EXCEPTION ''runtime role must not have membership in other roles''; END IF; END $guard$;',
  :'runtime_role'
) \gexec

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS',
  :'runtime_role',
  :'runtime_password'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'runtime_role'
) \gexec

-- Re-apply the security attributes on every run so an accidental privilege
-- change cannot silently become the production runtime configuration.
SELECT format(
  'ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS',
  :'runtime_role',
  :'runtime_password'
) \gexec

SELECT format(
  'GRANT CONNECT ON DATABASE %I TO %I',
  current_database(),
  :'runtime_role'
) \gexec

SELECT format(
  'DO $guard$ BEGIN IF has_database_privilege(%L, %L, ''CONNECT'') THEN RAISE EXCEPTION ''staging runtime role must not connect to protected database oficina_nitida''; END IF; END $guard$;',
  :'runtime_role',
  'oficina_nitida'
) \gexec

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
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
