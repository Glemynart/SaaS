-- PILA events contain employee-level regulatory declarations and are scoped
-- to one payroll period. Fail closed if historical data crosses tenants.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "payroll_pila_events" event
    LEFT JOIN "payroll_periods" period
      ON period."id" = event."payrollPeriodId"
    LEFT JOIN "empleados" employee
      ON employee."id" = event."employeeId"
    WHERE period."id" IS NULL
       OR period."tenantId" IS DISTINCT FROM event."tenantId"
       OR employee."id" IS NULL
       OR employee."tenantId" IS DISTINCT FROM event."tenantId"
  ) THEN
    RAISE EXCEPTION
      'Cannot enable payroll PILA event RLS: existing event has a missing or cross-tenant relationship';
  END IF;
END;
$$;

ALTER TABLE "payroll_pila_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_pila_events" FORCE ROW LEVEL SECURITY;

-- Preserve event history for its tenant after the payroll period is approved.
CREATE POLICY "payroll_pila_events_tenant_select" ON "payroll_pila_events"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" period
      WHERE period."id" = "payroll_pila_events"."payrollPeriodId"
        AND period."tenantId" = "payroll_pila_events"."tenantId"
    )
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "payroll_pila_events"."employeeId"
        AND employee."tenantId" = "payroll_pila_events"."tenantId"
    )
  );

-- Events are created only for a tenant-owned draft period and employee.
CREATE POLICY "payroll_pila_events_tenant_insert" ON "payroll_pila_events"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" period
      WHERE period."id" = "payroll_pila_events"."payrollPeriodId"
        AND period."tenantId" = "payroll_pila_events"."tenantId"
        AND period."status" = 'BORRADOR'
    )
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "payroll_pila_events"."employeeId"
        AND employee."tenantId" = "payroll_pila_events"."tenantId"
    )
  );

-- The current lifecycle permits deleting an event only while its period is a
-- draft. No UPDATE policy exists; approved-period history stays immutable.
CREATE POLICY "payroll_pila_events_tenant_delete_draft" ON "payroll_pila_events"
  FOR DELETE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" period
      WHERE period."id" = "payroll_pila_events"."payrollPeriodId"
        AND period."tenantId" = "payroll_pila_events"."tenantId"
        AND period."status" = 'BORRADOR'
    )
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "payroll_pila_events"."employeeId"
        AND employee."tenantId" = "payroll_pila_events"."tenantId"
    )
  );
