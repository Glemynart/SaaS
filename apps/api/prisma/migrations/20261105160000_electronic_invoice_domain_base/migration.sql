CREATE TYPE "EstadoFacturaElectronica" AS ENUM (
  'BORRADOR',
  'LISTA_PARA_EMITIR',
  'EN_COLA',
  'EN_TRANSMISION',
  'PENDIENTE_CONCILIACION',
  'ACEPTADA',
  'RECHAZADA',
  'ERROR_TECNICO'
);

CREATE TABLE "facturas_electronicas" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "estado" "EstadoFacturaElectronica" NOT NULL DEFAULT 'BORRADOR',
  "moneda" CHAR(3) NOT NULL DEFAULT 'COP',
  "emisorSnapshot" JSONB,
  "adquirenteSnapshot" JSONB,
  "fechaEmision" DATE,
  "prefijo" VARCHAR(10),
  "numero" INTEGER,
  "cufe" VARCHAR(120),
  "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "impuestos" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "versionAgregado" INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "facturas_electronicas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "facturas_electronicas_amounts_check"
    CHECK ("subtotal" >= 0 AND "impuestos" >= 0 AND "total" = "subtotal" + "impuestos"),
  CONSTRAINT "facturas_electronicas_currency_check"
    CHECK ("moneda" = 'COP'),
  CONSTRAINT "facturas_electronicas_version_check"
    CHECK ("versionAgregado" > 0),
  CONSTRAINT "facturas_electronicas_number_check"
    CHECK (("prefijo" IS NULL AND "numero" IS NULL) OR ("prefijo" IS NOT NULL AND "numero" > 0)),
  CONSTRAINT "facturas_electronicas_processing_number_check"
    CHECK ("estado" IN ('BORRADOR', 'LISTA_PARA_EMITIR') OR ("prefijo" IS NOT NULL AND "numero" IS NOT NULL)),
  CONSTRAINT "facturas_electronicas_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "facturas_electronicas_id_tenant_key"
  ON "facturas_electronicas"("id", "tenantId");
CREATE UNIQUE INDEX "facturas_electronicas_tenant_number_key"
  ON "facturas_electronicas"("tenantId", "prefijo", "numero");
CREATE INDEX "facturas_electronicas_tenant_status_created_idx"
  ON "facturas_electronicas"("tenantId", "estado", "createdAt");

CREATE TABLE "lineas_facturas_electronicas" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "facturaElectronicaId" TEXT NOT NULL,
  "productoSnapshot" JSONB,
  "descripcion" VARCHAR(500) NOT NULL,
  "unidad" VARCHAR(10) NOT NULL,
  "cantidad" DECIMAL(12,3) NOT NULL,
  "valorUnitario" DECIMAL(14,2) NOT NULL,
  "descuento" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "porcentajeImpuesto" DECIMAL(5,2),
  "subtotal" DECIMAL(14,2) NOT NULL,
  "impuestos" DECIMAL(14,2) NOT NULL,
  "total" DECIMAL(14,2) NOT NULL,

  CONSTRAINT "lineas_facturas_electronicas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lineas_fe_amounts_check"
    CHECK (
      "cantidad" > 0 AND "valorUnitario" >= 0 AND "descuento" >= 0
      AND "subtotal" >= 0 AND "impuestos" >= 0
      AND "total" = "subtotal" + "impuestos"
    ),
  CONSTRAINT "lineas_fe_tax_rate_check"
    CHECK ("porcentajeImpuesto" IS NULL OR "porcentajeImpuesto" BETWEEN 0 AND 100),
  CONSTRAINT "lineas_facturas_electronicas_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lineas_fe_invoice_tenant_fkey"
    FOREIGN KEY ("facturaElectronicaId", "tenantId")
    REFERENCES "facturas_electronicas"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "lineas_fe_tenant_invoice_idx"
  ON "lineas_facturas_electronicas"("tenantId", "facturaElectronicaId");

ALTER TABLE "facturas_electronicas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "facturas_electronicas" FORCE ROW LEVEL SECURITY;
CREATE POLICY "facturas_electronicas_tenant_policy"
  ON "facturas_electronicas"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));

ALTER TABLE "lineas_facturas_electronicas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lineas_facturas_electronicas" FORCE ROW LEVEL SECURITY;
CREATE POLICY "lineas_facturas_electronicas_tenant_policy"
  ON "lineas_facturas_electronicas"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));

CREATE FUNCTION "protect_numbered_factura_electronica"() RETURNS trigger AS $$
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
    OLD."subtotal",
    OLD."impuestos",
    OLD."total"
  ) THEN
    RAISE EXCEPTION 'A numbered electronic invoice snapshot is immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "facturas_electronicas_numbered_immutability"
  BEFORE UPDATE OR DELETE ON "facturas_electronicas"
  FOR EACH ROW EXECUTE FUNCTION "protect_numbered_factura_electronica"();

CREATE FUNCTION "protect_numbered_linea_factura_electronica"() RETURNS trigger AS $$
DECLARE
  parent_invoice_id TEXT;
  parent_tenant_id TEXT;
  parent_number INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND ROW(OLD."facturaElectronicaId", OLD."tenantId")
     IS DISTINCT FROM ROW(NEW."facturaElectronicaId", NEW."tenantId") THEN
    RAISE EXCEPTION 'Electronic invoice line identity is immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    parent_invoice_id := OLD."facturaElectronicaId";
    parent_tenant_id := OLD."tenantId";
  ELSE
    parent_invoice_id := NEW."facturaElectronicaId";
    parent_tenant_id := NEW."tenantId";
  END IF;

  SELECT "numero" INTO parent_number
  FROM "facturas_electronicas"
  WHERE "id" = parent_invoice_id AND "tenantId" = parent_tenant_id;

  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Electronic invoice line parent was not found';
  END IF;

  IF parent_number IS NOT NULL THEN
    IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Lines of a numbered electronic invoice are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "lineas_facturas_electronicas_numbered_immutability"
  BEFORE INSERT OR UPDATE OR DELETE ON "lineas_facturas_electronicas"
  FOR EACH ROW EXECUTE FUNCTION "protect_numbered_linea_factura_electronica"();
