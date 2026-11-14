-- Contract records contain compensation snapshots and document storage keys.
-- Reject inconsistent historical relationships before enforcing tenant RLS.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "contratos" contract
    LEFT JOIN "empleados" employee
      ON employee."id" = contract."empleadoId"
    LEFT JOIN "sedes" site
      ON site."id" = contract."sedeId"
    LEFT JOIN "plantillas" template
      ON template."id" = contract."plantillaId"
    LEFT JOIN "lotes_contrato" batch
      ON batch."id" = contract."loteId"
    LEFT JOIN "perfiles_contractuales" profile
      ON profile."id" = contract."perfilContractualId"
    LEFT JOIN "contratos" renewal
      ON renewal."id" = contract."contratoRenovaId"
    WHERE employee."id" IS NULL
       OR employee."tenantId" IS DISTINCT FROM contract."tenantId"
       OR (
         contract."sedeId" IS NOT NULL
         AND (
           site."id" IS NULL
           OR site."tenantId" IS DISTINCT FROM contract."tenantId"
         )
       )
       OR (
         contract."plantillaId" IS NOT NULL
         AND (
           template."id" IS NULL
           OR template."tenantId" IS DISTINCT FROM contract."tenantId"
         )
       )
       OR (
         contract."loteId" IS NOT NULL
         AND (
           batch."id" IS NULL
           OR batch."tenantId" IS DISTINCT FROM contract."tenantId"
         )
       )
       OR (
         contract."perfilContractualId" IS NOT NULL
         AND (
           profile."id" IS NULL
           OR profile."tenantId" IS DISTINCT FROM contract."tenantId"
         )
       )
       OR (
         contract."contratoRenovaId" IS NOT NULL
         AND (
           renewal."id" IS NULL
           OR renewal."tenantId" IS DISTINCT FROM contract."tenantId"
         )
       )
  ) THEN
    RAISE EXCEPTION
      'Cannot enable contract RLS: a contract has a missing or cross-tenant relationship';
  END IF;
END;
$$;

ALTER TABLE "contratos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contratos" FORCE ROW LEVEL SECURITY;

CREATE POLICY "contratos_tenant_select" ON "contratos"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "contratos"."empleadoId"
        AND employee."tenantId" = "contratos"."tenantId"
    )
    AND (
      "sedeId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "sedes" site
        WHERE site."id" = "contratos"."sedeId"
          AND site."tenantId" = "contratos"."tenantId"
      )
    )
    AND (
      "plantillaId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "plantillas" template
        WHERE template."id" = "contratos"."plantillaId"
          AND template."tenantId" = "contratos"."tenantId"
      )
    )
    AND (
      "loteId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "lotes_contrato" batch
        WHERE batch."id" = "contratos"."loteId"
          AND batch."tenantId" = "contratos"."tenantId"
      )
    )
    AND (
      "perfilContractualId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "perfiles_contractuales" profile
        WHERE profile."id" = "contratos"."perfilContractualId"
          AND profile."tenantId" = "contratos"."tenantId"
      )
    )
  );

CREATE POLICY "contratos_tenant_insert" ON "contratos"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "contratos"."empleadoId"
        AND employee."tenantId" = "contratos"."tenantId"
    )
    AND (
      "sedeId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "sedes" site
        WHERE site."id" = "contratos"."sedeId"
          AND site."tenantId" = "contratos"."tenantId"
      )
    )
    AND (
      "plantillaId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "plantillas" template
        WHERE template."id" = "contratos"."plantillaId"
          AND template."tenantId" = "contratos"."tenantId"
      )
    )
    AND (
      "loteId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "lotes_contrato" batch
        WHERE batch."id" = "contratos"."loteId"
          AND batch."tenantId" = "contratos"."tenantId"
      )
    )
    AND (
      "perfilContractualId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "perfiles_contractuales" profile
        WHERE profile."id" = "contratos"."perfilContractualId"
          AND profile."tenantId" = "contratos"."tenantId"
      )
    )
  );

CREATE POLICY "contratos_tenant_update" ON "contratos"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "contratos"."empleadoId"
        AND employee."tenantId" = "contratos"."tenantId"
    )
    AND (
      "sedeId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "sedes" site
        WHERE site."id" = "contratos"."sedeId"
          AND site."tenantId" = "contratos"."tenantId"
      )
    )
    AND (
      "plantillaId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "plantillas" template
        WHERE template."id" = "contratos"."plantillaId"
          AND template."tenantId" = "contratos"."tenantId"
      )
    )
    AND (
      "loteId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "lotes_contrato" batch
        WHERE batch."id" = "contratos"."loteId"
          AND batch."tenantId" = "contratos"."tenantId"
      )
    )
    AND (
      "perfilContractualId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "perfiles_contractuales" profile
        WHERE profile."id" = "contratos"."perfilContractualId"
          AND profile."tenantId" = "contratos"."tenantId"
      )
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "empleados" employee
      WHERE employee."id" = "contratos"."empleadoId"
        AND employee."tenantId" = "contratos"."tenantId"
    )
    AND (
      "sedeId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "sedes" site
        WHERE site."id" = "contratos"."sedeId"
          AND site."tenantId" = "contratos"."tenantId"
      )
    )
    AND (
      "plantillaId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "plantillas" template
        WHERE template."id" = "contratos"."plantillaId"
          AND template."tenantId" = "contratos"."tenantId"
      )
    )
    AND (
      "loteId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "lotes_contrato" batch
        WHERE batch."id" = "contratos"."loteId"
          AND batch."tenantId" = "contratos"."tenantId"
      )
    )
    AND (
      "perfilContractualId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "perfiles_contractuales" profile
        WHERE profile."id" = "contratos"."perfilContractualId"
          AND profile."tenantId" = "contratos"."tenantId"
      )
    )
  );

-- Contracts are historical employment records; the current API has no hard-delete flow.
