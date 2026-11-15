-- Validate tenant ownership before extending RLS to the site and labor
-- metadata referenced by employees, contracts, and document resolution.
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
      FROM "empleados" employee
      LEFT JOIN "sedes" site ON site."id" = employee."sedeId"
      WHERE employee."tenantId" = tenant_id_value
        AND employee."sedeId" IS NOT NULL
        AND (
          site."id" IS NULL
          OR site."tenantId" IS DISTINCT FROM employee."tenantId"
        )
    ) OR EXISTS (
      SELECT 1
      FROM "contratos" contract
      LEFT JOIN "sedes" site ON site."id" = contract."sedeId"
      WHERE contract."tenantId" = tenant_id_value
        AND contract."sedeId" IS NOT NULL
        AND (
          site."id" IS NULL
          OR site."tenantId" IS DISTINCT FROM contract."tenantId"
        )
    ) OR EXISTS (
      SELECT 1
      FROM "lotes_contrato" batch
      LEFT JOIN "sedes" site ON site."id" = batch."sedeId"
      WHERE batch."tenantId" = tenant_id_value
        AND batch."sedeId" IS NOT NULL
        AND (
          site."id" IS NULL
          OR site."tenantId" IS DISTINCT FROM batch."tenantId"
        )
    ) OR EXISTS (
      SELECT 1
      FROM "centros_costo" cost_center
      LEFT JOIN "sedes" site ON site."id" = cost_center."sedeId"
      WHERE cost_center."tenantId" = tenant_id_value
        AND cost_center."sedeId" IS NOT NULL
        AND (
          site."id" IS NULL
          OR site."tenantId" IS DISTINCT FROM cost_center."tenantId"
        )
    ) OR EXISTS (
      SELECT 1
      FROM "vinculos_laborales" relationship
      LEFT JOIN "empleados" employee
        ON employee."id" = relationship."empleadoId"
      LEFT JOIN "perfiles_contractuales" profile
        ON profile."id" = relationship."perfilContractualId"
      WHERE relationship."tenantId" = tenant_id_value
        AND (
          employee."id" IS NULL
          OR employee."tenantId" IS DISTINCT FROM relationship."tenantId"
          OR profile."id" IS NULL
          OR profile."tenantId" IS DISTINCT FROM relationship."tenantId"
        )
    ) OR EXISTS (
      SELECT 1
      FROM "configuraciones_documentales_perfil" configuration
      LEFT JOIN "perfiles_contractuales" profile
        ON profile."id" = configuration."perfilContractualId"
      LEFT JOIN "document_templates" template
        ON template."id" = configuration."plantillaId"
      WHERE configuration."tenantId" = tenant_id_value
        AND (
          profile."id" IS NULL
          OR profile."tenantId" IS DISTINCT FROM configuration."tenantId"
          OR template."id" IS NULL
          OR template."tenantId" IS DISTINCT FROM configuration."tenantId"
        )
    ) THEN
      RAISE EXCEPTION
        'Cannot enable site and labor metadata RLS: a tenant-owned row has a missing or cross-tenant relationship';
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE "sedes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sedes" FORCE ROW LEVEL SECURITY;

CREATE POLICY "sedes_tenant_select" ON "sedes"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "sedes_tenant_insert" ON "sedes"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "sedes_tenant_update" ON "sedes"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

-- Profiles are tenant-owned catalog data. The product exposes deactivation,
-- not physical deletion, so there is deliberately no DELETE policy.
ALTER TABLE "perfiles_contractuales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "perfiles_contractuales" FORCE ROW LEVEL SECURITY;

CREATE POLICY "perfiles_contractuales_tenant_select" ON "perfiles_contractuales"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "perfiles_contractuales_tenant_insert" ON "perfiles_contractuales"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "perfiles_contractuales_tenant_update" ON "perfiles_contractuales"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

ALTER TABLE "vinculos_laborales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vinculos_laborales" FORCE ROW LEVEL SECURITY;

CREATE POLICY "vinculos_laborales_tenant_select" ON "vinculos_laborales"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM "empleados" employee
      WHERE employee."id" = "vinculos_laborales"."empleadoId"
        AND employee."tenantId" = "vinculos_laborales"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "perfiles_contractuales" profile
      WHERE profile."id" = "vinculos_laborales"."perfilContractualId"
        AND profile."tenantId" = "vinculos_laborales"."tenantId"
    )
  );

CREATE POLICY "vinculos_laborales_tenant_insert" ON "vinculos_laborales"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM "empleados" employee
      WHERE employee."id" = "vinculos_laborales"."empleadoId"
        AND employee."tenantId" = "vinculos_laborales"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "perfiles_contractuales" profile
      WHERE profile."id" = "vinculos_laborales"."perfilContractualId"
        AND profile."tenantId" = "vinculos_laborales"."tenantId"
    )
  );

CREATE POLICY "vinculos_laborales_tenant_update" ON "vinculos_laborales"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM "empleados" employee
      WHERE employee."id" = "vinculos_laborales"."empleadoId"
        AND employee."tenantId" = "vinculos_laborales"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "perfiles_contractuales" profile
      WHERE profile."id" = "vinculos_laborales"."perfilContractualId"
        AND profile."tenantId" = "vinculos_laborales"."tenantId"
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM "empleados" employee
      WHERE employee."id" = "vinculos_laborales"."empleadoId"
        AND employee."tenantId" = "vinculos_laborales"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "perfiles_contractuales" profile
      WHERE profile."id" = "vinculos_laborales"."perfilContractualId"
        AND profile."tenantId" = "vinculos_laborales"."tenantId"
    )
  );

ALTER TABLE "configuraciones_documentales_perfil" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "configuraciones_documentales_perfil" FORCE ROW LEVEL SECURITY;

CREATE POLICY "configuraciones_documentales_perfil_tenant_select"
  ON "configuraciones_documentales_perfil"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM "perfiles_contractuales" profile
      WHERE profile."id" = "configuraciones_documentales_perfil"."perfilContractualId"
        AND profile."tenantId" = "configuraciones_documentales_perfil"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "document_templates" template
      WHERE template."id" = "configuraciones_documentales_perfil"."plantillaId"
        AND template."tenantId" = "configuraciones_documentales_perfil"."tenantId"
    )
  );

CREATE POLICY "configuraciones_documentales_perfil_tenant_insert"
  ON "configuraciones_documentales_perfil"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM "perfiles_contractuales" profile
      WHERE profile."id" = "configuraciones_documentales_perfil"."perfilContractualId"
        AND profile."tenantId" = "configuraciones_documentales_perfil"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "document_templates" template
      WHERE template."id" = "configuraciones_documentales_perfil"."plantillaId"
        AND template."tenantId" = "configuraciones_documentales_perfil"."tenantId"
    )
  );

CREATE POLICY "configuraciones_documentales_perfil_tenant_update"
  ON "configuraciones_documentales_perfil"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM "perfiles_contractuales" profile
      WHERE profile."id" = "configuraciones_documentales_perfil"."perfilContractualId"
        AND profile."tenantId" = "configuraciones_documentales_perfil"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "document_templates" template
      WHERE template."id" = "configuraciones_documentales_perfil"."plantillaId"
        AND template."tenantId" = "configuraciones_documentales_perfil"."tenantId"
    )
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1 FROM "perfiles_contractuales" profile
      WHERE profile."id" = "configuraciones_documentales_perfil"."perfilContractualId"
        AND profile."tenantId" = "configuraciones_documentales_perfil"."tenantId"
    )
    AND EXISTS (
      SELECT 1 FROM "document_templates" template
      WHERE template."id" = "configuraciones_documentales_perfil"."plantillaId"
        AND template."tenantId" = "configuraciones_documentales_perfil"."tenantId"
    )
  );

-- These records are deactivated or closed by the domain services; no physical
-- delete policy is granted for sites, profiles, relationships, or mappings.
