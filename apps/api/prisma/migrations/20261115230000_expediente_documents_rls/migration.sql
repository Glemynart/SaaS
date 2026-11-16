-- Validate existing tenant ownership before enforcing row-level security.
-- Referenced tables already use FORCE RLS, so inspect each tenant under the
-- same transaction-local context that the API will install at runtime.
DO $$
DECLARE
  tenant_id_value text;
BEGIN
  FOR tenant_id_value IN
    SELECT DISTINCT tenant_id
    FROM (
      SELECT "tenantId" AS tenant_id FROM "expediente_doc_families"
      UNION ALL
      SELECT "tenantId" AS tenant_id FROM "expediente_docs"
    ) tenants
  LOOP
    PERFORM set_config('app.current_tenant_id', tenant_id_value, true);

    IF EXISTS (
      SELECT 1
      FROM "expediente_doc_families" family
      LEFT JOIN "empleados" employee
        ON employee."id" = family."empleadoId"
      WHERE family."tenantId" = tenant_id_value
        AND (
          employee."id" IS NULL
          OR employee."tenantId" IS DISTINCT FROM family."tenantId"
        )
    ) THEN
      RAISE EXCEPTION
        'Cannot enable expediente family RLS: a family has a missing or cross-tenant employee';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "expediente_docs" document
      LEFT JOIN "expediente_doc_families" family
        ON family."id" = document."familiaId"
      LEFT JOIN "empleados" employee
        ON employee."id" = document."empleadoId"
      LEFT JOIN "contratos" contract
        ON contract."id" = document."contratoId"
      LEFT JOIN "generated_documents" generated_document
        ON generated_document."id" = document."generatedDocumentId"
      LEFT JOIN "service_premium_lines" premium_line
        ON premium_line."id" = document."servicePremiumLineId"
      LEFT JOIN "expediente_docs" previous_document
        ON previous_document."id" = document."reemplazaId"
      WHERE document."tenantId" = tenant_id_value
        AND (
          family."id" IS NULL
          OR family."tenantId" IS DISTINCT FROM document."tenantId"
          OR family."empleadoId" IS DISTINCT FROM document."empleadoId"
          OR employee."id" IS NULL
          OR employee."tenantId" IS DISTINCT FROM document."tenantId"
          OR (
            document."contratoId" IS NOT NULL
            AND (
              contract."id" IS NULL
              OR contract."tenantId" IS DISTINCT FROM document."tenantId"
            )
          )
          OR (
            document."generatedDocumentId" IS NOT NULL
            AND (
              generated_document."id" IS NULL
              OR generated_document."tenantId" IS DISTINCT FROM document."tenantId"
            )
          )
          OR (
            document."servicePremiumLineId" IS NOT NULL
            AND (
              premium_line."id" IS NULL
              OR premium_line."tenantId" IS DISTINCT FROM document."tenantId"
            )
          )
          OR (
            document."reemplazaId" IS NOT NULL
            AND (
              previous_document."id" IS NULL
              OR previous_document."tenantId" IS DISTINCT FROM document."tenantId"
            )
          )
        )
    ) THEN
      RAISE EXCEPTION
        'Cannot enable expediente document RLS: a document has a missing or cross-tenant relationship';
    END IF;
  END LOOP;
END;
$$;

-- A document revision must point to a predecessor from the same tenant.
-- Enforce this with a composite FK so inserts and updates remain safe without
-- a recursive self-reference in the RLS policy.
CREATE UNIQUE INDEX "expediente_docs_id_tenantId_key"
  ON "expediente_docs"("id", "tenantId");

CREATE UNIQUE INDEX "expediente_docs_reemplazaId_tenantId_key"
  ON "expediente_docs"("reemplazaId", "tenantId");

ALTER TABLE "expediente_docs"
  DROP CONSTRAINT "expediente_docs_reemplazaId_fkey";

ALTER TABLE "expediente_docs"
  ADD CONSTRAINT "expediente_docs_reemplazaId_tenantId_fkey"
  FOREIGN KEY ("reemplazaId", "tenantId")
  REFERENCES "expediente_docs"("id", "tenantId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "expediente_doc_families" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expediente_doc_families" FORCE ROW LEVEL SECURITY;

CREATE POLICY "expediente_doc_families_tenant_select"
  ON "expediente_doc_families"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "expediente_doc_families"."empleadoId"
        AND employee."tenantId" = "expediente_doc_families"."tenantId"
    )
  );

CREATE POLICY "expediente_doc_families_tenant_insert"
  ON "expediente_doc_families"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "expediente_doc_families"."empleadoId"
        AND employee."tenantId" = "expediente_doc_families"."tenantId"
    )
  );

ALTER TABLE "expediente_docs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expediente_docs" FORCE ROW LEVEL SECURITY;

CREATE POLICY "expediente_docs_tenant_select"
  ON "expediente_docs"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "expediente_docs"."empleadoId"
        AND employee."tenantId" = "expediente_docs"."tenantId"
    )
    AND EXISTS (
      SELECT 1
      FROM "expediente_doc_families" family
      WHERE family."id" = "expediente_docs"."familiaId"
        AND family."tenantId" = "expediente_docs"."tenantId"
        AND family."empleadoId" = "expediente_docs"."empleadoId"
    )
    AND (
      "contratoId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "contratos" contract
        WHERE contract."id" = "expediente_docs"."contratoId"
          AND contract."tenantId" = "expediente_docs"."tenantId"
      )
    )
    AND (
      "generatedDocumentId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "generated_documents" generated_document
        WHERE generated_document."id" = "expediente_docs"."generatedDocumentId"
          AND generated_document."tenantId" = "expediente_docs"."tenantId"
      )
    )
    AND (
      "servicePremiumLineId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "service_premium_lines" premium_line
        WHERE premium_line."id" = "expediente_docs"."servicePremiumLineId"
          AND premium_line."tenantId" = "expediente_docs"."tenantId"
      )
    )
  );

CREATE POLICY "expediente_docs_tenant_insert"
  ON "expediente_docs"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "expediente_docs"."empleadoId"
        AND employee."tenantId" = "expediente_docs"."tenantId"
    )
    AND EXISTS (
      SELECT 1
      FROM "expediente_doc_families" family
      WHERE family."id" = "expediente_docs"."familiaId"
        AND family."tenantId" = "expediente_docs"."tenantId"
        AND family."empleadoId" = "expediente_docs"."empleadoId"
    )
    AND (
      "contratoId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "contratos" contract
        WHERE contract."id" = "expediente_docs"."contratoId"
          AND contract."tenantId" = "expediente_docs"."tenantId"
      )
    )
    AND (
      "generatedDocumentId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "generated_documents" generated_document
        WHERE generated_document."id" = "expediente_docs"."generatedDocumentId"
          AND generated_document."tenantId" = "expediente_docs"."tenantId"
      )
    )
    AND (
      "servicePremiumLineId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "service_premium_lines" premium_line
        WHERE premium_line."id" = "expediente_docs"."servicePremiumLineId"
          AND premium_line."tenantId" = "expediente_docs"."tenantId"
      )
    )
  );

CREATE POLICY "expediente_docs_tenant_update"
  ON "expediente_docs"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "expediente_docs"."empleadoId"
        AND employee."tenantId" = "expediente_docs"."tenantId"
    )
    AND EXISTS (
      SELECT 1
      FROM "expediente_doc_families" family
      WHERE family."id" = "expediente_docs"."familiaId"
        AND family."tenantId" = "expediente_docs"."tenantId"
        AND family."empleadoId" = "expediente_docs"."empleadoId"
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "expediente_docs"."empleadoId"
        AND employee."tenantId" = "expediente_docs"."tenantId"
    )
    AND EXISTS (
      SELECT 1
      FROM "expediente_doc_families" family
      WHERE family."id" = "expediente_docs"."familiaId"
        AND family."tenantId" = "expediente_docs"."tenantId"
        AND family."empleadoId" = "expediente_docs"."empleadoId"
    )
    AND (
      "contratoId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "contratos" contract
        WHERE contract."id" = "expediente_docs"."contratoId"
          AND contract."tenantId" = "expediente_docs"."tenantId"
      )
    )
    AND (
      "generatedDocumentId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "generated_documents" generated_document
        WHERE generated_document."id" = "expediente_docs"."generatedDocumentId"
          AND generated_document."tenantId" = "expediente_docs"."tenantId"
      )
    )
    AND (
      "servicePremiumLineId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "service_premium_lines" premium_line
        WHERE premium_line."id" = "expediente_docs"."servicePremiumLineId"
          AND premium_line."tenantId" = "expediente_docs"."tenantId"
      )
    )
  );
