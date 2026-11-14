-- The canonical third-party master contains tenant-owned financial and
-- identity data. Its application consumers run through TenantPrismaService.
ALTER TABLE "terceros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "terceros" FORCE ROW LEVEL SECURITY;
CREATE POLICY "terceros_tenant_policy"
  ON "terceros"
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );
