ALTER TABLE "afiliaciones_seguridad_social"
  ADD COLUMN "estadoAfiliacionPensional" VARCHAR(1);

ALTER TABLE "afiliaciones_seguridad_social"
  ADD CONSTRAINT "afiliaciones_seguridad_social_estado_pensional_check"
  CHECK ("estadoAfiliacionPensional" IS NULL OR "estadoAfiliacionPensional" IN ('S', 'N'));

ALTER TABLE "afiliaciones_seguridad_social"
  ALTER COLUMN "formatoNormativoVersion"
  SET DEFAULT 'PILA_AFFILIATION_CAPTURE_V4';

COMMENT ON COLUMN "afiliaciones_seguridad_social"."estadoAfiliacionPensional" IS
  'Valor S/N del campo 5 de afiliación a pensiones, declarado según soporte. No se completa para registros históricos.';
