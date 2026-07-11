-- P0 (ADR-002 §9, D3) — Externalizar los factores de provisión prestacional
-- desde constantes hardcoded del PayrollCalculator hacia ParametroLegalNomina,
-- versionados por vigencia como el resto de parámetros legales.
--
-- Patrón aditivo en 3 pasos para columnas NOT NULL sobre tabla con datos:
--   1. ADD COLUMN nullable.
--   2. Backfill con los valores legales que el motor YA aplicaba (reproduce el
--      comportamiento pasado exactamente; NO lo altera). Idempotente (WHERE IS NULL).
--   3. SET NOT NULL.
--
-- Sin DEFAULT a nivel de columna: los factores son parámetros legales versionados,
-- no constantes del esquema. Las filas futuras las fija el seed/administración.

-- ─── 1. Columnas (nullable) ──────────────────────────────────────────────────
ALTER TABLE "parametros_legales_nomina"
  ADD COLUMN "factorProvPrima"        DECIMAL(8, 6),
  ADD COLUMN "factorProvCesantias"    DECIMAL(8, 6),
  ADD COLUMN "factorProvIntCesantias" DECIMAL(8, 6),
  ADD COLUMN "factorProvVacaciones"   DECIMAL(8, 6);

-- ─── 2. Backfill (valores legales previos del calculator) ────────────────────
UPDATE "parametros_legales_nomina"
  SET "factorProvPrima"        = 0.0833,
      "factorProvCesantias"    = 0.0833,
      "factorProvIntCesantias" = 0.01,
      "factorProvVacaciones"   = 0.0417
  WHERE "factorProvPrima" IS NULL;

-- ─── 3. NOT NULL ─────────────────────────────────────────────────────────────
ALTER TABLE "parametros_legales_nomina"
  ALTER COLUMN "factorProvPrima"        SET NOT NULL,
  ALTER COLUMN "factorProvCesantias"    SET NOT NULL,
  ALTER COLUMN "factorProvIntCesantias" SET NOT NULL,
  ALTER COLUMN "factorProvVacaciones"   SET NOT NULL;
