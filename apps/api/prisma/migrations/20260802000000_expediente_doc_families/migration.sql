-- E5.2: introduce explicit document families and immutable revisions.

-- CreateTable
CREATE TABLE "expediente_doc_families" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "categoria" "ExpedienteCategoria" NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "expediente_doc_families_pkey" PRIMARY KEY ("id")
);

-- Add revision metadata before backfilling existing documents.
ALTER TABLE "expediente_docs"
  ADD COLUMN "familiaId" TEXT,
  ADD COLUMN "vigente" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "reemplazaId" TEXT;

-- Every existing row is the first revision of its own family. This is
-- deliberately one-to-one: no historical documents are merged implicitly.
CREATE TEMP TABLE "_expediente_doc_family_backfill" (
    "docId" TEXT PRIMARY KEY,
    "familiaId" TEXT NOT NULL
);

INSERT INTO "_expediente_doc_family_backfill" ("docId", "familiaId")
SELECT "id", gen_random_uuid()::text
FROM "expediente_docs";

INSERT INTO "expediente_doc_families" (
    "id",
    "createdAt",
    "updatedAt",
    "tenantId",
    "empleadoId",
    "categoria",
    "nombre",
    "descripcion"
)
SELECT
    backfill."familiaId",
    doc."createdAt",
    doc."updatedAt",
    doc."tenantId",
    doc."empleadoId",
    doc."categoria",
    doc."nombre",
    doc."descripcion"
FROM "_expediente_doc_family_backfill" backfill
JOIN "expediente_docs" doc ON doc."id" = backfill."docId";

UPDATE "expediente_docs" doc
SET "familiaId" = backfill."familiaId"
FROM "_expediente_doc_family_backfill" backfill
WHERE doc."id" = backfill."docId";

DROP TABLE "_expediente_doc_family_backfill";

ALTER TABLE "expediente_docs"
  ALTER COLUMN "familiaId" SET NOT NULL;

-- Indexes and constraints for the revision chain.
CREATE INDEX "expediente_doc_families_tenantId_empleadoId_idx"
  ON "expediente_doc_families"("tenantId", "empleadoId");
CREATE INDEX "expediente_doc_families_tenantId_empleadoId_categoria_idx"
  ON "expediente_doc_families"("tenantId", "empleadoId", "categoria");
CREATE INDEX "expediente_docs_tenantId_familiaId_vigente_idx"
  ON "expediente_docs"("tenantId", "familiaId", "vigente");
CREATE UNIQUE INDEX "expediente_docs_familiaId_version_key"
  ON "expediente_docs"("familiaId", "version");
CREATE UNIQUE INDEX "expediente_docs_reemplazaId_key"
  ON "expediente_docs"("reemplazaId");
CREATE UNIQUE INDEX "expediente_docs_one_vigente_per_familia"
  ON "expediente_docs"("familiaId")
  WHERE "vigente" = true;

-- Foreign keys.
ALTER TABLE "expediente_doc_families"
  ADD CONSTRAINT "expediente_doc_families_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expediente_doc_families"
  ADD CONSTRAINT "expediente_doc_families_empleadoId_fkey"
  FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expediente_docs"
  ADD CONSTRAINT "expediente_docs_familiaId_fkey"
  FOREIGN KEY ("familiaId") REFERENCES "expediente_doc_families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expediente_docs"
  ADD CONSTRAINT "expediente_docs_reemplazaId_fkey"
  FOREIGN KEY ("reemplazaId") REFERENCES "expediente_docs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
