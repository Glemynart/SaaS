-- Cost centers are tenant-owned accounting dimensions used by Ledger and Payroll.
ALTER TABLE "centros_costo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "centros_costo" FORCE ROW LEVEL SECURITY;
CREATE POLICY "centros_costo_tenant_policy"
  ON "centros_costo"
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );
