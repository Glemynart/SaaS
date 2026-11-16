-- Contract batches are tenant-owned request records. Confirmed batch plans
-- retain tenant-owned references and immutable resolution snapshots.
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
      LEFT JOIN "sedes" site
        ON site."id" = batch."sedeId"
      LEFT JOIN "users" creator
        ON creator."id" = batch."creadoPorId"
      WHERE batch."tenantId" = tenant_id_value
        AND (
          (
            batch."documentTemplateId" IS NOT NULL
            AND (
              template."id" IS NULL
              OR template."tenantId" IS DISTINCT FROM batch."tenantId"
            )
          )
          OR (
            batch."sedeId" IS NOT NULL
            AND (
              site."id" IS NULL
              OR site."tenantId" IS DISTINCT FROM batch."tenantId"
            )
          )
          OR (
            batch."creadoPorId" IS NOT NULL
            AND (
              creator."id" IS NULL
              OR creator."tenantId" IS DISTINCT FROM batch."tenantId"
            )
          )
        )
    ) OR EXISTS (
      SELECT 1
      FROM "batch_document_generation_plans" plan
      LEFT JOIN "lotes_contrato" batch
        ON batch."id" = plan."loteId"
      LEFT JOIN "empleados" employee
        ON employee."id" = plan."empleadoId"
      LEFT JOIN "vinculos_laborales" relationship
        ON relationship."id" = plan."vinculoLaboralId"
      LEFT JOIN "perfiles_contractuales" profile
        ON profile."id" = plan."perfilContractualId"
      LEFT JOIN "configuraciones_documentales_perfil" configuration
        ON configuration."id" = plan."configuracionDocumentalPerfilId"
      LEFT JOIN "document_templates" template
        ON template."id" = plan."plantillaId"
      WHERE plan."tenantId" = tenant_id_value
        AND (
          batch."id" IS NULL
          OR batch."tenantId" IS DISTINCT FROM plan."tenantId"
          OR employee."id" IS NULL
          OR employee."tenantId" IS DISTINCT FROM plan."tenantId"
          OR relationship."id" IS NULL
          OR relationship."tenantId" IS DISTINCT FROM plan."tenantId"
          OR profile."id" IS NULL
          OR profile."tenantId" IS DISTINCT FROM plan."tenantId"
          OR configuration."id" IS NULL
          OR configuration."tenantId" IS DISTINCT FROM plan."tenantId"
          OR template."id" IS NULL
          OR template."tenantId" IS DISTINCT FROM plan."tenantId"
        )
    ) THEN
      RAISE EXCEPTION
        'Cannot enable contract batch RLS: a tenant-owned batch or plan has a missing or cross-tenant reference';
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE "lotes_contrato" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lotes_contrato" FORCE ROW LEVEL SECURITY;

CREATE POLICY "lotes_contrato_tenant_select" ON "lotes_contrato"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND (
      "documentTemplateId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "document_templates" template
        WHERE template."id" = "lotes_contrato"."documentTemplateId"
          AND template."tenantId" = "lotes_contrato"."tenantId"
      )
    )
    AND (
      "sedeId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "sedes" site
        WHERE site."id" = "lotes_contrato"."sedeId"
          AND site."tenantId" = "lotes_contrato"."tenantId"
      )
    )
    AND (
      "creadoPorId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "users" creator
        WHERE creator."id" = "lotes_contrato"."creadoPorId"
          AND creator."tenantId" = "lotes_contrato"."tenantId"
      )
    )
  );

CREATE POLICY "lotes_contrato_tenant_insert" ON "lotes_contrato"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND (
      "documentTemplateId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "document_templates" template
        WHERE template."id" = "lotes_contrato"."documentTemplateId"
          AND template."tenantId" = "lotes_contrato"."tenantId"
      )
    )
    AND (
      "sedeId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "sedes" site
        WHERE site."id" = "lotes_contrato"."sedeId"
          AND site."tenantId" = "lotes_contrato"."tenantId"
      )
    )
    AND (
      "creadoPorId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "users" creator
        WHERE creator."id" = "lotes_contrato"."creadoPorId"
          AND creator."tenantId" = "lotes_contrato"."tenantId"
      )
    )
  );

CREATE POLICY "lotes_contrato_tenant_update" ON "lotes_contrato"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND (
      "documentTemplateId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "document_templates" template
        WHERE template."id" = "lotes_contrato"."documentTemplateId"
          AND template."tenantId" = "lotes_contrato"."tenantId"
      )
    )
    AND (
      "sedeId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "sedes" site
        WHERE site."id" = "lotes_contrato"."sedeId"
          AND site."tenantId" = "lotes_contrato"."tenantId"
      )
    )
    AND (
      "creadoPorId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "users" creator
        WHERE creator."id" = "lotes_contrato"."creadoPorId"
          AND creator."tenantId" = "lotes_contrato"."tenantId"
      )
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND (
      "documentTemplateId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "document_templates" template
        WHERE template."id" = "lotes_contrato"."documentTemplateId"
          AND template."tenantId" = "lotes_contrato"."tenantId"
      )
    )
    AND (
      "sedeId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "sedes" site
        WHERE site."id" = "lotes_contrato"."sedeId"
          AND site."tenantId" = "lotes_contrato"."tenantId"
      )
    )
    AND (
      "creadoPorId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "users" creator
        WHERE creator."id" = "lotes_contrato"."creadoPorId"
          AND creator."tenantId" = "lotes_contrato"."tenantId"
      )
    )
  );

ALTER TABLE "batch_document_generation_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "batch_document_generation_plans" FORCE ROW LEVEL SECURITY;

CREATE POLICY "batch_document_generation_plans_tenant_select"
  ON "batch_document_generation_plans"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM "lotes_contrato" batch
      WHERE batch."id" = "batch_document_generation_plans"."loteId"
        AND batch."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "empleados" employee
      WHERE employee."id" = "batch_document_generation_plans"."empleadoId"
        AND employee."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "vinculos_laborales" relationship
      WHERE relationship."id" = "batch_document_generation_plans"."vinculoLaboralId"
        AND relationship."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "perfiles_contractuales" profile
      WHERE profile."id" = "batch_document_generation_plans"."perfilContractualId"
        AND profile."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "configuraciones_documentales_perfil" configuration
      WHERE configuration."id" = "batch_document_generation_plans"."configuracionDocumentalPerfilId"
        AND configuration."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "document_templates" template
      WHERE template."id" = "batch_document_generation_plans"."plantillaId"
        AND template."tenantId" = "batch_document_generation_plans"."tenantId"
    )
  );

CREATE POLICY "batch_document_generation_plans_tenant_insert"
  ON "batch_document_generation_plans"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM "lotes_contrato" batch
      WHERE batch."id" = "batch_document_generation_plans"."loteId"
        AND batch."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "empleados" employee
      WHERE employee."id" = "batch_document_generation_plans"."empleadoId"
        AND employee."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "vinculos_laborales" relationship
      WHERE relationship."id" = "batch_document_generation_plans"."vinculoLaboralId"
        AND relationship."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "perfiles_contractuales" profile
      WHERE profile."id" = "batch_document_generation_plans"."perfilContractualId"
        AND profile."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "configuraciones_documentales_perfil" configuration
      WHERE configuration."id" = "batch_document_generation_plans"."configuracionDocumentalPerfilId"
        AND configuration."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "document_templates" template
      WHERE template."id" = "batch_document_generation_plans"."plantillaId"
        AND template."tenantId" = "batch_document_generation_plans"."tenantId"
    )
  );

CREATE POLICY "batch_document_generation_plans_tenant_update"
  ON "batch_document_generation_plans"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM "lotes_contrato" batch
      WHERE batch."id" = "batch_document_generation_plans"."loteId"
        AND batch."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "empleados" employee
      WHERE employee."id" = "batch_document_generation_plans"."empleadoId"
        AND employee."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "vinculos_laborales" relationship
      WHERE relationship."id" = "batch_document_generation_plans"."vinculoLaboralId"
        AND relationship."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "perfiles_contractuales" profile
      WHERE profile."id" = "batch_document_generation_plans"."perfilContractualId"
        AND profile."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "configuraciones_documentales_perfil" configuration
      WHERE configuration."id" = "batch_document_generation_plans"."configuracionDocumentalPerfilId"
        AND configuration."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "document_templates" template
      WHERE template."id" = "batch_document_generation_plans"."plantillaId"
        AND template."tenantId" = "batch_document_generation_plans"."tenantId"
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM "lotes_contrato" batch
      WHERE batch."id" = "batch_document_generation_plans"."loteId"
        AND batch."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "empleados" employee
      WHERE employee."id" = "batch_document_generation_plans"."empleadoId"
        AND employee."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "vinculos_laborales" relationship
      WHERE relationship."id" = "batch_document_generation_plans"."vinculoLaboralId"
        AND relationship."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "perfiles_contractuales" profile
      WHERE profile."id" = "batch_document_generation_plans"."perfilContractualId"
        AND profile."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "configuraciones_documentales_perfil" configuration
      WHERE configuration."id" = "batch_document_generation_plans"."configuracionDocumentalPerfilId"
        AND configuration."tenantId" = "batch_document_generation_plans"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "document_templates" template
      WHERE template."id" = "batch_document_generation_plans"."plantillaId"
        AND template."tenantId" = "batch_document_generation_plans"."tenantId"
    )
  );

-- Batch plans and contract batches preserve history; the API does not physically delete them.
