-- Existing RLS policies on generated documents and profile configuration
-- already validate their template references. Check the consumers that do not
-- yet have RLS before protecting the template catalog.
DO $$
DECLARE
  tenant_id_value text;
BEGIN
  FOR tenant_id_value IN
    SELECT "id" FROM "tenants"
  LOOP
    PERFORM set_config('app.current_tenant_id', tenant_id_value, true);

    IF EXISTS (
      SELECT 1
      FROM "lotes_contrato" batch
      LEFT JOIN "document_templates" template
        ON template."id" = batch."documentTemplateId"
      WHERE batch."tenantId" = tenant_id_value
        AND batch."documentTemplateId" IS NOT NULL
        AND (
          template."id" IS NULL
          OR template."tenantId" IS DISTINCT FROM batch."tenantId"
        )
    ) OR EXISTS (
      SELECT 1
      FROM "batch_document_generation_plans" plan
      LEFT JOIN "document_templates" template
        ON template."id" = plan."plantillaId"
      WHERE plan."tenantId" = tenant_id_value
        AND (
          template."id" IS NULL
          OR template."tenantId" IS DISTINCT FROM plan."tenantId"
        )
    ) THEN
      RAISE EXCEPTION
        'Cannot enable document template RLS: a batch references a missing or cross-tenant template';
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE "document_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_templates" FORCE ROW LEVEL SECURITY;

CREATE POLICY "document_templates_tenant_select" ON "document_templates"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "document_templates_tenant_insert" ON "document_templates"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "document_templates_tenant_update" ON "document_templates"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

-- Template deletion is a soft-delete operation in the API; no physical DELETE
-- policy is provided.
