CREATE TYPE "AmbienteEmisorElectronico" AS ENUM ('HABILITACION', 'PRODUCCION');
CREATE TYPE "TipoDocumentoElectronico" AS ENUM ('FACTURA_VENTA');
CREATE TYPE "EstadoRangoNumeracionElectronica" AS ENUM ('ACTIVO', 'INACTIVO');

CREATE TABLE "perfiles_emisor_electronicos" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "ambiente" "AmbienteEmisorElectronico" NOT NULL,
  "responsabilidadesTributarias" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "perfiles_emisor_electronicos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "perfiles_emisor_fe_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "perfiles_emisor_fe_id_tenant_key"
  ON "perfiles_emisor_electronicos"("id", "tenantId");
CREATE UNIQUE INDEX "perfiles_emisor_fe_tenant_ambiente_key"
  ON "perfiles_emisor_electronicos"("tenantId", "ambiente");

CREATE TABLE "rangos_numeracion_electronica" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "perfilEmisorId" TEXT NOT NULL,
  "tipoDocumento" "TipoDocumentoElectronico" NOT NULL DEFAULT 'FACTURA_VENTA',
  "numeroAutorizacion" VARCHAR(50) NOT NULL,
  "fechaAutorizacion" DATE NOT NULL,
  "vigenciaDesde" DATE NOT NULL,
  "vigenciaHasta" DATE NOT NULL,
  "prefijo" VARCHAR(4) NOT NULL DEFAULT '',
  "numeroDesde" INTEGER NOT NULL,
  "numeroHasta" INTEGER NOT NULL,
  "ultimoNumeroAsignado" INTEGER NOT NULL,
  "estado" "EstadoRangoNumeracionElectronica" NOT NULL DEFAULT 'ACTIVO',
  "inactivadoAt" TIMESTAMP(3),
  "motivoInactivacion" VARCHAR(500),
  CONSTRAINT "rangos_numeracion_electronica_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rangos_fe_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "rangos_fe_profile_tenant_fkey"
    FOREIGN KEY ("perfilEmisorId", "tenantId")
    REFERENCES "perfiles_emisor_electronicos"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "rangos_fe_authorization_check"
    CHECK (length(btrim("numeroAutorizacion")) > 0),
  CONSTRAINT "rangos_fe_dates_check"
    CHECK (
      "fechaAutorizacion" <= "vigenciaDesde"
      AND "vigenciaDesde" <= "vigenciaHasta"
      AND "vigenciaHasta" <= ("fechaAutorizacion" + INTERVAL '2 years')::date
    ),
  CONSTRAINT "rangos_fe_prefix_check"
    CHECK ("prefijo" ~ '^[A-Z0-9]{0,4}$'),
  CONSTRAINT "rangos_fe_numbers_check"
    CHECK (
      "numeroDesde" > 0
      AND "numeroHasta" >= "numeroDesde"
      AND "ultimoNumeroAsignado" >= "numeroDesde" - 1
      AND "ultimoNumeroAsignado" <= "numeroHasta"
    ),
  CONSTRAINT "rangos_fe_inactivation_check"
    CHECK (
      ("estado" = 'ACTIVO' AND "inactivadoAt" IS NULL AND "motivoInactivacion" IS NULL)
      OR
      ("estado" = 'INACTIVO' AND "inactivadoAt" IS NOT NULL AND length(btrim("motivoInactivacion")) >= 8)
    )
);

CREATE UNIQUE INDEX "rangos_fe_id_tenant_key"
  ON "rangos_numeracion_electronica"("id", "tenantId");
CREATE INDEX "rangos_fe_tenant_profile_state_validity_idx"
  ON "rangos_numeracion_electronica"("tenantId", "perfilEmisorId", "estado", "vigenciaHasta");
CREATE INDEX "rangos_fe_tenant_prefix_numbers_idx"
  ON "rangos_numeracion_electronica"("tenantId", "prefijo", "numeroDesde", "numeroHasta");

ALTER TABLE "facturas_electronicas"
  ADD COLUMN "rangoNumeracionId" TEXT;
ALTER TABLE "facturas_electronicas"
  ADD CONSTRAINT "facturas_fe_range_tenant_fkey"
  FOREIGN KEY ("rangoNumeracionId", "tenantId")
  REFERENCES "rangos_numeracion_electronica"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "facturas_electronicas"
  DROP CONSTRAINT "facturas_electronicas_processing_number_check";
ALTER TABLE "facturas_electronicas"
  ADD CONSTRAINT "facturas_electronicas_processing_number_check"
  CHECK (
    "estado" IN ('BORRADOR', 'LISTA_PARA_EMITIR')
    OR ("prefijo" IS NOT NULL AND "numero" IS NOT NULL AND "rangoNumeracionId" IS NOT NULL)
  );

ALTER TABLE "perfiles_emisor_electronicos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "perfiles_emisor_electronicos" FORCE ROW LEVEL SECURITY;
CREATE POLICY "perfiles_emisor_fe_tenant_policy"
  ON "perfiles_emisor_electronicos"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));

ALTER TABLE "rangos_numeracion_electronica" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rangos_numeracion_electronica" FORCE ROW LEVEL SECURITY;
CREATE POLICY "rangos_fe_tenant_policy"
  ON "rangos_numeracion_electronica"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));

CREATE FUNCTION "protect_perfil_emisor_fe"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND ROW(OLD."id", OLD."tenantId", OLD."ambiente")
     IS DISTINCT FROM ROW(NEW."id", NEW."tenantId", NEW."ambiente") THEN
    RAISE EXCEPTION 'Electronic issuer profile identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "perfiles_emisor_fe_identity_immutable"
  BEFORE UPDATE ON "perfiles_emisor_electronicos"
  FOR EACH ROW EXECUTE FUNCTION "protect_perfil_emisor_fe"();

CREATE FUNCTION "protect_rango_numeracion_fe"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF pg_trigger_depth() > 1 THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Electronic invoice numbering ranges are historical records';
  END IF;

  IF ROW(
    OLD."id", OLD."tenantId", OLD."perfilEmisorId", OLD."tipoDocumento",
    OLD."numeroAutorizacion", OLD."fechaAutorizacion", OLD."vigenciaDesde",
    OLD."vigenciaHasta", OLD."prefijo", OLD."numeroDesde", OLD."numeroHasta"
  ) IS DISTINCT FROM ROW(
    NEW."id", NEW."tenantId", NEW."perfilEmisorId", NEW."tipoDocumento",
    NEW."numeroAutorizacion", NEW."fechaAutorizacion", NEW."vigenciaDesde",
    NEW."vigenciaHasta", NEW."prefijo", NEW."numeroDesde", NEW."numeroHasta"
  ) THEN
    RAISE EXCEPTION 'Electronic invoice numbering range terms are immutable';
  END IF;

  IF NEW."ultimoNumeroAsignado" < OLD."ultimoNumeroAsignado"
     OR NEW."ultimoNumeroAsignado" > OLD."ultimoNumeroAsignado" + 1 THEN
    RAISE EXCEPTION 'Electronic invoice numbering can only advance one number at a time';
  END IF;

  IF OLD."estado" = 'INACTIVO' AND NEW."estado" <> 'INACTIVO' THEN
    RAISE EXCEPTION 'An inactive electronic invoice numbering range cannot be reactivated';
  END IF;

  IF OLD."estado" = 'INACTIVO' AND ROW(
    NEW."ultimoNumeroAsignado", NEW."inactivadoAt", NEW."motivoInactivacion"
  ) IS DISTINCT FROM ROW(
    OLD."ultimoNumeroAsignado", OLD."inactivadoAt", OLD."motivoInactivacion"
  ) THEN
    RAISE EXCEPTION 'An inactive electronic invoice numbering range is immutable';
  END IF;

  IF OLD."estado" = 'ACTIVO' AND NEW."estado" = 'INACTIVO'
     AND (NEW."inactivadoAt" IS NULL OR length(btrim(NEW."motivoInactivacion")) < 8) THEN
    RAISE EXCEPTION 'Deactivating an electronic invoice numbering range requires a reason';
  END IF;

  IF NEW."estado" = 'ACTIVO' AND (NEW."inactivadoAt" IS NOT NULL OR NEW."motivoInactivacion" IS NOT NULL) THEN
    RAISE EXCEPTION 'An active electronic invoice numbering range cannot contain deactivation metadata';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "rangos_fe_preserve_history"
  BEFORE UPDATE OR DELETE ON "rangos_numeracion_electronica"
  FOR EACH ROW EXECUTE FUNCTION "protect_rango_numeracion_fe"();

CREATE FUNCTION "prevent_overlapping_rango_numeracion_fe"() RETURNS trigger AS $$
DECLARE
  target_environment "AmbienteEmisorElectronico";
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."tenantId", 1));

  SELECT "ambiente" INTO target_environment
  FROM "perfiles_emisor_electronicos"
  WHERE "id" = NEW."perfilEmisorId" AND "tenantId" = NEW."tenantId";

  IF target_environment IS NULL THEN
    RAISE EXCEPTION 'Electronic issuer profile was not found for this tenant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "rangos_numeracion_electronica" existing_range
    JOIN "perfiles_emisor_electronicos" existing_profile
      ON existing_profile."id" = existing_range."perfilEmisorId"
     AND existing_profile."tenantId" = existing_range."tenantId"
    WHERE existing_range."tenantId" = NEW."tenantId"
      AND existing_profile."ambiente" = target_environment
      AND existing_range."tipoDocumento" = NEW."tipoDocumento"
      AND existing_range."prefijo" = NEW."prefijo"
      AND existing_range."id" IS DISTINCT FROM NEW."id"
      AND existing_range."numeroDesde" <= NEW."numeroHasta"
      AND existing_range."numeroHasta" >= NEW."numeroDesde"
  ) THEN
    RAISE EXCEPTION 'Electronic invoice numbering ranges cannot reuse an authorized number';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "rangos_fe_no_number_overlap"
  BEFORE INSERT OR UPDATE OF "tenantId", "perfilEmisorId", "tipoDocumento", "prefijo", "numeroDesde", "numeroHasta"
  ON "rangos_numeracion_electronica"
  FOR EACH ROW EXECUTE FUNCTION "prevent_overlapping_rango_numeracion_fe"();

CREATE FUNCTION "validate_factura_electronica_range"() RETURNS trigger AS $$
DECLARE
  selected_range "rangos_numeracion_electronica"%ROWTYPE;
BEGIN
  IF NEW."numero" IS NULL THEN
    IF NEW."rangoNumeracionId" IS NOT NULL THEN
      RAISE EXCEPTION 'A draft electronic invoice cannot reserve a numbering range';
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO selected_range
  FROM "rangos_numeracion_electronica"
  WHERE "id" = NEW."rangoNumeracionId" AND "tenantId" = NEW."tenantId";

  IF NOT FOUND
     OR NEW."numero" < selected_range."numeroDesde"
     OR NEW."numero" > selected_range."numeroHasta"
     OR NEW."numero" <> selected_range."ultimoNumeroAsignado"
     OR COALESCE(NEW."prefijo", '') <> selected_range."prefijo"
     OR selected_range."estado" <> 'ACTIVO'
     OR NEW."fechaEmision" IS NULL
     OR NEW."fechaEmision" < selected_range."vigenciaDesde"
     OR NEW."fechaEmision" > selected_range."vigenciaHasta" THEN
    RAISE EXCEPTION 'Electronic invoice number does not match its authorized tenant range';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "facturas_fe_validate_numbering_range"
  BEFORE INSERT OR UPDATE OF "tenantId", "numero", "prefijo", "rangoNumeracionId"
  ON "facturas_electronicas"
  FOR EACH ROW EXECUTE FUNCTION "validate_factura_electronica_range"();

CREATE OR REPLACE FUNCTION "protect_numbered_factura_electronica"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."numero" IS NOT NULL AND pg_trigger_depth() <= 1 THEN
      RAISE EXCEPTION 'A numbered electronic invoice cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."id" IS DISTINCT FROM NEW."id"
     OR OLD."tenantId" IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'Electronic invoice identity is immutable';
  END IF;

  IF OLD."numero" IS NOT NULL AND ROW(
    NEW."moneda",
    NEW."emisorSnapshot",
    NEW."adquirenteSnapshot",
    NEW."fechaEmision",
    NEW."prefijo",
    NEW."numero",
    NEW."rangoNumeracionId",
    NEW."subtotal",
    NEW."impuestos",
    NEW."total"
  ) IS DISTINCT FROM ROW(
    OLD."moneda",
    OLD."emisorSnapshot",
    OLD."adquirenteSnapshot",
    OLD."fechaEmision",
    OLD."prefijo",
    OLD."numero",
    OLD."rangoNumeracionId",
    OLD."subtotal",
    OLD."impuestos",
    OLD."total"
  ) THEN
    RAISE EXCEPTION 'A numbered electronic invoice snapshot is immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
