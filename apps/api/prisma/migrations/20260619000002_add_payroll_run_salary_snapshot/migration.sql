-- N1A.5: Snapshot salarial en PayrollRun
-- Columna nullable para permitir backfill de runs existentes sin downtime.

ALTER TABLE "payroll_runs"
  ADD COLUMN "salarioBaseSnapshot" DECIMAL(12, 2);

-- Backfill: poblar desde PayrollConcept tipo=EARNING, nombre='Salario base'.
-- Los 2 runs existentes tienen ese concepto (verificado en auditoría 2026-06-19).
UPDATE "payroll_runs" r
SET "salarioBaseSnapshot" = c.valor
FROM "payroll_concepts" c
WHERE c."payrollRunId" = r.id
  AND c.tipo = 'EARNING'
  AND c.nombre = 'Salario base';
