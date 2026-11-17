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

SELECT relation.relowner::regrole::text AS table_owner,
       current_user = relation.relowner::regrole::text AS runtime_is_table_owner,
       pg_catalog.pg_has_role(current_user, relation.relowner, 'MEMBER') AS runtime_member_of_table_owner,
       pg_catalog.pg_has_role(current_user, 'saas_audit_log_function_owner', 'MEMBER') AS runtime_member_of_function_owner,
       pg_catalog.pg_has_role(current_user, 'saas_audit_log_function_owner', 'SET') AS runtime_can_set_function_owner,
       relation.relrowsecurity AS rls_enabled,
       relation.relforcerowsecurity AS rls_forced,
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
       pg_catalog.has_any_column_privilege(current_user, relation.oid, 'REFERENCES') AS column_references,
       pg_catalog.has_function_privilege(current_user, 'audit_private.append_audit_event(text,bytea,text)', 'EXECUTE') AS can_append_through_function,
       pg_catalog.has_table_privilege(current_user, 'audit_private.audit_log_signing_keys', 'SELECT') AS can_read_signing_key
FROM pg_catalog.pg_class AS relation
WHERE relation.oid = pg_catalog.to_regclass('public.audit_logs');

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public' AND tablename = 'audit_logs'
ORDER BY policyname;

SELECT CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE role.rolname END AS grantee,
       acl.privilege_type,
       acl.is_grantable,
       'TABLE' AS grant_scope
FROM pg_catalog.pg_class AS relation
CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
LEFT JOIN pg_catalog.pg_roles AS role ON role.oid = acl.grantee
WHERE relation.oid = pg_catalog.to_regclass('public.audit_logs')
UNION ALL
SELECT CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE role.rolname END AS grantee,
       acl.privilege_type,
       acl.is_grantable,
       'COLUMN ' || attribute.attname AS grant_scope
FROM pg_catalog.pg_attribute AS attribute
CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
LEFT JOIN pg_catalog.pg_roles AS role ON role.oid = acl.grantee
WHERE attribute.attrelid = pg_catalog.to_regclass('public.audit_logs')
  AND attribute.attnum > 0
  AND NOT attribute.attisdropped
  AND attribute.attacl IS NOT NULL
ORDER BY grantee, grant_scope, privilege_type;

DO $$
DECLARE
  runtime_role pg_catalog.pg_roles%ROWTYPE;
  audit_table pg_catalog.pg_class%ROWTYPE;
  migration_table pg_catalog.pg_class%ROWTYPE;
  function_owner pg_catalog.pg_roles%ROWTYPE;
  audit_table_owner oid;
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
    RAISE EXCEPTION 'Runtime role has missing or administrative attributes';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles AS candidate
    WHERE candidate.oid <> runtime_role.oid
      AND pg_catalog.pg_has_role(runtime_role.oid, candidate.oid, 'MEMBER')
  ) THEN
    RAISE EXCEPTION 'Runtime role belongs to or can assume another role';
  END IF;

  SELECT * INTO audit_table
  FROM pg_catalog.pg_class
  WHERE oid = pg_catalog.to_regclass('public.audit_logs');
  IF NOT FOUND OR NOT audit_table.relrowsecurity OR NOT audit_table.relforcerowsecurity THEN
    RAISE EXCEPTION 'AuditLog RLS is missing or not forced';
  END IF;
  audit_table_owner := audit_table.relowner;
  IF audit_table_owner = runtime_role.oid
     OR pg_catalog.pg_has_role(runtime_role.oid, audit_table_owner, 'MEMBER') THEN
    RAISE EXCEPTION 'Runtime role owns or is a member of the AuditLog table owner';
  END IF;

  SELECT * INTO function_owner
  FROM pg_catalog.pg_roles
  WHERE rolname = 'saas_audit_log_function_owner';
  IF NOT FOUND
     OR function_owner.rolcanlogin
     OR function_owner.rolsuper
     OR function_owner.rolcreatedb
     OR function_owner.rolcreaterole
     OR function_owner.rolinherit
     OR function_owner.rolreplication
     OR function_owner.rolbypassrls
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_auth_members
       WHERE roleid = function_owner.oid OR member = function_owner.oid
     )
     OR pg_catalog.pg_has_role(runtime_role.oid, function_owner.oid, 'MEMBER')
     OR pg_catalog.pg_has_role(runtime_role.oid, function_owner.oid, 'SET') THEN
    RAISE EXCEPTION 'AuditLog function owner or its memberships are unsafe';
  END IF;

  IF pg_catalog.has_table_privilege(runtime_role.oid, audit_table.oid, 'SELECT')
     OR pg_catalog.has_table_privilege(runtime_role.oid, audit_table.oid, 'INSERT')
     OR pg_catalog.has_table_privilege(runtime_role.oid, audit_table.oid, 'UPDATE')
     OR pg_catalog.has_table_privilege(runtime_role.oid, audit_table.oid, 'DELETE')
     OR pg_catalog.has_table_privilege(runtime_role.oid, audit_table.oid, 'TRUNCATE')
     OR pg_catalog.has_table_privilege(runtime_role.oid, audit_table.oid, 'REFERENCES')
     OR pg_catalog.has_table_privilege(runtime_role.oid, audit_table.oid, 'TRIGGER')
     OR pg_catalog.has_any_column_privilege(runtime_role.oid, audit_table.oid, 'SELECT')
     OR pg_catalog.has_any_column_privilege(runtime_role.oid, audit_table.oid, 'INSERT')
     OR pg_catalog.has_any_column_privilege(runtime_role.oid, audit_table.oid, 'UPDATE')
     OR pg_catalog.has_any_column_privilege(runtime_role.oid, audit_table.oid, 'REFERENCES') THEN
    RAISE EXCEPTION 'Runtime role has direct table or column privileges on AuditLog';
  END IF;
  IF current_setting('server_version_num')::integer >= 170000
     AND pg_catalog.has_table_privilege(runtime_role.oid, audit_table.oid, 'MAINTAIN') THEN
    RAISE EXCEPTION 'Runtime role has MAINTAIN on AuditLog';
  END IF;

  IF NOT pg_catalog.has_function_privilege(
       runtime_role.oid,
       'audit_private.append_audit_event(text,bytea,text)',
       'EXECUTE'
     )
     OR pg_catalog.has_table_privilege(
       runtime_role.oid,
       'audit_private.audit_log_signing_keys',
       'SELECT'
     )
     OR pg_catalog.has_any_column_privilege(
       runtime_role.oid,
       'audit_private.audit_log_signing_keys',
       'SELECT'
     )
     OR pg_catalog.has_function_privilege(
       runtime_role.oid,
       'audit_private.verify_signature(text,text,bytea)',
       'EXECUTE'
     )
     OR pg_catalog.has_function_privilege(
       runtime_role.oid,
       'audit_private.current_tenant_context()',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'AuditLog append function or signing-key ACL is unsafe';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_logs'
      AND (cmd NOT IN ('SELECT', 'INSERT')
        OR COALESCE(qual, '') LIKE '%app.current_tenant_id%'
        OR COALESCE(with_check, '') LIKE '%app.current_tenant_id%')
  )
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_policies
       WHERE schemaname = 'public' AND tablename = 'audit_logs'
         AND cmd = 'SELECT'
         AND COALESCE(qual, '') LIKE '%audit_private.current_tenant_id%'
     )
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_policies
       WHERE schemaname = 'public' AND tablename = 'audit_logs'
         AND cmd = 'INSERT'
         AND COALESCE(with_check, '') LIKE '%audit_private.current_actor_id%'
     ) THEN
    RAISE EXCEPTION 'AuditLog policies are not scoped to the signed context';
  END IF;

  SELECT * INTO migration_table
  FROM pg_catalog.pg_class
  WHERE oid = pg_catalog.to_regclass('public._prisma_migrations');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prisma migration history table is missing';
  END IF;
  IF pg_catalog.has_table_privilege(runtime_role.oid, migration_table.oid, 'SELECT')
     OR pg_catalog.has_table_privilege(runtime_role.oid, migration_table.oid, 'INSERT')
     OR pg_catalog.has_table_privilege(runtime_role.oid, migration_table.oid, 'UPDATE')
     OR pg_catalog.has_table_privilege(runtime_role.oid, migration_table.oid, 'DELETE')
     OR pg_catalog.has_table_privilege(runtime_role.oid, migration_table.oid, 'TRUNCATE')
     OR pg_catalog.has_table_privilege(runtime_role.oid, migration_table.oid, 'REFERENCES')
     OR pg_catalog.has_table_privilege(runtime_role.oid, migration_table.oid, 'TRIGGER')
     OR pg_catalog.has_any_column_privilege(runtime_role.oid, migration_table.oid, 'SELECT')
     OR pg_catalog.has_any_column_privilege(runtime_role.oid, migration_table.oid, 'INSERT')
     OR pg_catalog.has_any_column_privilege(runtime_role.oid, migration_table.oid, 'UPDATE')
     OR pg_catalog.has_any_column_privilege(runtime_role.oid, migration_table.oid, 'REFERENCES')
     OR pg_catalog.pg_has_role(runtime_role.oid, migration_table.relowner, 'MEMBER') THEN
    RAISE EXCEPTION 'Runtime role can access or own Prisma migration history';
  END IF;
  IF current_setting('server_version_num')::integer >= 170000
     AND pg_catalog.has_table_privilege(runtime_role.oid, migration_table.oid, 'MAINTAIN') THEN
    RAISE EXCEPTION 'Runtime role has MAINTAIN on Prisma migration history';
  END IF;

  RAISE NOTICE 'PASS: runtime identity and AuditLog privileges satisfy the read-only checks';
END;
$$;

ROLLBACK;
