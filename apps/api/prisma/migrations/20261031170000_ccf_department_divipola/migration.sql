-- Departamento DIVIPOLA declarado según la constancia de afiliación CCF.
-- Nullable para preservar historial legado sin inferencias ni backfill.
ALTER TABLE "afiliaciones_seguridad_social"
  ADD COLUMN "cajaCompensacionDepartamentoCodigo" VARCHAR(2);
