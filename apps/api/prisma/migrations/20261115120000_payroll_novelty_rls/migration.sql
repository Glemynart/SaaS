-- Payroll novelties are tenant-owned input to payroll calculations. They are
-- append-only through the current domain API: tenants may read and create
-- their rows, but may not update or delete them through the runtime role.
ALTER TABLE "payroll_novelties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_novelties" FORCE ROW LEVEL SECURITY;

CREATE POLICY "payroll_novelties_tenant_select" ON "payroll_novelties"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "payroll_novelties_tenant_insert" ON "payroll_novelties"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" p
      WHERE p."id" = "payroll_novelties"."payrollPeriodId"
        AND p."tenantId" = "payroll_novelties"."tenantId"
    )
    AND EXISTS (
      SELECT 1
      FROM "empleados" e
      WHERE e."id" = "payroll_novelties"."employeeId"
        AND e."tenantId" = "payroll_novelties"."tenantId"
    )
  );
