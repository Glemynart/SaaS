-- Payroll periods are tenant-owned workflow records. Tenant-scoped runtime
-- access may read and transition them, but must not remove their history.
ALTER TABLE "payroll_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_periods" FORCE ROW LEVEL SECURITY;

CREATE POLICY "payroll_periods_tenant_select" ON "payroll_periods"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "payroll_periods_tenant_insert" ON "payroll_periods"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "payroll_periods_tenant_update" ON "payroll_periods"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

-- No DELETE policy: a payroll period is the auditable root of its runs,
-- snapshots, PILA events, corrections, and accounting effects.
