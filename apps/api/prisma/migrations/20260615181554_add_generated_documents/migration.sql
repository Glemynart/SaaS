-- CreateTable
CREATE TABLE "generated_documents" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contenidoFinal" TEXT NOT NULL,
    "tipo" "DocumentTemplateType" NOT NULL,

    CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generated_documents_tenantId_idx" ON "generated_documents"("tenantId");

-- CreateIndex
CREATE INDEX "generated_documents_tenantId_employeeId_idx" ON "generated_documents"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "generated_documents_tenantId_tipo_idx" ON "generated_documents"("tenantId", "tipo");

-- CreateIndex
CREATE INDEX "generated_documents_tenantId_createdAt_idx" ON "generated_documents"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "document_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
