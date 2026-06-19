-- N1A.1: Vincular PayrollNovelty a PayrollPeriod
-- payroll_novelties está vacía (confirmado en auditoría 2026-06-19),
-- por lo que NOT NULL es seguro sin backfill.

ALTER TABLE "payroll_novelties"
  ADD COLUMN "payrollPeriodId" TEXT NOT NULL;

ALTER TABLE "payroll_novelties"
  ADD CONSTRAINT "payroll_novelties_payrollPeriodId_fkey"
  FOREIGN KEY ("payrollPeriodId")
  REFERENCES "payroll_periods"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "payroll_novelties_tenantId_payrollPeriodId_idx"
  ON "payroll_novelties"("tenantId", "payrollPeriodId");
