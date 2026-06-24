-- Partial unique index: only one ExpedienteDoc per generatedDocumentId.
-- Rows with generatedDocumentId IS NULL (manually uploaded documents) are not affected.
-- Prisma doesn't support partial unique indexes natively, so this is a manual migration.

CREATE UNIQUE INDEX "expediente_docs_generatedDocumentId_unique"
  ON "expediente_docs" ("generatedDocumentId")
  WHERE "generatedDocumentId" IS NOT NULL;
