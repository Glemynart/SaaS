-- PR8B: ciclo de vida del artefacto documental.
-- La base de datos no puede comprobar el objeto físico. Los registros con
-- metadata previa se conservan como legado no verificado: no se afirma que el
-- artefacto exista ni se los confunde con documentos pendientes nuevos.
CREATE TYPE "GeneratedDocumentStatus" AS ENUM (
  'PENDIENTE_MATERIALIZACION',
  'MATERIALIZADO',
  'FALLIDO',
  'LEGADO_NO_VERIFICADO'
);

ALTER TABLE "generated_documents"
  ADD COLUMN "estado" "GeneratedDocumentStatus"
  NOT NULL DEFAULT 'PENDIENTE_MATERIALIZACION';

UPDATE "generated_documents"
SET "estado" = 'LEGADO_NO_VERIFICADO'
WHERE "pdfStorageKey" IS NOT NULL
   OR "pdfSizeBytes" IS NOT NULL
   OR "pdfUrl" IS NOT NULL;

CREATE INDEX "generated_documents_tenantId_estado_idx"
  ON "generated_documents"("tenantId", "estado");
