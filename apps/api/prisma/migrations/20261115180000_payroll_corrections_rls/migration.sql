-- Payroll corrections are sensitive, tenant-owned evidence for post-approval
-- changes. Their owning period must belong to the same tenant.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "payroll_corrections" c
    LEFT JOIN "payroll_periods" p ON p."id" = c."payrollPeriodId"
    WHERE p."id" IS NULL
       OR p."tenantId" IS DISTINCT FROM c."tenantId"
  ) THEN
    RAISE EXCEPTION
      'Cannot enable payroll correction RLS: existing correction has a missing or cross-tenant period';
  END IF;
END;
$$;

ALTER TABLE "payroll_corrections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_corrections" FORCE ROW LEVEL SECURITY;

-- History remains readable to its owning tenant while the period exists in
-- that tenant, including when the period later moves to a terminal status.
CREATE POLICY "payroll_corrections_tenant_select" ON "payroll_corrections"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" p
      WHERE p."id" = "payroll_corrections"."payrollPeriodId"
        AND p."tenantId" = "payroll_corrections"."tenantId"
    )
  );

-- New corrections can only target an approved or caused period. This mirrors
-- PayrollService.requireApprovedPeriodForCorrections.
CREATE POLICY "payroll_corrections_tenant_insert" ON "payroll_corrections"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND "status" = 'BORRADOR'
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" p
      WHERE p."id" = "payroll_corrections"."payrollPeriodId"
        AND p."tenantId" = "payroll_corrections"."tenantId"
        AND p."status" IN ('APROBADA', 'CAUSADA')
    )
  );

-- Only draft and in-review records can be changed. PayrollService owns the
-- exact transition matrix and approval materialization; RLS constrains the
-- row to this tenant and keeps terminal records immutable. No DELETE policy.
CREATE POLICY "payroll_corrections_tenant_update" ON "payroll_corrections"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND "status" IN ('BORRADOR', 'EN_REVISION')
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" p
      WHERE p."id" = "payroll_corrections"."payrollPeriodId"
        AND p."tenantId" = "payroll_corrections"."tenantId"
        AND p."status" IN ('APROBADA', 'CAUSADA')
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND "status" IN ('BORRADOR', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'CANCELADA')
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" p
      WHERE p."id" = "payroll_corrections"."payrollPeriodId"
        AND p."tenantId" = "payroll_corrections"."tenantId"
        AND p."status" IN ('APROBADA', 'CAUSADA')
    )
  );

-- No DELETE policy: correction acts and their materializations are historical
-- evidence and are canceled through the audited lifecycle instead.
