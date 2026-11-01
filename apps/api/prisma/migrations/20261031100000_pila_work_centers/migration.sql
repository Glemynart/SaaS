-- Centros declarados a la ARL y asignaciones históricas por empleado.
-- No se rellenan datos existentes ni se modifican snapshots PILA previos.

CREATE UNIQUE INDEX "sedes_id_tenant_key" ON "sedes"("id", "tenantId");

CREATE TABLE "pila_centros_trabajo" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sedeId" TEXT,
    "arlCodigo" VARCHAR(6) NOT NULL,
    "codigoCentro" VARCHAR(40) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "pila_centros_trabajo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pila_asignaciones_centro_trabajo" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "centroTrabajoId" TEXT NOT NULL,
    "codigoActividadEconomica" VARCHAR(7) NOT NULL,
    "formatoNormativoVersion" VARCHAR(32) NOT NULL DEFAULT 'DECRETO_768_2022',
    "vigenteDesde" DATE NOT NULL,
    "vigenteHasta" DATE,
    "registradoPorId" TEXT NOT NULL,
    CONSTRAINT "pila_asignaciones_centro_trabajo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pila_asignaciones_actividad_code_check"
      CHECK ("codigoActividadEconomica" ~ '^[1-5][0-9]{6}$')
);

CREATE UNIQUE INDEX "pila_centros_tenant_arl_code_key"
  ON "pila_centros_trabajo"("tenantId", "arlCodigo", "codigoCentro");
CREATE UNIQUE INDEX "pila_centros_trabajo_id_tenant_key"
  ON "pila_centros_trabajo"("id", "tenantId");
CREATE INDEX "pila_centros_tenant_active_idx"
  ON "pila_centros_trabajo"("tenantId", "activo");
CREATE INDEX "pila_centros_tenant_sede_idx"
  ON "pila_centros_trabajo"("tenantId", "sedeId");

CREATE UNIQUE INDEX "pila_asignaciones_centro_id_tenant_key"
  ON "pila_asignaciones_centro_trabajo"("id", "tenantId");
CREATE INDEX "pila_asignaciones_tenant_employee_since_idx"
  ON "pila_asignaciones_centro_trabajo"("tenantId", "empleadoId", "vigenteDesde");
CREATE INDEX "pila_asignaciones_tenant_center_since_idx"
  ON "pila_asignaciones_centro_trabajo"("tenantId", "centroTrabajoId", "vigenteDesde");

ALTER TABLE "pila_centros_trabajo"
  ADD CONSTRAINT "pila_centros_trabajo_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pila_centros_trabajo"
  ADD CONSTRAINT "pila_centros_trabajo_sedeId_tenantId_fkey"
  FOREIGN KEY ("sedeId", "tenantId") REFERENCES "sedes"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pila_asignaciones_centro_trabajo"
  ADD CONSTRAINT "pila_asignaciones_centro_trabajo_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pila_asignaciones_centro_trabajo"
  ADD CONSTRAINT "pila_asignaciones_centro_trabajo_empleadoId_tenantId_fkey"
  FOREIGN KEY ("empleadoId", "tenantId") REFERENCES "empleados"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pila_asignaciones_centro_trabajo"
  ADD CONSTRAINT "pila_asignaciones_centro_trabajo_centroTrabajoId_tenantId_fkey"
  FOREIGN KEY ("centroTrabajoId", "tenantId") REFERENCES "pila_centros_trabajo"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pila_centros_trabajo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pila_centros_trabajo" FORCE ROW LEVEL SECURITY;
CREATE POLICY "pila_centros_trabajo_tenant_policy"
  ON "pila_centros_trabajo"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));

ALTER TABLE "pila_asignaciones_centro_trabajo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pila_asignaciones_centro_trabajo" FORCE ROW LEVEL SECURITY;
CREATE POLICY "pila_asignaciones_centro_tenant_policy"
  ON "pila_asignaciones_centro_trabajo"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));
