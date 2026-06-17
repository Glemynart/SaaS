-- CreateEnum
CREATE TYPE "TipoDocIdentidad" AS ENUM ('CC', 'CE', 'TI', 'PA', 'NIT', 'PEP', 'PPT');

-- CreateEnum
CREATE TYPE "JornadaLaboral" AS ENUM ('COMPLETA', 'MEDIA', 'POR_HORAS');

-- CreateEnum
CREATE TYPE "MotivoRetiro" AS ENUM ('RENUNCIA', 'TERMINACION_CONTRATO', 'MUTUO_ACUERDO', 'JUSTA_CAUSA', 'FALLECIMIENTO', 'OTRO');

-- CreateEnum
CREATE TYPE "ZonaMunicipio" AS ENUM ('URBANA', 'RURAL');

-- AlterTable
ALTER TABLE "contratos" ADD COLUMN     "contratoRenovaId" TEXT,
ADD COLUMN     "fechaFinPeriodoPrueba" TIMESTAMP(3),
ADD COLUMN     "plantillaVersion" TEXT,
ADD COLUMN     "sedeId" TEXT;

-- AlterTable
ALTER TABLE "expediente_docs" ADD COLUMN     "contratoId" TEXT,
ADD COLUMN     "fechaDocumento" TIMESTAMP(3),
ADD COLUMN     "fechaVencimiento" TIMESTAMP(3),
ADD COLUMN     "generatedDocumentId" TEXT,
ADD COLUMN     "requiereRenovacion" BOOLEAN;

-- AlterTable
ALTER TABLE "lotes_contrato" ADD COLUMN     "creadoPorId" TEXT,
ADD COLUMN     "fechaFinContrato" TIMESTAMP(3),
ADD COLUMN     "fechaInicioContrato" TIMESTAMP(3),
ADD COLUMN     "nombreLote" TEXT,
ADD COLUMN     "sedeId" TEXT,
ADD COLUMN     "tipoContrato" "ContratoTipo";

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "municipioId" TEXT;

-- CreateTable
CREATE TABLE "sedes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "municipioId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sedes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sedes_tenantId_activo_idx" ON "sedes"("tenantId", "activo");

-- CreateIndex
CREATE INDEX "sedes_tenantId_municipioId_idx" ON "sedes"("tenantId", "municipioId");

-- CreateIndex
CREATE INDEX "contratos_tenantId_sedeId_idx" ON "contratos"("tenantId", "sedeId");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "municipios_dane"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sedes" ADD CONSTRAINT "sedes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sedes" ADD CONSTRAINT "sedes_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "municipios_dane"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_contratoRenovaId_fkey" FOREIGN KEY ("contratoRenovaId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_contrato" ADD CONSTRAINT "lotes_contrato_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_contrato" ADD CONSTRAINT "lotes_contrato_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expediente_docs" ADD CONSTRAINT "expediente_docs_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expediente_docs" ADD CONSTRAINT "expediente_docs_generatedDocumentId_fkey" FOREIGN KEY ("generatedDocumentId") REFERENCES "generated_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
