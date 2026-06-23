-- AlterTable
ALTER TABLE "generated_documents" ADD COLUMN "contratoId" TEXT;

-- CreateIndex
CREATE INDEX "generated_documents_tenantId_contratoId_idx" ON "generated_documents"("tenantId", "contratoId");

-- AddForeignKey
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
