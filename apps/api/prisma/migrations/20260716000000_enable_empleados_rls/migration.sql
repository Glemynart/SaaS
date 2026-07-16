ALTER TABLE "empleados" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "empleados" FORCE ROW LEVEL SECURITY;

CREATE POLICY "empleados_tenant_select" ON "empleados"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "empleados_tenant_insert" ON "empleados"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "empleados_tenant_update" ON "empleados"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "empleados_tenant_delete" ON "empleados"
  FOR DELETE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );
