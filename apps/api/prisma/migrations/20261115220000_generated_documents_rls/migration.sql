-- Generated documents contain employee and compensation snapshots. Validate
-- legacy relationships under the existing tenant policies before enforcing RLS.
DO $$
DECLARE
  tenant_id_value text;
BEGIN
  -- Read tenant IDs from this not-yet-RLS-protected table. The migration role
  -- must not need BYPASSRLS just to enumerate tenants; referenced tables with
  -- FORCE RLS become visible after setting each document tenant below.
  FOR tenant_id_value IN
    SELECT DISTINCT "tenantId" FROM "generated_documents"
  LOOP
    -- Existing employee and contract tables use FORCE RLS. Set each tenant in
    -- turn so the preflight can see its own rows without BYPASSRLS.
    PERFORM set_config('app.current_tenant_id', tenant_id_value, true);

    IF EXISTS (
      SELECT 1
      FROM "generated_documents" document
      LEFT JOIN "empleados" employee
        ON employee."id" = document."employeeId"
      LEFT JOIN "document_templates" template
        ON template."id" = document."templateId"
      LEFT JOIN "contratos" contract
        ON contract."id" = document."contratoId"
      LEFT JOIN "batch_document_generation_plans" plan
        ON plan."id" = document."batchDocumentGenerationPlanId"
      WHERE document."tenantId" = tenant_id_value
        AND (
          employee."id" IS NULL
          OR employee."tenantId" IS DISTINCT FROM document."tenantId"
          OR template."id" IS NULL
          OR template."tenantId" IS DISTINCT FROM document."tenantId"
          OR (
            document."contratoId" IS NOT NULL
            AND (
              contract."id" IS NULL
              OR contract."tenantId" IS DISTINCT FROM document."tenantId"
            )
          )
          OR (
            document."batchDocumentGenerationPlanId" IS NOT NULL
            AND (
              plan."id" IS NULL
              OR plan."tenantId" IS DISTINCT FROM document."tenantId"
            )
          )
        )
    ) THEN
      RAISE EXCEPTION
        'Cannot enable generated document RLS: a document has a missing or cross-tenant relationship';
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE "generated_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generated_documents" FORCE ROW LEVEL SECURITY;

CREATE POLICY "generated_documents_tenant_isolation"
  ON "generated_documents"
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "generated_documents"."employeeId"
        AND employee."tenantId" = "generated_documents"."tenantId"
    )
    AND EXISTS (
      SELECT 1
      FROM "document_templates" template
      WHERE template."id" = "generated_documents"."templateId"
        AND template."tenantId" = "generated_documents"."tenantId"
    )
    AND (
      "contratoId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "contratos" contract
        WHERE contract."id" = "generated_documents"."contratoId"
          AND contract."tenantId" = "generated_documents"."tenantId"
      )
    )
    AND (
      "batchDocumentGenerationPlanId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "batch_document_generation_plans" plan
        WHERE plan."id" = "generated_documents"."batchDocumentGenerationPlanId"
          AND plan."tenantId" = "generated_documents"."tenantId"
      )
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "generated_documents"."employeeId"
        AND employee."tenantId" = "generated_documents"."tenantId"
    )
    AND EXISTS (
      SELECT 1
      FROM "document_templates" template
      WHERE template."id" = "generated_documents"."templateId"
        AND template."tenantId" = "generated_documents"."tenantId"
    )
    AND (
      "contratoId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "contratos" contract
        WHERE contract."id" = "generated_documents"."contratoId"
          AND contract."tenantId" = "generated_documents"."tenantId"
      )
    )
    AND (
      "batchDocumentGenerationPlanId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "batch_document_generation_plans" plan
        WHERE plan."id" = "generated_documents"."batchDocumentGenerationPlanId"
          AND plan."tenantId" = "generated_documents"."tenantId"
      )
    )
  );
