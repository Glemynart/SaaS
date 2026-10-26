\set ON_ERROR_STOP on

-- Read-only PostgreSQL inventory for a DBA isolation review.
-- Run with a DBA-authorized identity; do not share unsanitized output.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

\echo 'Server and database context'
SELECT current_setting('server_version') AS server_version,
       current_database() AS connected_database,
       current_user AS audit_identity;

\echo 'Login role attributes (no password or credential fields)'
SELECT rolname,
       rolcanlogin,
       rolsuper,
       rolcreatedb,
       rolcreaterole,
       rolinherit,
       rolreplication,
       rolbypassrls,
       rolconnlimit
FROM pg_roles
ORDER BY rolname;

\echo 'Direct role membership edges (inherit_option and set_option flags)'
SELECT granted_role.rolname AS granted_role,
       member_role.rolname AS member_role,
       membership.admin_option,
       membership.inherit_option,
       membership.set_option
FROM pg_auth_members AS membership
JOIN pg_roles AS granted_role ON granted_role.oid = membership.roleid
JOIN pg_roles AS member_role ON member_role.oid = membership.member
ORDER BY granted_role.rolname, member_role.rolname;

\echo 'Database ACL entries (including PUBLIC)'
SELECT db.datname,
       CASE
         WHEN acl.grantee = 0 THEN 'PUBLIC'
         ELSE COALESCE(grantee_role.rolname, acl.grantee::text)
       END AS grantee_name,
       acl.privilege_type,
       acl.is_grantable
FROM pg_database AS db
CROSS JOIN LATERAL aclexplode(
  COALESCE(db.datacl, acldefault('d', db.datdba))
) AS acl
LEFT JOIN pg_roles AS grantee_role ON grantee_role.oid = acl.grantee
WHERE db.datallowconn
  AND NOT db.datistemplate
ORDER BY db.datname, grantee_name, acl.privilege_type;

\echo 'Effective CONNECT for every role to each connectable non-template database'
SELECT role.rolname,
       role.rolcanlogin,
       database.datname,
       has_database_privilege(role.oid, database.oid, 'CONNECT') AS can_connect
FROM pg_roles AS role
CROSS JOIN pg_database AS database
WHERE database.datallowconn
  AND NOT database.datistemplate
ORDER BY database.datname, role.rolname;

\echo 'Current client sessions aggregated without query text'
SELECT COALESCE(activity.datname, '<none>') AS database_name,
       COALESCE(activity.usename, '<none>') AS login_role,
       NULLIF(activity.application_name, '') AS application_name,
       COALESCE(activity.client_addr::text, 'local') AS client_address,
       COALESCE(activity.state, '<none>') AS session_state,
       count(*) AS session_count
FROM pg_stat_activity AS activity
WHERE activity.backend_type = 'client backend'
GROUP BY activity.datname,
         activity.usename,
         NULLIF(activity.application_name, ''),
         COALESCE(activity.client_addr::text, 'local'),
         COALESCE(activity.state, '<none>')
ORDER BY database_name, login_role, application_name, client_address, session_state;

\echo 'Schema, relation and routine ACL entries for the connected database'
WITH objects AS (
  SELECT 'schema'::text AS object_type,
         namespace.nspname AS object_name,
         namespace.nspowner AS owner_oid,
         namespace.nspacl AS object_acl,
         'n'::"char" AS acl_type
  FROM pg_namespace AS namespace
  WHERE namespace.nspname <> 'information_schema'
    AND namespace.nspname NOT LIKE 'pg\_%' ESCAPE '\'

  UNION ALL

  SELECT CASE WHEN rel.relkind = 'S' THEN 'sequence' ELSE 'relation' END,
         format('%I.%I', ns.nspname, rel.relname),
         rel.relowner,
         rel.relacl,
         CASE WHEN rel.relkind = 'S' THEN 'S'::"char" ELSE 'r'::"char" END
  FROM pg_class AS rel
  JOIN pg_namespace AS ns ON ns.oid = rel.relnamespace
  WHERE ns.nspname <> 'information_schema'
    AND ns.nspname NOT LIKE 'pg\_%' ESCAPE '\'
    AND rel.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')

  UNION ALL

  SELECT 'routine',
         format('%I.%I(%s)', ns.nspname, proc.proname,
                pg_get_function_identity_arguments(proc.oid)),
         proc.proowner,
         proc.proacl,
         'f'::"char"
  FROM pg_proc AS proc
  JOIN pg_namespace AS ns ON ns.oid = proc.pronamespace
  WHERE ns.nspname <> 'information_schema'
    AND ns.nspname NOT LIKE 'pg\_%' ESCAPE '\'
)
SELECT objects.object_type,
       objects.object_name,
       owner_role.rolname AS owner_role,
       CASE
         WHEN acl.grantee = 0 THEN 'PUBLIC'
         ELSE COALESCE(grantee_role.rolname, acl.grantee::text)
       END AS grantee_name,
       acl.privilege_type,
       acl.is_grantable
FROM objects
JOIN pg_roles AS owner_role ON owner_role.oid = objects.owner_oid
CROSS JOIN LATERAL aclexplode(
  COALESCE(objects.object_acl, acldefault(objects.acl_type, objects.owner_oid))
) AS acl
LEFT JOIN pg_roles AS grantee_role ON grantee_role.oid = acl.grantee
ORDER BY objects.object_type, objects.object_name, grantee_name, acl.privilege_type;

\echo 'Default ACL entries for objects subsequently created in this database'
SELECT COALESCE(namespace.nspname, '<all schemas>') AS schema_name,
       owner_role.rolname AS owner_role,
       defaults.defaclobjtype AS object_type,
       CASE
         WHEN acl.grantee = 0 THEN 'PUBLIC'
         ELSE COALESCE(grantee_role.rolname, acl.grantee::text)
       END AS grantee_name,
       acl.privilege_type,
       acl.is_grantable
FROM pg_default_acl AS defaults
JOIN pg_roles AS owner_role ON owner_role.oid = defaults.defaclrole
LEFT JOIN pg_namespace AS namespace ON namespace.oid = defaults.defaclnamespace
CROSS JOIN LATERAL aclexplode(
  COALESCE(defaults.defaclacl,
           acldefault(defaults.defaclobjtype, defaults.defaclrole))
) AS acl
LEFT JOIN pg_roles AS grantee_role ON grantee_role.oid = acl.grantee
ORDER BY schema_name, owner_role.rolname, object_type, grantee_name, acl.privilege_type;

ROLLBACK;
