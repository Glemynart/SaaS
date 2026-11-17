\set ON_ERROR_STOP on
\getenv expected_database EXPECTED_RUNTIME_DATABASE
\getenv expected_role EXPECTED_RUNTIME_ROLE

\if :{?expected_database}
\else
\echo 'Set EXPECTED_RUNTIME_DATABASE before running this read-only check'
\quit 2
\endif

\if :{?expected_role}
\else
\echo 'Set EXPECTED_RUNTIME_ROLE before running this read-only check'
\quit 2
\endif

BEGIN READ ONLY;

SELECT current_database() AS database_name,
       session_user AS session_role,
       current_user AS effective_role,
       current_setting('server_version') AS postgres_version,
       current_setting('transaction_read_only') AS transaction_read_only;

SELECT current_database() = :'expected_database' AS expected_database_matches,
       session_user = :'expected_role' AS expected_role_matches,
       current_user = session_user AS no_role_switch;
\gset

\if :expected_database_matches
\else
\echo 'Connected to an unexpected database; verification aborted'
\quit 3
\endif

\if :expected_role_matches
\else
\echo 'Connected as an unexpected role; verification aborted'
\quit 3
\endif

\if :no_role_switch
\else
\echo 'A role switch is active; connect directly as the application runtime role'
\quit 3
\endif

SELECT rolname,
       rolcanlogin,
       rolsuper,
       rolcreatedb,
       rolcreaterole,
       rolinherit,
       rolreplication,
       rolbypassrls
FROM pg_catalog.pg_roles
WHERE rolname = current_user;

SELECT parent.rolname AS granted_role,
       membership.admin_option,
       membership.set_option,
       membership.inherit_option
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
WHERE membership.member = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
ORDER BY parent.rolname;

SELECT relation.relowner::regrole::text AS audit_log_owner,
       current_user = relation.relowner::regrole::text AS runtime_is_table_owner,
       pg_catalog.pg_has_role(current_user, relation.relowner, 'MEMBER') AS runtime_member_of_table_owner,
       relation.relrowsecurity AS rls_enabled_before_migration,
       relation.relforcerowsecurity AS rls_forced_before_migration,
       pg_catalog.has_table_privilege(current_user, relation.oid, 'SELECT') AS table_select,
       pg_catalog.has_table_privilege(current_user, relation.oid, 'INSERT') AS table_insert,
       pg_catalog.has_table_privilege(current_user, relation.oid, 'UPDATE') AS table_update,
       pg_catalog.has_table_privilege(current_user, relation.oid, 'DELETE') AS table_delete,
       pg_catalog.has_table_privilege(current_user, relation.oid, 'TRUNCATE') AS table_truncate,
       pg_catalog.has_table_privilege(current_user, relation.oid, 'REFERENCES') AS table_references,
       pg_catalog.has_table_privilege(current_user, relation.oid, 'TRIGGER') AS table_trigger,
       CASE WHEN current_setting('server_version_num')::integer >= 170000
         THEN pg_catalog.has_table_privilege(current_user, relation.oid, 'MAINTAIN')
         ELSE false
       END AS table_maintain,
       pg_catalog.has_any_column_privilege(current_user, relation.oid, 'SELECT') AS column_select,
       pg_catalog.has_any_column_privilege(current_user, relation.oid, 'INSERT') AS column_insert,
       pg_catalog.has_any_column_privilege(current_user, relation.oid, 'UPDATE') AS column_update,
       pg_catalog.has_any_column_privilege(current_user, relation.oid, 'REFERENCES') AS column_references
FROM pg_catalog.pg_class AS relation
WHERE relation.oid = pg_catalog.to_regclass('public.audit_logs');

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public' AND tablename = 'audit_logs'
ORDER BY policyname;

DO $$
DECLARE
  runtime_role pg_catalog.pg_roles%ROWTYPE;
  audit_table pg_catalog.pg_class%ROWTYPE;
BEGIN
  SELECT * INTO runtime_role
  FROM pg_catalog.pg_roles
  WHERE rolname = current_user;
  IF NOT FOUND
     OR NOT runtime_role.rolcanlogin
     OR runtime_role.rolsuper
     OR runtime_role.rolcreatedb
     OR runtime_role.rolcreaterole
     OR runtime_role.rolinherit
     OR runtime_role.rolreplication
     OR runtime_role.rolbypassrls THEN
    RAISE EXCEPTION 'Runtime identity has missing LOGIN or unsafe administrative attributes';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles AS candidate
    WHERE candidate.oid <> runtime_role.oid
      AND pg_catalog.pg_has_role(runtime_role.oid, candidate.oid, 'MEMBER')
  ) THEN
    RAISE EXCEPTION 'Runtime identity belongs to or can assume another role';
  END IF;

  SELECT * INTO audit_table
  FROM pg_catalog.pg_class
  WHERE oid = pg_catalog.to_regclass('public.audit_logs');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'public.audit_logs is missing; verify the database before proceeding';
  END IF;
  IF audit_table.relowner = runtime_role.oid
     OR pg_catalog.pg_has_role(runtime_role.oid, audit_table.relowner, 'MEMBER') THEN
    RAISE EXCEPTION 'Runtime identity owns or can assume the AuditLog table owner';
  END IF;

  RAISE NOTICE 'PASS: connected directly as the expected non-administrative runtime identity; inspect reported legacy AuditLog grants before migration';
END;
$$;

ROLLBACK;
