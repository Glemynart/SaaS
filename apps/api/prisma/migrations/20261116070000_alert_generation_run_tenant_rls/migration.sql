-- Scheduler runs are global, but their per-tenant results are private to each tenant.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "alert_generation_run_tenants" result
    LEFT JOIN "tenants" tenant
      ON tenant."id" = result."tenantId"
    LEFT JOIN "alert_generation_runs" run
      ON run."id" = result."runId"
    WHERE tenant."id" IS NULL OR run."id" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot enable alert generation tenant RLS: a result has a missing tenant or run';
  END IF;
END;
$$;

ALTER TABLE "alert_generation_run_tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alert_generation_run_tenants" FORCE ROW LEVEL SECURITY;

CREATE POLICY "alert_generation_run_tenants_tenant_select"
  ON "alert_generation_run_tenants"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM "alert_generation_runs" run
      WHERE run."id" = "alert_generation_run_tenants"."runId"
    )
  );

CREATE POLICY "alert_generation_run_tenants_tenant_insert"
  ON "alert_generation_run_tenants"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM "alert_generation_runs" run
      WHERE run."id" = "alert_generation_run_tenants"."runId"
    )
  );

CREATE POLICY "alert_generation_run_tenants_tenant_update"
  ON "alert_generation_run_tenants"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM "alert_generation_runs" run
      WHERE run."id" = "alert_generation_run_tenants"."runId"
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM "alert_generation_runs" run
      WHERE run."id" = "alert_generation_run_tenants"."runId"
    )
  );

-- Per-tenant history is not physically deleted by the API. Retention removes
-- old global runs; their child rows are removed through the existing FK cascade.
