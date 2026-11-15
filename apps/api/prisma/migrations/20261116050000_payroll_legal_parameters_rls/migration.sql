-- Legal parameters intentionally contain shared statutory defaults and
-- tenant-specific overrides. Runtime users may read the global catalog and
-- only the override owned by their active tenant. Seeds and legal maintenance
-- remain privileged operations; the API receives no write policy.
ALTER TABLE "parametros_legales_nomina" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parametros_legales_nomina" FORCE ROW LEVEL SECURITY;

CREATE POLICY "parametros_legales_nomina_global_or_tenant_select"
  ON "parametros_legales_nomina"
  FOR SELECT
  USING (
    "tenantId" IS NULL
    OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

-- No INSERT, UPDATE, or DELETE policy: versioned statutory inputs are managed
-- through privileged seed/legal maintenance, never through the runtime API.
