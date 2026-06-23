-- Partial unique index: only one GeneratedDocument per contratoId.
-- Uses WHERE filter so rows with contratoId IS NULL (certifications, letters, memos)
-- are not affected.
-- Prisma doesn't support partial unique indexes natively, so this is a manual migration.

CREATE UNIQUE INDEX "generated_documents_contratoId_unique"
  ON "generated_documents" ("contratoId")
  WHERE "contratoId" IS NOT NULL;
