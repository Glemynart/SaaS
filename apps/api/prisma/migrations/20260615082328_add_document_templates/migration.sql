-- CreateEnum
CREATE TYPE "DocumentTemplateType" AS ENUM ('CONTRACT', 'CERTIFICATION', 'LETTER', 'MEMO');

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "DocumentTemplateType" NOT NULL,
    "contenido" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_templates_tenantId_idx" ON "document_templates"("tenantId");

-- CreateIndex
CREATE INDEX "document_templates_tenantId_tipo_idx" ON "document_templates"("tenantId", "tipo");

-- CreateIndex
CREATE INDEX "document_templates_tenantId_activo_idx" ON "document_templates"("tenantId", "activo");

-- CreateIndex
CREATE INDEX "document_templates_tenantId_deletedAt_idx" ON "document_templates"("tenantId", "deletedAt");

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
