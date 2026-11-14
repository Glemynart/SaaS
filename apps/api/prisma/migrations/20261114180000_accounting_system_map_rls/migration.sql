-- Account mappings are tenant-owned and drive entries created by Payroll,
-- Billing, receipts, and period close. Application consumers use the
-- tenant-scoped transaction boundary before this policy is applied.
ALTER TABLE "cuenta_sistema_map" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cuenta_sistema_map" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cuenta_sistema_map_tenant_policy" ON "cuenta_sistema_map"
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );
