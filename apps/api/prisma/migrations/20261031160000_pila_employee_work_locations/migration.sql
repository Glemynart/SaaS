-- Ubicación laboral declarada por empleado, independiente de Sede y centro ARL.
-- Migración aditiva: no se infieren ni rellenan ubicaciones existentes.
CREATE TABLE "pila_ubicaciones_laborales" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "empleadoId" TEXT NOT NULL,
  "municipioId" TEXT NOT NULL,
  "vigenteDesde" DATE NOT NULL,
  "vigenteHasta" DATE,
  "registradoPorId" TEXT NOT NULL,
  CONSTRAINT "pila_ubicaciones_laborales_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pila_ubicaciones_laborales_vigencia_check"
    CHECK ("vigenteHasta" IS NULL OR "vigenteHasta" >= "vigenteDesde")
);

CREATE UNIQUE INDEX "pila_ubicaciones_laborales_id_tenant_key"
  ON "pila_ubicaciones_laborales"("id", "tenantId");
CREATE INDEX "pila_ubicaciones_laborales_employee_since_idx"
  ON "pila_ubicaciones_laborales"("tenantId", "empleadoId", "vigenteDesde");
CREATE INDEX "pila_ubicaciones_laborales_municipality_idx"
  ON "pila_ubicaciones_laborales"("municipioId");

ALTER TABLE "pila_ubicaciones_laborales"
  ADD CONSTRAINT "pila_ubicaciones_laborales_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pila_ubicaciones_laborales"
  ADD CONSTRAINT "pila_ubicaciones_laborales_empleadoId_tenantId_fkey"
  FOREIGN KEY ("empleadoId", "tenantId") REFERENCES "empleados"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pila_ubicaciones_laborales"
  ADD CONSTRAINT "pila_ubicaciones_laborales_municipioId_fkey"
  FOREIGN KEY ("municipioId") REFERENCES "municipios_dane"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pila_ubicaciones_laborales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pila_ubicaciones_laborales" FORCE ROW LEVEL SECURITY;
CREATE POLICY "pila_ubicaciones_laborales_tenant_policy"
  ON "pila_ubicaciones_laborales"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));
