-- PR2 Intelligent Contract Batches: catálogo aditivo y relación opcional.
-- No modifica contratos existentes ni es consumido por la generación actual.
CREATE TABLE "perfiles_contractuales" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "perfiles_contractuales_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "contratos" ADD COLUMN "perfilContractualId" TEXT;

CREATE UNIQUE INDEX "perfiles_contractuales_tenantId_codigo_key"
  ON "perfiles_contractuales"("tenantId", "codigo");
CREATE INDEX "perfiles_contractuales_tenantId_activo_idx"
  ON "perfiles_contractuales"("tenantId", "activo");
CREATE INDEX "perfiles_contractuales_tenantId_nombre_idx"
  ON "perfiles_contractuales"("tenantId", "nombre");
CREATE INDEX "contratos_tenantId_perfilContractualId_idx"
  ON "contratos"("tenantId", "perfilContractualId");

ALTER TABLE "perfiles_contractuales"
  ADD CONSTRAINT "perfiles_contractuales_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contratos"
  ADD CONSTRAINT "contratos_perfilContractualId_fkey"
  FOREIGN KEY ("perfilContractualId") REFERENCES "perfiles_contractuales"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
