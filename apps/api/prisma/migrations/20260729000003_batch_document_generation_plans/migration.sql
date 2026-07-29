CREATE TYPE "BatchDocumentGenerationPlanStatus" AS ENUM ('CONFIRMADO', 'CONSUMIDO', 'ANULADO');

CREATE TABLE "batch_document_generation_plans" (
  "id" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "tenantId" TEXT NOT NULL, "loteId" TEXT NOT NULL,
  "empleadoId" TEXT NOT NULL, "tipoDocumental" "DocumentTemplateType" NOT NULL,
  "fechaProceso" DATE NOT NULL, "confirmadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "vinculoLaboralId" TEXT NOT NULL, "perfilContractualId" TEXT NOT NULL,
  "configuracionDocumentalPerfilId" TEXT NOT NULL, "plantillaId" TEXT NOT NULL,
  "perfilSnapshot" JSONB NOT NULL, "configuracionSnapshot" JSONB NOT NULL,
  "plantillaSnapshot" JSONB NOT NULL, "motivoResolucion" TEXT NOT NULL,
  "formatoVersion" INTEGER NOT NULL DEFAULT 1, "resueltoAt" TIMESTAMP(3) NOT NULL,
  "estado" "BatchDocumentGenerationPlanStatus" NOT NULL DEFAULT 'CONFIRMADO',
  CONSTRAINT "batch_document_generation_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "batch_document_generation_plans_loteId_empleadoId_tipoDocumental_key" UNIQUE ("loteId", "empleadoId", "tipoDocumental"),
  CONSTRAINT "batch_document_generation_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "batch_document_generation_plans_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes_contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "batch_document_generation_plans_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "batch_document_generation_plans_tenantId_loteId_estado_idx" ON "batch_document_generation_plans"("tenantId", "loteId", "estado");
