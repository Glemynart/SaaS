-- N2A.2 — Migración B: campos de trazabilidad en PayrollConcept y PayrollRun
-- Todas las columnas son nullable → aditivas, reversibles, sin impacto en N1.
-- Los runs/conceptos existentes quedan con NULL: representan datos pre-IBC.

-- ─── PayrollConcept: trazabilidad del cálculo ───────────────────────────────
ALTER TABLE "payroll_concepts"
  ADD COLUMN "codigo"  TEXT,
  ADD COLUMN "base"    DECIMAL(14, 2),
  ADD COLUMN "factor"  DECIMAL(8, 6);

-- Backfill cosmético de conceptos N1 existentes (≤ 2 runs al momento del diseño)
-- Asigna codigo estable a cada concepto según su nombre conocido.
-- Los campos base/factor quedan en NULL (honesto: cotizaron sobre base incorrecta pre-IBC).
UPDATE "payroll_concepts" SET "codigo" = 'SALARIO_BASE'  WHERE "nombre" = 'Salario base';
UPDATE "payroll_concepts" SET "codigo" = 'AUX_TRANSP'    WHERE "nombre" = 'Auxilio de transporte';
UPDATE "payroll_concepts" SET "codigo" = 'SALUD_EMP'     WHERE "nombre" = 'Salud (4%)';
UPDATE "payroll_concepts" SET "codigo" = 'PENSION_EMP'   WHERE "nombre" = 'Pensión (4%)';
UPDATE "payroll_concepts" SET "codigo" = 'FSP'           WHERE "nombre" = 'Fondo de Solidaridad Pensional';
UPDATE "payroll_concepts" SET "codigo" = 'BONUS'         WHERE "nombre" = 'Bonificaciones';
UPDATE "payroll_concepts" SET "codigo" = 'OVERTIME'      WHERE "nombre" = 'Horas extra';

-- ─── PayrollRun: snapshot N2A ────────────────────────────────────────────────
ALTER TABLE "payroll_runs"
  ADD COLUMN "ibc"                    DECIMAL(14, 2),
  ADD COLUMN "auxilioTransporte"      DECIMAL(14, 2),
  ADD COLUMN "totalAportesPatronales" DECIMAL(14, 2),
  ADD COLUMN "costoTotalEmpleador"    DECIMAL(14, 2),
  ADD COLUMN "parametroLegalId"       TEXT;

-- FK RESTRICT: protege reproducibilidad histórica.
-- Un parámetro referenciado por un run no puede borrarse.
ALTER TABLE "payroll_runs"
  ADD CONSTRAINT "payroll_runs_parametroLegalId_fkey"
  FOREIGN KEY ("parametroLegalId")
  REFERENCES "parametros_legales_nomina"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- Índice para el chequeo RESTRICT (sin él Postgres escanea toda la tabla en cada DELETE).
CREATE INDEX "payroll_runs_parametroLegalId_idx"
  ON "payroll_runs" ("parametroLegalId");
