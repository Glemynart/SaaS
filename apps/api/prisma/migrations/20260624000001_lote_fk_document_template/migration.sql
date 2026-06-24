-- AlterTable: lotes_contrato
-- Re-point FK from plantillas to document_templates.
-- The table has 0 rows in production (API created in this PR), so the rename
-- and FK swap are safe without data migration.

-- Drop existing FK to plantillas
ALTER TABLE "lotes_contrato" DROP CONSTRAINT "lotes_contrato_plantillaId_fkey";

-- Rename column
ALTER TABLE "lotes_contrato" RENAME COLUMN "plantillaId" TO "documentTemplateId";

-- Add new FK to document_templates
ALTER TABLE "lotes_contrato" ADD CONSTRAINT "lotes_contrato_documentTemplateId_fkey"
  FOREIGN KEY ("documentTemplateId") REFERENCES "document_templates"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
