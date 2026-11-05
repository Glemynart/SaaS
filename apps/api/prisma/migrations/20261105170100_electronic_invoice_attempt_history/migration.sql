CREATE TYPE "TipoIntentoFacturaElectronica" AS ENUM ('ENVIO', 'CONCILIACION');
CREATE TYPE "EstadoResultadoIntentoFacturaElectronica" AS ENUM (
  'ACEPTADO',
  'RECHAZADO',
  'PENDIENTE',
  'DESCONOCIDO',
  'ERROR_TECNICO'
);

CREATE TABLE "transmisiones_facturas_electronicas" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "facturaElectronicaId" TEXT NOT NULL,
  "eventoId" VARCHAR(120) NOT NULL,
  "claveIdempotencia" CHAR(64) NOT NULL,
  "versionPayload" VARCHAR(40) NOT NULL,
  "hashPayload" CHAR(64) NOT NULL,
  "payloadCanonico" TEXT NOT NULL,
  "providerId" VARCHAR(80) NOT NULL,
  "contractVersion" VARCHAR(80) NOT NULL,
  "ultimoIntento" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "transmisiones_facturas_electronicas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transmisiones_fe_attempt_count_check" CHECK ("ultimoIntento" >= 0),
  CONSTRAINT "transmisiones_fe_hash_format_check" CHECK (
    "claveIdempotencia" ~ '^[0-9a-f]{64}$' AND "hashPayload" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "transmisiones_fe_event_not_blank_check" CHECK (length(btrim("eventoId")) > 0),
  CONSTRAINT "transmisiones_fe_provider_not_blank_check" CHECK (
    length(btrim("providerId")) > 0 AND length(btrim("contractVersion")) > 0
  ),
  CONSTRAINT "transmisiones_fe_invoice_tenant_fkey"
    FOREIGN KEY ("facturaElectronicaId", "tenantId")
    REFERENCES "facturas_electronicas"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "transmisiones_fe_id_tenant_key"
  ON "transmisiones_facturas_electronicas"("id", "tenantId");
CREATE UNIQUE INDEX "transmisiones_fe_id_tenant_invoice_key"
  ON "transmisiones_facturas_electronicas"("id", "tenantId", "facturaElectronicaId");
CREATE UNIQUE INDEX "transmisiones_fe_tenant_idempotency_key"
  ON "transmisiones_facturas_electronicas"("tenantId", "claveIdempotencia");
CREATE UNIQUE INDEX "transmisiones_fe_tenant_invoice_event_key"
  ON "transmisiones_facturas_electronicas"("tenantId", "facturaElectronicaId", "eventoId");
CREATE INDEX "transmisiones_fe_tenant_created_idx"
  ON "transmisiones_facturas_electronicas"("tenantId", "createdAt");

CREATE TABLE "intentos_facturas_electronicas" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "transmisionId" TEXT NOT NULL,
  "numeroIntento" INTEGER NOT NULL,
  "tipo" "TipoIntentoFacturaElectronica" NOT NULL,
  "providerId" VARCHAR(80) NOT NULL,
  "contractVersion" VARCHAR(80) NOT NULL,
  "iniciadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "intentos_facturas_electronicas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "intentos_fe_sequence_check" CHECK ("numeroIntento" > 0),
  CONSTRAINT "intentos_fe_provider_not_blank_check" CHECK (
    length(btrim("providerId")) > 0 AND length(btrim("contractVersion")) > 0
  ),
  CONSTRAINT "intentos_fe_transmission_tenant_fkey"
    FOREIGN KEY ("transmisionId", "tenantId")
    REFERENCES "transmisiones_facturas_electronicas"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "intentos_fe_id_tenant_key"
  ON "intentos_facturas_electronicas"("id", "tenantId");
CREATE UNIQUE INDEX "intentos_fe_id_tenant_transmission_key"
  ON "intentos_facturas_electronicas"("id", "tenantId", "transmisionId");
CREATE UNIQUE INDEX "intentos_fe_tenant_transmission_sequence_key"
  ON "intentos_facturas_electronicas"("tenantId", "transmisionId", "numeroIntento");
CREATE INDEX "intentos_fe_tenant_transmission_started_idx"
  ON "intentos_facturas_electronicas"("tenantId", "transmisionId", "iniciadoEn");

CREATE TABLE "resultados_intentos_facturas_electronicas" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "intentoId" TEXT NOT NULL,
  "estado" "EstadoResultadoIntentoFacturaElectronica" NOT NULL,
  "providerReference" VARCHAR(200),
  "providerAcceptedAt" TIMESTAMP(3),
  "codigoError" VARCHAR(100),
  "receiptConfirmedAbsent" BOOLEAN NOT NULL DEFAULT false,
  "contenidoTypeEvidencia" VARCHAR(120),
  "storageKeyEvidencia" VARCHAR(500),
  "sha256Evidencia" CHAR(64),
  "issues" JSONB,
  "finalizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resultados_intentos_facturas_electronicas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "resultados_intento_fe_evidence_check" CHECK (
    ("storageKeyEvidencia" IS NULL AND "sha256Evidencia" IS NULL AND "contenidoTypeEvidencia" IS NULL)
    OR
    (
      "storageKeyEvidencia" IS NOT NULL
      AND "sha256Evidencia" IS NOT NULL
      AND "contenidoTypeEvidencia" IS NOT NULL
      AND "storageKeyEvidencia" LIKE "tenantId" || '/facturacion-electronica/%'
      AND "sha256Evidencia" ~ '^[0-9a-f]{64}$'
      AND "contenidoTypeEvidencia" IN (
        'application/json', 'application/pdf', 'application/xml',
        'application/octet-stream', 'text/xml'
      )
    )
  ),
  CONSTRAINT "resultados_intento_fe_attempt_tenant_fkey"
    FOREIGN KEY ("intentoId", "tenantId")
    REFERENCES "intentos_facturas_electronicas"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "resultados_intento_fe_attempt_key"
  ON "resultados_intentos_facturas_electronicas"("intentoId");
CREATE UNIQUE INDEX "resultados_intento_fe_attempt_tenant_key"
  ON "resultados_intentos_facturas_electronicas"("intentoId", "tenantId");
CREATE UNIQUE INDEX "resultados_intento_fe_id_tenant_key"
  ON "resultados_intentos_facturas_electronicas"("id", "tenantId");
CREATE INDEX "resultados_intento_fe_tenant_status_idx"
  ON "resultados_intentos_facturas_electronicas"("tenantId", "estado", "finalizadoEn");

CREATE TABLE "transiciones_facturas_electronicas" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "facturaElectronicaId" TEXT NOT NULL,
  "transmisionId" TEXT NOT NULL,
  "intentoId" TEXT,
  "desde" "EstadoFacturaElectronica",
  "hasta" "EstadoFacturaElectronica" NOT NULL,
  "evento" VARCHAR(40) NOT NULL,
  "actorUserId" TEXT,
  CONSTRAINT "transiciones_facturas_electronicas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transiciones_fe_event_not_blank_check" CHECK (length(btrim("evento")) > 0),
  CONSTRAINT "transiciones_fe_invoice_tenant_fkey"
    FOREIGN KEY ("facturaElectronicaId", "tenantId")
    REFERENCES "facturas_electronicas"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transiciones_fe_transmission_invoice_tenant_fkey"
    FOREIGN KEY ("transmisionId", "tenantId", "facturaElectronicaId")
    REFERENCES "transmisiones_facturas_electronicas"("id", "tenantId", "facturaElectronicaId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transiciones_fe_attempt_transmission_tenant_fkey"
    FOREIGN KEY ("intentoId", "tenantId", "transmisionId")
    REFERENCES "intentos_facturas_electronicas"("id", "tenantId", "transmisionId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "transiciones_fe_id_tenant_key"
  ON "transiciones_facturas_electronicas"("id", "tenantId");
CREATE INDEX "transiciones_fe_tenant_invoice_created_idx"
  ON "transiciones_facturas_electronicas"("tenantId", "facturaElectronicaId", "createdAt");
CREATE INDEX "transiciones_fe_tenant_transmission_created_idx"
  ON "transiciones_facturas_electronicas"("tenantId", "transmisionId", "createdAt");

ALTER TABLE "transmisiones_facturas_electronicas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transmisiones_facturas_electronicas" FORCE ROW LEVEL SECURITY;
CREATE POLICY "transmisiones_fe_tenant_policy"
  ON "transmisiones_facturas_electronicas"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));

ALTER TABLE "intentos_facturas_electronicas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intentos_facturas_electronicas" FORCE ROW LEVEL SECURITY;
CREATE POLICY "intentos_fe_tenant_policy"
  ON "intentos_facturas_electronicas"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));

ALTER TABLE "resultados_intentos_facturas_electronicas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resultados_intentos_facturas_electronicas" FORCE ROW LEVEL SECURITY;
CREATE POLICY "resultados_intento_fe_tenant_policy"
  ON "resultados_intentos_facturas_electronicas"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));

ALTER TABLE "transiciones_facturas_electronicas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transiciones_facturas_electronicas" FORCE ROW LEVEL SECURITY;
CREATE POLICY "transiciones_fe_tenant_policy"
  ON "transiciones_facturas_electronicas"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));

CREATE FUNCTION "protect_fe_transmission_identity"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF pg_trigger_depth() > 1 THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Electronic invoice transmission events are immutable';
  END IF;

  IF ROW(
    OLD."id", OLD."createdAt", OLD."tenantId", OLD."facturaElectronicaId", OLD."eventoId",
    OLD."claveIdempotencia", OLD."versionPayload", OLD."hashPayload",
    OLD."payloadCanonico", OLD."providerId", OLD."contractVersion"
  ) IS DISTINCT FROM ROW(
    NEW."id", NEW."createdAt", NEW."tenantId", NEW."facturaElectronicaId", NEW."eventoId",
    NEW."claveIdempotencia", NEW."versionPayload", NEW."hashPayload",
    NEW."payloadCanonico", NEW."providerId", NEW."contractVersion"
  ) THEN
    RAISE EXCEPTION 'Electronic invoice transmission identity and payload are immutable';
  END IF;

  IF NEW."ultimoIntento" < OLD."ultimoIntento"
     OR NEW."ultimoIntento" > OLD."ultimoIntento" + 1 THEN
    RAISE EXCEPTION 'Electronic invoice attempt sequence can only advance by one';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "transmisiones_fe_preserve_history"
  BEFORE UPDATE OR DELETE ON "transmisiones_facturas_electronicas"
  FOR EACH ROW EXECUTE FUNCTION "protect_fe_transmission_identity"();

CREATE FUNCTION "validate_fe_attempt_provider"() RETURNS trigger AS $$
DECLARE
  current_attempt INTEGER;
BEGIN
  SELECT transmission."ultimoIntento" INTO current_attempt
  FROM "transmisiones_facturas_electronicas" transmission
  WHERE transmission."id" = NEW."transmisionId"
    AND transmission."tenantId" = NEW."tenantId"
    AND transmission."providerId" = NEW."providerId"
    AND transmission."contractVersion" = NEW."contractVersion";

  IF current_attempt IS NULL THEN
    RAISE EXCEPTION 'Electronic invoice attempt provider must match its transmission';
  END IF;
  IF current_attempt IS DISTINCT FROM NEW."numeroIntento" THEN
    RAISE EXCEPTION 'Electronic invoice attempt sequence must match its transmission';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "intentos_fe_match_transmission_provider"
  BEFORE INSERT ON "intentos_facturas_electronicas"
  FOR EACH ROW EXECUTE FUNCTION "validate_fe_attempt_provider"();

CREATE FUNCTION "require_fe_evidence_for_terminal_state"() RETURNS trigger AS $$
DECLARE
  expected_result "EstadoResultadoIntentoFacturaElectronica";
  has_evidence BOOLEAN;
BEGIN
  IF NEW."estado" = 'ACEPTADA' THEN
    expected_result := 'ACEPTADO';
  ELSIF NEW."estado" = 'RECHAZADA' THEN
    expected_result := 'RECHAZADO';
  ELSE
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR NEW."estado" IS DISTINCT FROM OLD."estado" THEN
    SELECT EXISTS (
      SELECT 1
      FROM "transmisiones_facturas_electronicas" transmission
      JOIN "intentos_facturas_electronicas" attempt
        ON attempt."transmisionId" = transmission."id"
       AND attempt."tenantId" = transmission."tenantId"
      JOIN "resultados_intentos_facturas_electronicas" result
        ON result."intentoId" = attempt."id"
       AND result."tenantId" = attempt."tenantId"
      WHERE transmission."facturaElectronicaId" = NEW."id"
        AND transmission."tenantId" = NEW."tenantId"
        AND result."estado" = expected_result
        AND result."storageKeyEvidencia" IS NOT NULL
        AND result."sha256Evidencia" IS NOT NULL
    ) INTO has_evidence;

    IF NOT has_evidence THEN
      RAISE EXCEPTION 'Electronic invoice acceptance/rejection requires persisted evidence';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "facturas_electronicas_require_transmission_evidence"
  BEFORE INSERT OR UPDATE OF "estado" ON "facturas_electronicas"
  FOR EACH ROW EXECUTE FUNCTION "require_fe_evidence_for_terminal_state"();

CREATE FUNCTION "protect_fe_append_only"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Electronic invoice attempts, outcomes, and transitions are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "intentos_fe_append_only"
  BEFORE UPDATE OR DELETE ON "intentos_facturas_electronicas"
  FOR EACH ROW EXECUTE FUNCTION "protect_fe_append_only"();
CREATE TRIGGER "resultados_intento_fe_append_only"
  BEFORE UPDATE OR DELETE ON "resultados_intentos_facturas_electronicas"
  FOR EACH ROW EXECUTE FUNCTION "protect_fe_append_only"();
CREATE TRIGGER "transiciones_fe_append_only"
  BEFORE UPDATE OR DELETE ON "transiciones_facturas_electronicas"
  FOR EACH ROW EXECUTE FUNCTION "protect_fe_append_only"();
