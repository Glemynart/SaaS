-- Functional payroll blocks affect whether an employee may be approved for
-- payroll. Require tenant-consistent period, employee, and exclusion actor.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "payroll_blocks" block
    LEFT JOIN "payroll_periods" period
      ON period."id" = block."payrollPeriodId"
    LEFT JOIN "empleados" employee
      ON employee."id" = block."employeeId"
    LEFT JOIN "users" actor
      ON actor."id" = block."excludedById"
    WHERE period."id" IS NULL
       OR period."tenantId" IS DISTINCT FROM block."tenantId"
       OR employee."id" IS NULL
       OR employee."tenantId" IS DISTINCT FROM block."tenantId"
       OR (
         block."excludedById" IS NOT NULL
         AND (
           actor."id" IS NULL
           OR actor."tenantId" IS DISTINCT FROM block."tenantId"
         )
       )
  ) THEN
    RAISE EXCEPTION
      'Cannot enable payroll block RLS: existing block has a missing or cross-tenant relationship';
  END IF;
END;
$$;

ALTER TABLE "payroll_blocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_blocks" FORCE ROW LEVEL SECURITY;

-- Blocks remain readable as history while all related records belong to the
-- same tenant, including after the payroll period reaches a terminal status.
CREATE POLICY "payroll_blocks_tenant_select" ON "payroll_blocks"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" period
      WHERE period."id" = "payroll_blocks"."payrollPeriodId"
        AND period."tenantId" = "payroll_blocks"."tenantId"
    )
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "payroll_blocks"."employeeId"
        AND employee."tenantId" = "payroll_blocks"."tenantId"
    )
    AND (
      "excludedById" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "users" actor
        WHERE actor."id" = "payroll_blocks"."excludedById"
          AND actor."tenantId" = "payroll_blocks"."tenantId"
      )
    )
  );

-- New blocks are detected during approval of a calculated or reviewed period.
-- The user can only create the initial active state; lifecycle changes use
-- UPDATE and keep their actor and related records within the tenant.
CREATE POLICY "payroll_blocks_tenant_insert" ON "payroll_blocks"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND "status" = 'ACTIVE'
    AND "resolvedAt" IS NULL
    AND "excludedAt" IS NULL
    AND "excludedById" IS NULL
    AND "exclusionReason" IS NULL
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" period
      WHERE period."id" = "payroll_blocks"."payrollPeriodId"
        AND period."tenantId" = "payroll_blocks"."tenantId"
        AND period."status" IN ('CALCULADA', 'EN_REVISION')
    )
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "payroll_blocks"."employeeId"
        AND employee."tenantId" = "payroll_blocks"."tenantId"
    )
  );

-- Preserve the existing service lifecycle for updates, but keep the block,
-- its period, employee, and any exclusion actor within the active tenant.
CREATE POLICY "payroll_blocks_tenant_update" ON "payroll_blocks"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" period
      WHERE period."id" = "payroll_blocks"."payrollPeriodId"
        AND period."tenantId" = "payroll_blocks"."tenantId"
    )
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "payroll_blocks"."employeeId"
        AND employee."tenantId" = "payroll_blocks"."tenantId"
    )
    AND (
      "excludedById" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "users" actor
        WHERE actor."id" = "payroll_blocks"."excludedById"
          AND actor."tenantId" = "payroll_blocks"."tenantId"
      )
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "payroll_periods" period
      WHERE period."id" = "payroll_blocks"."payrollPeriodId"
        AND period."tenantId" = "payroll_blocks"."tenantId"
    )
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "payroll_blocks"."employeeId"
        AND employee."tenantId" = "payroll_blocks"."tenantId"
    )
    AND (
      "excludedById" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "users" actor
        WHERE actor."id" = "payroll_blocks"."excludedById"
          AND actor."tenantId" = "payroll_blocks"."tenantId"
      )
    )
  );

-- No DELETE policy: blocks are synchronized through their lifecycle and are
-- not physically deleted by the payroll API.
