-- Fuente precontractual y tenant-aware para el perfil contractual.
-- No modifica contratos, lotes ni documentos existentes.
CREATE TABLE "vinculos_laborales" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "perfilContractualId" TEXT NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "vigenteHasta" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vinculos_laborales_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vinculos_laborales_tenantId_empleadoId_activo_idx"
    ON "vinculos_laborales"("tenantId", "empleadoId", "activo");
CREATE INDEX "vinculos_laborales_tenantId_perfilContractualId_idx"
    ON "vinculos_laborales"("tenantId", "perfilContractualId");
CREATE UNIQUE INDEX "vinculos_laborales_one_active_per_employee"
    ON "vinculos_laborales"("tenantId", "empleadoId")
    WHERE "activo" = true;

ALTER TABLE "vinculos_laborales"
    ADD CONSTRAINT "vinculos_laborales_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vinculos_laborales"
    ADD CONSTRAINT "vinculos_laborales_empleadoId_fkey"
    FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vinculos_laborales"
    ADD CONSTRAINT "vinculos_laborales_perfilContractualId_fkey"
    FOREIGN KEY ("perfilContractualId") REFERENCES "perfiles_contractuales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
