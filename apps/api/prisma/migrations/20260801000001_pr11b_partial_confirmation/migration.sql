-- PR11.2: preserva snapshots laborales para planes nuevos y registra de forma
-- separada las exclusiones funcionales de una confirmación parcial.
ALTER TABLE "batch_document_generation_plans"
  ADD COLUMN "empleadoSnapshot" JSONB,
  ADD COLUMN "contratoSnapshot" JSONB;

CREATE TABLE "batch_document_generation_exclusions" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "loteId" TEXT NOT NULL,
  "empleadoId" TEXT NOT NULL,
  "tipoDocumental" "DocumentTemplateType" NOT NULL,
  "fechaEvaluacion" DATE NOT NULL,
  "motivoBloqueo" TEXT NOT NULL,
  "detalle" JSONB,
  CONSTRAINT "batch_document_generation_exclusions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "batch_document_generation_exclusions_loteId_empleadoId_tipoDocumental_key"
    UNIQUE ("loteId", "empleadoId", "tipoDocumental"),
  CONSTRAINT "batch_document_generation_exclusions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "batch_document_generation_exclusions_loteId_fkey"
    FOREIGN KEY ("loteId") REFERENCES "lotes_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "batch_document_generation_exclusions_tenantId_loteId_idx"
  ON "batch_document_generation_exclusions"("tenantId", "loteId");
