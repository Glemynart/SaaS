\set ON_ERROR_STOP on
\getenv migration_role AUDIT_LOG_MIGRATION_ROLE

\if :{?migration_role}
\else
\echo 'AUDIT_LOG_MIGRATION_ROLE is required'
\quit 1
\endif

SELECT EXISTS (
  SELECT 1
  FROM pg_catalog.pg_roles
  WHERE rolname = :'migration_role'
    AND rolcanlogin
    AND NOT rolsuper
    AND NOT rolcreatedb
    AND NOT rolcreaterole
    AND NOT rolreplication
    AND NOT rolbypassrls
) AS migration_role_is_restricted
\gset

\if :migration_role_is_restricted
\else
\echo 'Migration role is missing or has administrative attributes'
\quit 1
\endif

SELECT COALESCE((
  SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user
), false) AS caller_is_superuser
\gset

\if :caller_is_superuser
\else
\echo 'Run this one-time role bootstrap as an authorized PostgreSQL superuser'
\quit 1
\endif

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'saas_audit_log_function_owner'
  ) THEN
    CREATE ROLE saas_audit_log_function_owner
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
      NOREPLICATION NOBYPASSRLS;
  END IF;
END;
$$;

SELECT EXISTS (
  SELECT 1
  FROM pg_catalog.pg_roles
  WHERE rolname = 'saas_audit_log_function_owner'
    AND NOT rolcanlogin
    AND NOT rolsuper
    AND NOT rolcreatedb
    AND NOT rolcreaterole
    AND NOT rolinherit
    AND NOT rolreplication
    AND NOT rolbypassrls
) AS function_owner_is_restricted
\gset

\if :function_owner_is_restricted
\else
\echo 'AuditLog function owner has unsafe attributes'
\quit 1
\endif

SELECT NOT EXISTS (
  SELECT 1
  FROM pg_catalog.pg_auth_members AS membership
  WHERE membership.member = (
      SELECT oid FROM pg_catalog.pg_roles
      WHERE rolname = 'saas_audit_log_function_owner'
    )
    OR (
      membership.roleid = (
        SELECT oid FROM pg_catalog.pg_roles
        WHERE rolname = 'saas_audit_log_function_owner'
      )
      AND membership.member <> (
        SELECT oid FROM pg_catalog.pg_roles
        WHERE rolname = :'migration_role'
      )
    )
) AS function_owner_membership_is_restricted
\gset

\if :function_owner_membership_is_restricted
\else
\echo 'AuditLog function owner has an unexpected role membership'
\quit 1
\endif

-- Normalize old or interrupted grants. The migration identity gets only
-- SET ROLE for the controlled migration/key-provisioning window.
SELECT format(
  'REVOKE saas_audit_log_function_owner FROM %I',
  :'migration_role'
)
WHERE EXISTS (
  SELECT 1
  FROM pg_catalog.pg_auth_members AS membership
  WHERE membership.roleid = (
      SELECT oid FROM pg_catalog.pg_roles
      WHERE rolname = 'saas_audit_log_function_owner'
    )
    AND membership.member = (
      SELECT oid FROM pg_catalog.pg_roles
      WHERE rolname = :'migration_role'
    )
)
\gexec

SELECT format(
  'GRANT saas_audit_log_function_owner TO %I WITH ADMIN FALSE, SET TRUE, INHERIT FALSE',
  :'migration_role'
) \gexec

COMMIT;

SELECT role.rolname AS granted_role,
       member.rolname AS member_role,
       membership.admin_option,
       membership.set_option,
       membership.inherit_option
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS role ON role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member
WHERE role.rolname = 'saas_audit_log_function_owner';
