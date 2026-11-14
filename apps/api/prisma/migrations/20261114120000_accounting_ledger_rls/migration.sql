-- Protect the Ledger's tenant-owned transaction rows. Catalog tables remain
-- on their existing application-level tenant filters until their consumers
-- are migrated to TenantPrismaService in a separate cohort.
ALTER TABLE "comprobantes_contables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comprobantes_contables" FORCE ROW LEVEL SECURITY;
CREATE POLICY "comprobantes_contables_tenant_policy"
  ON "comprobantes_contables"
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

ALTER TABLE "movimientos_contables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "movimientos_contables" FORCE ROW LEVEL SECURITY;
CREATE POLICY "movimientos_contables_tenant_policy"
  ON "movimientos_contables"
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

ALTER TABLE "secuencias_comprobante" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "secuencias_comprobante" FORCE ROW LEVEL SECURITY;
CREATE POLICY "secuencias_comprobante_tenant_policy"
  ON "secuencias_comprobante"
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );
