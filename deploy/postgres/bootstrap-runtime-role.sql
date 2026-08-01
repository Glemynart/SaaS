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

-- Never allow the bootstrap to target the administrative session itself or a
-- known provider superuser name by mistake.
SELECT format(
  'DO $guard$ BEGIN IF %L IN (''postgres'', ''rdsadmin'') OR %L = current_user THEN RAISE EXCEPTION ''runtime role must be distinct from the administrative role''; END IF; END $guard$;',
  :'runtime_role',
  :'runtime_role'
) \gexec

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS',
  :'runtime_role',
  :'runtime_password'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'runtime_role'
) \gexec

-- Re-apply the security attributes on every run so an accidental privilege
-- change cannot silently become the production runtime configuration.
SELECT format(
  'ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS',
  :'runtime_role',
  :'runtime_password'
) \gexec

SELECT format(
  'GRANT CONNECT ON DATABASE %I TO %I',
  current_database(),
  :'runtime_role'
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
