-- Payroll P1 - U2: Centro de costo en PayrollRun
-- Aditiva: agrega una dimension nullable para conservar el centro de costo
-- resuelto desde Contrato.sedeId -> CentroCosto.sedeId. Sin backfill.

ALTER TABLE "payroll_runs"
  ADD COLUMN "centroCostoId" TEXT;

ALTER TABLE "payroll_runs"
  ADD CONSTRAINT "payroll_runs_centroCostoId_fkey"
  FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
