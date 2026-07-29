-- PR8C: cada documento generado desde un plan conserva una identidad de
-- origen estable. El plan no referencia GeneratedDocument; la asociación vive
-- sólo en el artefacto para permitir reintentos idempotentes.
ALTER TABLE "generated_documents"
  ADD COLUMN "batchDocumentGenerationPlanId" TEXT;

CREATE UNIQUE INDEX "generated_documents_batchDocumentGenerationPlanId_key"
  ON "generated_documents"("batchDocumentGenerationPlanId");
