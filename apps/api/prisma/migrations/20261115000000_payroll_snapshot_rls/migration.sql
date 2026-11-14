-- PayrollSnapshot is immutable evidence for approved payroll. Tenants may
-- read their own snapshots and create them during approval, but cannot update
-- or delete historical snapshots through the runtime role.
ALTER TABLE "payroll_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_snapshots" FORCE ROW LEVEL SECURITY;

CREATE POLICY "payroll_snapshots_tenant_select" ON "payroll_snapshots"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "payroll_snapshots_tenant_insert" ON "payroll_snapshots"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );
