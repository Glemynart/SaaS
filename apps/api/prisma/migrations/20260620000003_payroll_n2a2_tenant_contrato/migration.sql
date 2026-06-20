-- N2A.2 — Migración C: datos de configuración de nómina en Tenant y Contrato
-- Aditiva: DEFAULT(false) en aportesExonerados es conservador (no exonera por defecto).
-- claseRiesgoArl nullable: contratos existentes quedan sin clase definida.
--   El calculator usará clase I (mínima) como fallback hasta que se configure.

-- ─── Tenant: flag de exoneración Art. 114-1 ET ───────────────────────────────
ALTER TABLE "tenants"
  ADD COLUMN "aportesExonerados" BOOLEAN NOT NULL DEFAULT false;

-- ─── Contrato: clase de riesgo ARL ───────────────────────────────────────────
-- Clase 1=mínimo … 5=máximo según Decreto 1072/2015 Tabla I.
-- Va en Contrato (no en Empleado) porque el riesgo es por puesto/contrato, no por persona.
ALTER TABLE "contratos"
  ADD COLUMN "claseRiesgoArl" INTEGER;
