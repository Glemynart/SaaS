-- La versión de captura de la afiliación no es la versión del formato PILA.
-- Las filas antiguas recibieron AT2_V30 por el servicio, no por confirmación
-- del aportante; se corrige solo este metadato y no se reescriben snapshots.
ALTER TABLE "afiliaciones_seguridad_social"
  ALTER COLUMN "formatoNormativoVersion"
  SET DEFAULT 'PILA_AFFILIATION_CAPTURE_V1';

UPDATE "afiliaciones_seguridad_social"
SET "formatoNormativoVersion" = 'PILA_AFFILIATION_CAPTURE_V1'
WHERE "formatoNormativoVersion" = 'AT2_V30';
