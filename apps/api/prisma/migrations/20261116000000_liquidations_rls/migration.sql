-- Labor liquidation records contain employee identity and severance values.
-- Concepts inherit their tenant from the owning liquidation.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "liquidations" liquidation
    LEFT JOIN "empleados" employee
      ON employee."id" = liquidation."empleadoId"
    WHERE employee."id" IS NULL
       OR employee."tenantId" IS DISTINCT FROM liquidation."tenantId"
  ) THEN
    RAISE EXCEPTION
      'Cannot enable liquidation RLS: existing liquidation has a missing or cross-tenant employee';
  END IF;
END;
$$;

ALTER TABLE "liquidations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "liquidations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "liquidations_tenant_select" ON "liquidations"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "liquidations"."empleadoId"
        AND employee."tenantId" = "liquidations"."tenantId"
    )
  );

CREATE POLICY "liquidations_tenant_insert" ON "liquidations"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "liquidations"."empleadoId"
        AND employee."tenantId" = "liquidations"."tenantId"
    )
  );

CREATE POLICY "liquidations_tenant_update" ON "liquidations"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "liquidations"."empleadoId"
        AND employee."tenantId" = "liquidations"."tenantId"
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "liquidations"."empleadoId"
        AND employee."tenantId" = "liquidations"."tenantId"
    )
  );

-- No DELETE policy: the API preserves liquidation history and only changes
-- state through its validated DRAFT -> APPROVED -> PAID/VOIDED lifecycle.

ALTER TABLE "liquidation_concepts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "liquidation_concepts" FORCE ROW LEVEL SECURITY;

CREATE POLICY "liquidation_concepts_tenant_select" ON "liquidation_concepts"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "liquidations" liquidation
      WHERE liquidation."id" = "liquidation_concepts"."liquidationId"
        AND liquidation."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    )
  );

CREATE POLICY "liquidation_concepts_tenant_insert" ON "liquidation_concepts"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "liquidations" liquidation
      WHERE liquidation."id" = "liquidation_concepts"."liquidationId"
        AND liquidation."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    )
  );

-- No UPDATE or DELETE policy: calculation concepts are immutable snapshots.
