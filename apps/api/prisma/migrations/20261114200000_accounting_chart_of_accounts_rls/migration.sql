-- CuentaContable contains a platform-wide PUC template (tenantId IS NULL)
-- and tenant-owned copies. Tenants may read the template and their own rows,
-- but may only write rows owned by their active tenant.
ALTER TABLE "cuentas_contables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cuentas_contables" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cuentas_contables_read_global_or_tenant" ON "cuentas_contables"
  FOR SELECT
  USING (
    "tenantId" IS NULL
    OR "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "cuentas_contables_insert_tenant" ON "cuentas_contables"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "cuentas_contables_update_tenant" ON "cuentas_contables"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "cuentas_contables_delete_tenant" ON "cuentas_contables"
  FOR DELETE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );
