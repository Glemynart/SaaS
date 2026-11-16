-- Exclusions can refer to an employee that no longer exists in this tenant.
-- Their owner is therefore validated through the parent contract batch only.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "batch_document_generation_exclusions" exclusion
    LEFT JOIN "lotes_contrato" batch ON batch."id" = exclusion."loteId"
    WHERE batch."id" IS NULL
       OR batch."tenantId" IS DISTINCT FROM exclusion."tenantId"
  ) THEN
    RAISE EXCEPTION
      'Cannot enable batch document exclusion RLS: an exclusion has a missing or cross-tenant batch';
  END IF;
END;
$$;

ALTER TABLE "batch_document_generation_exclusions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "batch_document_generation_exclusions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "batch_document_exclusions_tenant_select"
  ON "batch_document_generation_exclusions"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "lotes_contrato" batch
      WHERE batch."id" = "batch_document_generation_exclusions"."loteId"
        AND batch."tenantId" = "batch_document_generation_exclusions"."tenantId"
    )
  );

CREATE POLICY "batch_document_exclusions_tenant_insert"
  ON "batch_document_generation_exclusions"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "lotes_contrato" batch
      WHERE batch."id" = "batch_document_generation_exclusions"."loteId"
        AND batch."tenantId" = "batch_document_generation_exclusions"."tenantId"
    )
  );

CREATE POLICY "batch_document_exclusions_tenant_update"
  ON "batch_document_generation_exclusions"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "lotes_contrato" batch
      WHERE batch."id" = "batch_document_generation_exclusions"."loteId"
        AND batch."tenantId" = "batch_document_generation_exclusions"."tenantId"
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "lotes_contrato" batch
      WHERE batch."id" = "batch_document_generation_exclusions"."loteId"
        AND batch."tenantId" = "batch_document_generation_exclusions"."tenantId"
    )
  );

-- Exclusions are durable batch-resolution history; physical deletion is not
-- part of the application flow.
