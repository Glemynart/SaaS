-- PR11.1: permite que una campaña inteligente exprese su propósito sin
-- seleccionar una plantilla concreta. Los lotes manuales existentes conservan
-- su documentTemplateId.
CREATE TYPE "LoteProposito" AS ENUM ('CONTRATACION');

ALTER TABLE "lotes_contrato"
  ALTER COLUMN "documentTemplateId" DROP NOT NULL,
  ADD COLUMN "proposito" "LoteProposito";
