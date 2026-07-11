-- P1 (ProcesoNómina) · U1 — Fase 1b: backfill de PayrollPeriod hacia el
-- modelo de estados nuevo + columnas de actor de aprobación.
--
-- Requiere que 20260711120000_payroll_p1_period_status_enum ya esté
-- aplicada y comprometida: los valores nuevos deben existir antes de
-- referenciarse en este DML.
--
-- Backfill (vacía por completo el modelo legado; ningún período queda en
-- DRAFT/CLOSED tras esta migración):
--   DRAFT  → BORRADOR
--   CLOSED → CERRADA (terminal, distinto de APROBADA: U3 introducirá el
--            invariante "toda APROBADA tiene snapshot inmutable"; los
--            períodos legados no tienen snapshot y no deben aparentar
--            haberlo tenido).

-- Backfill
UPDATE "payroll_periods" SET "status" = 'BORRADOR' WHERE "status" = 'DRAFT';
UPDATE "payroll_periods" SET "status" = 'CERRADA'  WHERE "status" = 'CLOSED';

-- AlterTable: nuevo default + columnas de actor de aprobación.
-- `createPeriod` fijará status='BORRADOR' explícito en el código (no
-- depende de este default); el default queda como red de seguridad para
-- inserciones que no lo especifiquen (seed/manual), no como fuente de verdad.
ALTER TABLE "payroll_periods"
  ALTER COLUMN "status" SET DEFAULT 'BORRADOR',
  ADD COLUMN "aprobadoPorId" TEXT,
  ADD COLUMN "aprobadoEn" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
