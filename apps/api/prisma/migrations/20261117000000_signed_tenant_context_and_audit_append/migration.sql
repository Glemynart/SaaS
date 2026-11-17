BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

DO $$
DECLARE
  owner_oid oid;
  owner_role record;
BEGIN
  SELECT oid INTO owner_oid
  FROM pg_roles
  WHERE rolname = 'saas_audit_log_function_owner';

  IF owner_oid IS NULL THEN
    IF NOT COALESCE((SELECT rolsuper FROM pg_roles WHERE rolname = current_user), false) THEN
      RAISE EXCEPTION 'Pre-create saas_audit_log_function_owner and grant temporary SET-only membership to the migration identity';
    END IF;
    -- Only a superuser creates the shared owner role here. A non-superuser
    -- migration identity must receive a narrowly scoped temporary membership
    -- from an administrator before Prisma migrate deploy.
    CREATE ROLE saas_audit_log_function_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  ELSE
    SELECT * INTO owner_role
    FROM pg_roles
    WHERE oid = owner_oid;
    IF owner_role.rolcanlogin OR owner_role.rolsuper OR owner_role.rolcreatedb
       OR owner_role.rolcreaterole OR owner_role.rolinherit
       OR owner_role.rolreplication OR owner_role.rolbypassrls THEN
      RAISE EXCEPTION 'AuditLog function owner has unsafe role attributes';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_auth_members AS membership
      WHERE membership.member = owner_oid
         OR (membership.roleid = owner_oid
             AND membership.member <> (SELECT oid FROM pg_roles WHERE rolname = current_user))
    ) THEN
      RAISE EXCEPTION 'AuditLog function owner has unsafe memberships or members other than the temporary migration identity';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class AS relation
    WHERE relation.relowner = (SELECT oid FROM pg_roles WHERE rolname = 'saas_audit_log_function_owner')
      AND relation.oid = 'public.audit_logs'::regclass
  ) THEN
    RAISE EXCEPTION 'AuditLog function owner must not own audit_logs';
  END IF;
END;
$$;

DO $$
DECLARE
  extension_schema text;
BEGIN
  SELECT namespace.nspname
    INTO extension_schema
  FROM pg_extension AS extension
  JOIN pg_namespace AS namespace ON namespace.oid = extension.extnamespace
  WHERE extension.extname = 'pgcrypto';

  IF extension_schema IS DISTINCT FROM 'public' THEN
    RAISE EXCEPTION 'pgcrypto must be installed in public for signed tenant context';
  END IF;
END;
$$;

-- A non-superuser migration identity may temporarily SET ROLE to this NOLOGIN
-- owner, but receives no ADMIN or inherited privileges. An administrator must
-- provision SET-only membership and revoke it after migrations and key setup.
-- The API runtime is never a member of this role.
DO $$
DECLARE
  owner_oid oid;
BEGIN
  IF current_user = 'saas_audit_log_function_owner' THEN
    RAISE EXCEPTION 'Use a dedicated migration identity, not the AuditLog function owner';
  END IF;
  SELECT oid INTO owner_oid
  FROM pg_roles WHERE rolname = 'saas_audit_log_function_owner';
  IF NOT COALESCE((SELECT rolsuper FROM pg_roles WHERE rolname = current_user), false)
     AND NOT EXISTS (
       SELECT 1
       FROM pg_auth_members AS membership
       WHERE membership.member = (SELECT oid FROM pg_roles WHERE rolname = current_user)
         AND membership.roleid = owner_oid
         AND membership.set_option
         AND NOT membership.inherit_option
         AND NOT membership.admin_option
     ) THEN
    RAISE EXCEPTION 'Migration identity must be superuser or have temporary SET-only membership in saas_audit_log_function_owner';
  END IF;
END;
$$;

CREATE SCHEMA audit_private AUTHORIZATION saas_audit_log_function_owner;

SET ROLE saas_audit_log_function_owner;
REVOKE ALL ON SCHEMA audit_private FROM PUBLIC;

CREATE TABLE audit_private.audit_log_signing_keys (
  key_id text PRIMARY KEY,
  key_material bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT audit_log_signing_keys_minimum_length
    CHECK (pg_catalog.octet_length(key_material) >= 32)
);

CREATE TABLE audit_private.allowed_system_actors (
  actor_id text PRIMARY KEY,
  CONSTRAINT allowed_system_actors_nonempty CHECK (actor_id <> '')
);

INSERT INTO audit_private.allowed_system_actors (actor_id)
VALUES
  ('system:alerts-scheduler'),
  ('system:service-premium-worker'),
  ('system:password-reset');

REVOKE ALL ON ALL TABLES IN SCHEMA audit_private FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA audit_private FROM PUBLIC;

RESET ROLE;

GRANT USAGE ON SCHEMA public TO saas_audit_log_function_owner;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO saas_audit_log_function_owner;
GRANT SELECT ON TABLE public.users TO saas_audit_log_function_owner;

SET ROLE saas_audit_log_function_owner;

CREATE FUNCTION audit_private.verify_signature(
  p_payload text,
  p_key_id text,
  p_signature bytea
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  signing_key bytea;
  expected_signature bytea;
  difference integer := 0;
  byte_index integer;
BEGIN
  IF p_payload IS NULL OR p_key_id IS NULL OR p_signature IS NULL
     OR pg_catalog.octet_length(p_signature) <> 32 THEN
    RETURN false;
  END IF;

  SELECT key_material INTO signing_key
  FROM audit_private.audit_log_signing_keys
  WHERE key_id = p_key_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  expected_signature := public.hmac(
    pg_catalog.convert_to(p_payload, 'UTF8'), signing_key, 'sha256'
  );
  FOR byte_index IN 0..31 LOOP
    difference := difference |
      (pg_catalog.get_byte(expected_signature, byte_index)
       # pg_catalog.get_byte(p_signature, byte_index));
  END LOOP;
  RETURN difference = 0;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE FUNCTION audit_private.current_tenant_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  payload_text text;
  signature_text text;
  context_value jsonb;
  context_keys text[];
  context_tenant text;
  context_actor text;
  context_actor_type text;
  context_key_id text;
BEGIN
  payload_text := pg_catalog.current_setting('app.signed_tenant_context', true);
  signature_text := pg_catalog.current_setting('app.signed_tenant_context_signature', true);
  IF NULLIF(payload_text, '') IS NULL
     OR NULLIF(signature_text, '') IS NULL THEN
    RETURN NULL;
  END IF;

  context_value := payload_text::jsonb;
  SELECT pg_catalog.array_agg(key ORDER BY key)
    INTO context_keys
  FROM pg_catalog.jsonb_object_keys(context_value) AS item(key);
  IF context_keys IS DISTINCT FROM ARRAY[
    'actorId', 'actorType', 'keyId', 'tenantId', 'transactionId', 'version'
  ]::text[] THEN
    RETURN NULL;
  END IF;

  context_key_id := context_value ->> 'keyId';
  IF NOT audit_private.verify_signature(
    payload_text,
    context_key_id,
    pg_catalog.decode(signature_text, 'hex')
  ) THEN
    RETURN NULL;
  END IF;

  context_tenant := context_value ->> 'tenantId';
  context_actor := context_value ->> 'actorId';
  context_actor_type := context_value ->> 'actorType';
  IF context_value ->> 'version' <> '1'
     OR context_tenant IS NULL OR context_tenant = ''
     OR context_actor IS NULL OR context_actor = ''
     OR context_actor_type NOT IN ('HUMAN', 'SYSTEM')
     OR context_value ->> 'transactionId' <> pg_catalog.pg_current_xact_id()::text
     OR NULLIF(
          pg_catalog.current_setting('app.current_tenant_id', true), ''
        ) IS DISTINCT FROM context_tenant THEN
    RETURN NULL;
  END IF;

  IF context_actor_type = 'SYSTEM' THEN
    IF NOT EXISTS (
      SELECT 1 FROM audit_private.allowed_system_actors
      WHERE actor_id = context_actor
    ) THEN
      RETURN NULL;
    END IF;
  ELSE
    -- The HMAC authenticates the HUMAN claim as issued by the API after JWT
    -- validation. Do not query users here: RLS scope must remain valid for a
    -- request whose user is concurrently deactivated; the append routine below
    -- independently requires an active, tenant-owned user before writing HUMAN.
    IF context_actor LIKE 'system:%' OR context_actor = 'service-premium-worker' THEN
      RETURN NULL;
    END IF;
  END IF;

  RETURN context_value;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE FUNCTION audit_private.current_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT audit_private.current_tenant_context() ->> 'tenantId'
$$;

CREATE FUNCTION audit_private.current_actor_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT audit_private.current_tenant_context() ->> 'actorId'
$$;

CREATE FUNCTION audit_private.current_actor_type()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT audit_private.current_tenant_context() ->> 'actorType'
$$;

CREATE FUNCTION audit_private.append_audit_event(
  p_payload text,
  p_signature bytea,
  p_key_id text
)
RETURNS TABLE (
  id text,
  "createdAt" timestamp(3) without time zone,
  "tenantId" text,
  "actorId" text,
  "actorKind" text,
  action text,
  "entityType" text,
  "entityId" text,
  metadata jsonb
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  event_value jsonb;
  event_keys text[];
  event_key_id text;
  event_id text;
  event_tenant text;
  event_actor text;
  event_actor_type text;
  event_action text;
  event_entity_type text;
  event_entity_id text;
  event_metadata jsonb;
  current_context jsonb;
  current_payload text;
  current_signature text;
  current_tenant text;
  signing_key bytea;
  context_value jsonb;
  context_payload text;
  context_signature text;
  inserted public.audit_logs%ROWTYPE;
  existing public.audit_logs%ROWTYPE;
BEGIN
  IF p_payload IS NULL OR pg_catalog.octet_length(p_payload) > 65536 THEN
    RAISE EXCEPTION 'Audit event authorization is invalid' USING ERRCODE = '42501';
  END IF;

  event_value := p_payload::jsonb;
  SELECT pg_catalog.array_agg(key ORDER BY key)
    INTO event_keys
  FROM pg_catalog.jsonb_object_keys(event_value) AS item(key);
  IF event_keys IS DISTINCT FROM ARRAY[
    'action', 'actorId', 'actorType', 'entityId', 'entityType',
    'id', 'keyId', 'metadata', 'tenantId', 'version'
  ]::text[] THEN
    RAISE EXCEPTION 'Audit event authorization is invalid' USING ERRCODE = '42501';
  END IF;

  event_key_id := event_value ->> 'keyId';
  IF p_key_id IS DISTINCT FROM event_key_id
     OR NOT audit_private.verify_signature(p_payload, event_key_id, p_signature) THEN
    RAISE EXCEPTION 'Audit event authorization is invalid' USING ERRCODE = '42501';
  END IF;

  event_id := event_value ->> 'id';
  event_tenant := event_value ->> 'tenantId';
  event_actor := event_value ->> 'actorId';
  event_actor_type := event_value ->> 'actorType';
  event_action := event_value ->> 'action';
  event_entity_type := event_value ->> 'entityType';
  event_entity_id := event_value ->> 'entityId';
  event_metadata := event_value -> 'metadata';
  IF event_value ->> 'version' <> '1'
     OR event_id IS NULL OR event_id = ''
     OR event_tenant IS NULL OR event_tenant = ''
     OR event_actor IS NULL OR event_actor = ''
     OR event_action IS NULL OR event_action = ''
     OR event_entity_type IS NULL OR event_entity_type = ''
     OR event_actor_type NOT IN ('HUMAN', 'SYSTEM')
     OR pg_catalog.jsonb_typeof(event_metadata) <> 'object' THEN
    RAISE EXCEPTION 'Audit event authorization is invalid' USING ERRCODE = '42501';
  END IF;

  IF event_actor_type = 'SYSTEM' THEN
    IF NOT EXISTS (
      SELECT 1 FROM audit_private.allowed_system_actors
      WHERE actor_id = event_actor
    ) THEN
      RAISE EXCEPTION 'Audit event authorization is invalid' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF event_actor LIKE 'system:%' OR event_actor = 'service-premium-worker'
       OR NOT EXISTS (
         SELECT 1 FROM public.users AS actor
         WHERE actor.id = event_actor
           AND actor."tenantId" = event_tenant
           AND actor.activo IS TRUE
       ) THEN
      RAISE EXCEPTION 'Audit event authorization is invalid' USING ERRCODE = '42501';
    END IF;
  END IF;

  current_context := audit_private.current_tenant_context();
  current_payload := pg_catalog.current_setting('app.signed_tenant_context', true);
  current_signature := pg_catalog.current_setting('app.signed_tenant_context_signature', true);
  current_tenant := NULLIF(
    pg_catalog.current_setting('app.current_tenant_id', true), ''
  );

  IF current_context IS NULL THEN
    IF NULLIF(current_payload, '') IS NOT NULL
       OR NULLIF(current_signature, '') IS NOT NULL
       OR current_tenant IS NOT NULL THEN
      RAISE EXCEPTION 'Audit event authorization is invalid' USING ERRCODE = '42501';
    END IF;

    SELECT key_material INTO signing_key
    FROM audit_private.audit_log_signing_keys
    WHERE key_id = event_key_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Audit event authorization is invalid' USING ERRCODE = '42501';
    END IF;

    context_value := pg_catalog.jsonb_build_object(
      'version', 1,
      'keyId', event_key_id,
      'tenantId', event_tenant,
      'actorId', event_actor,
      'actorType', event_actor_type,
      'transactionId', pg_catalog.pg_current_xact_id()::text
    );
    context_payload := context_value::text;
    context_signature := pg_catalog.encode(
      public.hmac(
        pg_catalog.convert_to(context_payload, 'UTF8'),
        signing_key,
        'sha256'
      ),
      'hex'
    );
    PERFORM pg_catalog.set_config('app.current_tenant_id', event_tenant, true);
    PERFORM pg_catalog.set_config('app.signed_tenant_context', context_payload, true);
    PERFORM pg_catalog.set_config(
      'app.signed_tenant_context_signature', context_signature, true
    );
  ELSIF current_context ->> 'tenantId' IS DISTINCT FROM event_tenant
     OR current_context ->> 'actorId' IS DISTINCT FROM event_actor
     OR current_context ->> 'actorType' IS DISTINCT FROM event_actor_type THEN
    RAISE EXCEPTION 'Audit event context does not match the signed tenant and actor'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.audit_logs (
    id, "tenantId", "userId", "actorType", action,
    "entityType", "entityId", metadata
  ) VALUES (
    event_id, event_tenant, event_actor, event_actor_type, event_action,
    event_entity_type, event_entity_id, event_metadata
  )
  ON CONFLICT ON CONSTRAINT audit_logs_pkey DO NOTHING
  RETURNING * INTO inserted;

  IF FOUND THEN
    RETURN QUERY SELECT inserted.id, inserted."createdAt", inserted."tenantId",
      inserted."userId", inserted."actorType", inserted.action,
      inserted."entityType", inserted."entityId", inserted.metadata;
    RETURN;
  END IF;

  SELECT * INTO existing
  FROM public.audit_logs AS audit
  WHERE audit.id = event_id;
  IF NOT FOUND
     OR existing."tenantId" IS DISTINCT FROM event_tenant
     OR existing."userId" IS DISTINCT FROM event_actor
     OR existing."actorType" IS DISTINCT FROM event_actor_type
     OR existing.action IS DISTINCT FROM event_action
     OR existing."entityType" IS DISTINCT FROM event_entity_type
     OR existing."entityId" IS DISTINCT FROM event_entity_id
     OR existing.metadata IS DISTINCT FROM event_metadata THEN
    RAISE EXCEPTION 'Audit event identifier conflicts with a different event'
      USING ERRCODE = '23505';
  END IF;

  RETURN QUERY SELECT existing.id, existing."createdAt", existing."tenantId",
    existing."userId", existing."actorType", existing.action,
    existing."entityType", existing."entityId", existing.metadata;
END;
$$;

REVOKE ALL ON FUNCTION audit_private.verify_signature(text, text, bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION audit_private.current_tenant_context() FROM PUBLIC;
REVOKE ALL ON FUNCTION audit_private.current_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION audit_private.current_actor_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION audit_private.current_actor_type() FROM PUBLIC;
REVOKE ALL ON FUNCTION audit_private.append_audit_event(text, bytea, text) FROM PUBLIC;

-- The scope getters are safe to invoke from RLS policies and reveal only the
-- caller's already-session-local signed identity. They cannot mint a context.
-- Keep the signing-key verifier, full context, and append routine private.
GRANT USAGE ON SCHEMA audit_private TO PUBLIC;
GRANT EXECUTE ON FUNCTION audit_private.current_tenant_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION audit_private.current_actor_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION audit_private.current_actor_type() TO PUBLIC;

RESET ROLE;

-- Convert every installed tenant RLS expression from a mutable GUC to the
-- database-verified signed context. Preserve all other predicates verbatim.
DO $$
DECLARE
  policy record;
  using_expression text;
  check_expression text;
  old_scope_expression text :=
    'NULLIF(current_setting(''app.current_tenant_id''::text, true), ''''::text)';
  replacement_expression text := '(SELECT audit_private.current_tenant_id())';
  alter_statement text;
  converted_count integer := 0;
BEGIN
  FOR policy IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (COALESCE(qual, '') LIKE '%app.current_tenant_id%'
        OR COALESCE(with_check, '') LIKE '%app.current_tenant_id%')
  LOOP
    using_expression := CASE WHEN policy.qual IS NULL THEN NULL
      ELSE replace(policy.qual, old_scope_expression, replacement_expression)
      END;
    check_expression := CASE WHEN policy.with_check IS NULL THEN NULL
      ELSE replace(policy.with_check, old_scope_expression, replacement_expression)
      END;

    IF COALESCE(using_expression, '') LIKE '%app.current_tenant_id%'
       OR COALESCE(check_expression, '') LIKE '%app.current_tenant_id%' THEN
      RAISE EXCEPTION 'Could not safely convert tenant policy %.%: %',
        policy.tablename, policy.policyname, policy.policyname;
    END IF;

    alter_statement := format('ALTER POLICY %I ON %I.%I',
      policy.policyname, policy.schemaname, policy.tablename);
    IF using_expression IS NOT NULL THEN
      alter_statement := alter_statement || format(' USING (%s)', using_expression);
    END IF;
    IF check_expression IS NOT NULL THEN
      alter_statement := alter_statement || format(' WITH CHECK (%s)', check_expression);
    END IF;
    EXECUTE alter_statement;
    converted_count := converted_count + 1;
  END LOOP;

  IF converted_count = 0 THEN
    RAISE EXCEPTION 'No tenant RLS policy was converted';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND (COALESCE(qual, '') LIKE '%app.current_tenant_id%'
        OR COALESCE(with_check, '') LIKE '%app.current_tenant_id%')
  ) THEN
    RAISE EXCEPTION 'A tenant RLS policy still trusts app.current_tenant_id directly';
  END IF;
END;
$$;

ALTER POLICY audit_logs_tenant_select
  ON public.audit_logs
  USING ("tenantId" = (SELECT audit_private.current_tenant_id()));

ALTER POLICY audit_logs_tenant_insert
  ON public.audit_logs
  WITH CHECK (
    "tenantId" = (SELECT audit_private.current_tenant_id())
    AND "userId" = (SELECT audit_private.current_actor_id())
    AND "actorType" = (SELECT audit_private.current_actor_type())
  );

DO $$
DECLARE
  grantee record;
  audit_owner oid;
BEGIN
  SELECT relowner INTO audit_owner
  FROM pg_class
  WHERE oid = 'public.audit_logs'::regclass;

  FOR grantee IN
    WITH audit_grantees AS (
      SELECT acl.grantee
      FROM pg_class AS relation
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
      ) AS acl
      WHERE relation.oid = 'public.audit_logs'::regclass
      UNION
      SELECT acl.grantee
      FROM pg_attribute AS attribute
      CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
      WHERE attribute.attrelid = 'public.audit_logs'::regclass
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
        AND attribute.attacl IS NOT NULL
    )
    SELECT DISTINCT role.rolname
    FROM audit_grantees
    JOIN pg_roles AS role ON role.oid = audit_grantees.grantee
    WHERE audit_grantees.grantee <> audit_owner
      AND role.rolname <> 'saas_audit_log_function_owner'
  LOOP
    -- REVOKE ALL at table scope also removes column-level grants.
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM %I', grantee.rolname);
  END LOOP;
  REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM PUBLIC;
END;
$$;

-- The function owner has only the table rights required for a tenant-checked
-- SELECT/INSERT. It is neither table owner nor member of a runtime role.
DO $$
DECLARE
  runtime_role record;
  owner_oid oid;
  audit_table_owner oid;
BEGIN
  IF current_database() = 'oficina_nitida'
     AND NOT EXISTS (
       SELECT 1
       FROM pg_roles AS role
       WHERE role.rolname = 'saas_api_runtime'
         AND role.rolcanlogin
         AND has_database_privilege(role.oid, current_database(), 'CONNECT')
     ) THEN
    RAISE EXCEPTION 'The expected oficina_nitida runtime role saas_api_runtime is missing or cannot connect';
  END IF;
  IF current_database() <> 'oficina_nitida'
     AND EXISTS (
       SELECT 1
       FROM pg_roles AS role
       WHERE role.rolname = 'saas_api_runtime'
         AND role.rolcanlogin
         AND has_database_privilege(role.oid, current_database(), 'CONNECT')
     ) THEN
    RAISE EXCEPTION 'The protected oficina_nitida runtime role must not connect to a non-production AuditLog database';
  END IF;

  SELECT oid INTO owner_oid
  FROM pg_roles WHERE rolname = 'saas_audit_log_function_owner';
  SELECT relowner INTO audit_table_owner
  FROM pg_class WHERE oid = 'public.audit_logs'::regclass;

  FOR runtime_role IN
    SELECT oid, rolname, rolcanlogin, rolsuper, rolcreatedb,
           rolcreaterole, rolinherit, rolreplication, rolbypassrls
    FROM pg_roles
    WHERE (rolname = 'saas_api_runtime' AND current_database() = 'oficina_nitida')
       OR pg_catalog.shobj_description(oid, 'pg_authid') = 'dusema:goal01-staging-runtime'
  LOOP
    IF NOT runtime_role.rolcanlogin
       OR runtime_role.rolsuper
       OR runtime_role.rolcreatedb
       OR runtime_role.rolcreaterole
       OR runtime_role.rolinherit
       OR runtime_role.rolreplication
       OR runtime_role.rolbypassrls THEN
      RAISE EXCEPTION 'Runtime role % has missing LOGIN or unsafe administrative attributes', runtime_role.rolname;
    END IF;
    IF NOT has_database_privilege(runtime_role.oid, current_database(), 'CONNECT') THEN
      RAISE EXCEPTION 'Runtime role % cannot connect to the database being migrated', runtime_role.rolname;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_roles AS candidate
      WHERE candidate.oid <> runtime_role.oid
        AND pg_has_role(runtime_role.oid, candidate.oid, 'MEMBER')
    ) THEN
      RAISE EXCEPTION 'Runtime role % must not belong to or be able to assume another role', runtime_role.rolname;
    END IF;
    IF runtime_role.oid = audit_table_owner
       OR pg_has_role(runtime_role.oid, audit_table_owner, 'MEMBER') THEN
      RAISE EXCEPTION 'Runtime role % must not own or inherit the AuditLog table owner role', runtime_role.rolname;
    END IF;
    IF pg_has_role(runtime_role.oid, owner_oid, 'MEMBER') THEN
      RAISE EXCEPTION 'Runtime role must not be a member of the AuditLog function owner';
    END IF;
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM %I', runtime_role.rolname);
  END LOOP;
END;
$$;

-- The dedicated owner grants its append function to approved runtime roles.
-- The migration identity does not own this function and must not receive broad
-- CREATEROLE or function-owner privileges just to manage its EXECUTE ACL.
SET ROLE saas_audit_log_function_owner;
DO $$
DECLARE
  runtime_role record;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_roles
    WHERE (rolname = 'saas_api_runtime' AND current_database() = 'oficina_nitida')
       OR pg_catalog.shobj_description(oid, 'pg_authid') = 'dusema:goal01-staging-runtime'
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION audit_private.append_audit_event(text, bytea, text) TO %I',
      runtime_role.rolname
    );
  END LOOP;
END;
$$;
RESET ROLE;

COMMIT;
