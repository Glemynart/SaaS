-- Historia explícita de afiliaciones declaradas por cada empleador.
-- Los campos de texto legados en empleados permanecen intactos.
CREATE TABLE "afiliaciones_seguridad_social" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "empleadoId" TEXT NOT NULL,
  "tipoCotizanteCodigo" VARCHAR(2) NOT NULL,
  "subtipoCotizanteCodigo" VARCHAR(2),
  "epsCodigo" VARCHAR(6) NOT NULL,
  "epsNombre" VARCHAR(120) NOT NULL,
  "fondoPensionCodigo" VARCHAR(6) NOT NULL,
  "fondoPensionNombre" VARCHAR(120) NOT NULL,
  "arlCodigo" VARCHAR(6) NOT NULL,
  "arlNombre" VARCHAR(120) NOT NULL,
  "arlClaseRiesgo" VARCHAR(1) NOT NULL,
  "cajaCompensacionCodigo" VARCHAR(6) NOT NULL,
  "cajaCompensacionNombre" VARCHAR(120) NOT NULL,
  "vigenteDesde" DATE NOT NULL,
  "vigenteHasta" DATE,
  "formatoNormativoVersion" VARCHAR(32) NOT NULL DEFAULT 'AT2_V30',
  "registradoPorId" TEXT NOT NULL,

  CONSTRAINT "afiliaciones_seguridad_social_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "afiliaciones_seguridad_social_vigencia_check"
    CHECK ("vigenteHasta" IS NULL OR "vigenteHasta" >= "vigenteDesde")
);

CREATE UNIQUE INDEX "af_seg_id_tenant_key"
  ON "afiliaciones_seguridad_social"("id", "tenantId");
CREATE INDEX "af_seg_tenant_employee_since_idx"
  ON "afiliaciones_seguridad_social"("tenantId", "empleadoId", "vigenteDesde");

ALTER TABLE "afiliaciones_seguridad_social"
  ADD CONSTRAINT "afiliaciones_seguridad_social_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "afiliaciones_seguridad_social"
  ADD CONSTRAINT "afiliaciones_seguridad_social_empleadoId_tenantId_fkey"
  FOREIGN KEY ("empleadoId", "tenantId") REFERENCES "empleados"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "afiliaciones_seguridad_social" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "afiliaciones_seguridad_social" FORCE ROW LEVEL SECURITY;
CREATE POLICY "afiliaciones_seguridad_social_tenant_policy"
  ON "afiliaciones_seguridad_social"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));
