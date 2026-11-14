-- PayrollRun stores payroll amounts, calculation evidence, and declarations
-- used by approved snapshots. Keep every read and write inside the active
-- tenant and require related period/employee rows to belong to that tenant.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "payroll_runs" r
    LEFT JOIN "payroll_periods" p ON p."id" = r."payrollPeriodId"
    LEFT JOIN "empleados" e ON e."id" = r."employeeId"
    WHERE p."tenantId" IS DISTINCT FROM r."tenantId"
       OR e."tenantId" IS DISTINCT FROM r."tenantId"
  ) THEN
    RAISE EXCEPTION
      'Cannot enable payroll run RLS: existing run has a cross-tenant period or employee relationship';
  END IF;
END;
$$;

ALTER TABLE "payroll_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_runs" FORCE ROW LEVEL SECURITY;

CREATE POLICY "payroll_runs_tenant_select" ON "payroll_runs"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" p
      WHERE p."id" = "payroll_runs"."payrollPeriodId"
        AND p."tenantId" = "payroll_runs"."tenantId"
    )
    AND EXISTS (
      SELECT 1
      FROM "empleados" e
      WHERE e."id" = "payroll_runs"."employeeId"
        AND e."tenantId" = "payroll_runs"."tenantId"
    )
  );

CREATE POLICY "payroll_runs_tenant_insert" ON "payroll_runs"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" p
      WHERE p."id" = "payroll_runs"."payrollPeriodId"
        AND p."tenantId" = "payroll_runs"."tenantId"
        AND p."status" IN ('BORRADOR', 'CALCULADA')
    )
    AND EXISTS (
      SELECT 1
      FROM "empleados" e
      WHERE e."id" = "payroll_runs"."employeeId"
        AND e."tenantId" = "payroll_runs"."tenantId"
    )
  );

-- The current service edits PILA declarations only while a calculated period
-- is being reviewed. The tenant and relationship checks also prevent moving a
-- run to another tenant or attaching it to another tenant's records.
CREATE POLICY "payroll_runs_tenant_update" ON "payroll_runs"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" p
      WHERE p."id" = "payroll_runs"."payrollPeriodId"
        AND p."tenantId" = "payroll_runs"."tenantId"
        AND p."status" IN ('CALCULADA', 'EN_REVISION')
    )
    AND EXISTS (
      SELECT 1
      FROM "empleados" e
      WHERE e."id" = "payroll_runs"."employeeId"
        AND e."tenantId" = "payroll_runs"."tenantId"
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" p
      WHERE p."id" = "payroll_runs"."payrollPeriodId"
        AND p."tenantId" = "payroll_runs"."tenantId"
        AND p."status" IN ('CALCULADA', 'EN_REVISION')
    )
    AND EXISTS (
      SELECT 1
      FROM "empleados" e
      WHERE e."id" = "payroll_runs"."employeeId"
        AND e."tenantId" = "payroll_runs"."tenantId"
    )
  );

-- Recalculation replaces runs only while the period is still editable.
-- Approved periods remain protected by the snapshot FK and this policy.
CREATE POLICY "payroll_runs_tenant_delete" ON "payroll_runs"
  FOR DELETE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" p
      WHERE p."id" = "payroll_runs"."payrollPeriodId"
        AND p."tenantId" = "payroll_runs"."tenantId"
        AND p."status" IN ('BORRADOR', 'CALCULADA')
    )
    AND EXISTS (
      SELECT 1
      FROM "empleados" e
      WHERE e."id" = "payroll_runs"."employeeId"
        AND e."tenantId" = "payroll_runs"."tenantId"
    )
  );

-- PayrollConcept has no tenantId column. Its owner run is the source of truth;
-- concepts can only be created during calculation and removed by an allowed
-- recalculation. No UPDATE policy is defined because the service recreates
-- concepts instead of editing them.
ALTER TABLE "payroll_concepts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_concepts" FORCE ROW LEVEL SECURITY;

CREATE POLICY "payroll_concepts_tenant_select" ON "payroll_concepts"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "payroll_runs" r
      WHERE r."id" = "payroll_concepts"."payrollRunId"
        AND r."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    )
  );

CREATE POLICY "payroll_concepts_tenant_insert" ON "payroll_concepts"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "payroll_runs" r
      JOIN "payroll_periods" p
        ON p."id" = r."payrollPeriodId"
       AND p."tenantId" = r."tenantId"
      WHERE r."id" = "payroll_concepts"."payrollRunId"
        AND r."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
        AND p."status" IN ('BORRADOR', 'CALCULADA')
    )
  );

CREATE POLICY "payroll_concepts_tenant_delete" ON "payroll_concepts"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM "payroll_runs" r
      JOIN "payroll_periods" p
        ON p."id" = r."payrollPeriodId"
       AND p."tenantId" = r."tenantId"
      WHERE r."id" = "payroll_concepts"."payrollRunId"
        AND r."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
        AND p."status" IN ('BORRADOR', 'CALCULADA')
    )
  );
