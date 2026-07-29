CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE "configuraciones_documentales_perfil" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "perfilContractualId" TEXT NOT NULL,
    "tipoDocumental" "DocumentTemplateType" NOT NULL,
    "plantillaId" TEXT NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "vigenteHasta" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "configuraciones_documentales_perfil_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "configuraciones_documentales_perfil_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "configuraciones_documentales_perfil_perfilContractualId_fkey" FOREIGN KEY ("perfilContractualId") REFERENCES "perfiles_contractuales"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "configuraciones_documentales_perfil_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "document_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "configuraciones_documentales_perfil_lookup_idx"
    ON "configuraciones_documentales_perfil"("tenantId", "perfilContractualId", "tipoDocumental", "activo");
CREATE INDEX "configuraciones_documentales_perfil_plantilla_idx"
    ON "configuraciones_documentales_perfil"("tenantId", "plantillaId");

ALTER TABLE "configuraciones_documentales_perfil"
    ADD CONSTRAINT "configuraciones_documentales_perfil_no_overlapping_active_vigencies"
    EXCLUDE USING gist (
      "tenantId" WITH =,
      "perfilContractualId" WITH =,
      "tipoDocumental" WITH =,
      daterange("vigenteDesde", "vigenteHasta", '[]') WITH &&
    ) WHERE ("activo");
