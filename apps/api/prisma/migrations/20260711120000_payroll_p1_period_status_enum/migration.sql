-- P1 (ProcesoNómina) · U1 — Fase 1a: amplía PayrollPeriodStatus con los
-- estados objetivo de la máquina de estados del ProcesoNómina (ADR-002 §6):
--   BORRADOR → CALCULADA → EN_REVISION → APROBADA (P1, terminal)
--   CERRADA (terminal; en P1 solo la alcanzan períodos legados vía backfill;
--            P3 la alcanzará también por la ruta real PAGADA → CERRADA).
--
-- DRAFT y CLOSED se preservan como valores legados sin uso en código nuevo.
-- Postgres no permite eliminar valores de un enum sin recrear el tipo.
--
-- Los 5 valores nuevos NO se usan en DML dentro de esta migración —condición
-- que exige el precedente 20260622000000_payroll_n2d51_liquidation_status
-- para poder ejecutar ADD VALUE dentro de la misma transacción que envuelve
-- Prisma. El backfill que sí los usa vive en la migración siguiente
-- (20260711120001), aplicada en una transacción separada.

-- AlterEnum
ALTER TYPE "PayrollPeriodStatus" ADD VALUE 'BORRADOR' AFTER 'CLOSED';
ALTER TYPE "PayrollPeriodStatus" ADD VALUE 'CALCULADA' AFTER 'BORRADOR';
ALTER TYPE "PayrollPeriodStatus" ADD VALUE 'EN_REVISION' AFTER 'CALCULADA';
ALTER TYPE "PayrollPeriodStatus" ADD VALUE 'APROBADA' AFTER 'EN_REVISION';
ALTER TYPE "PayrollPeriodStatus" ADD VALUE 'CERRADA' AFTER 'APROBADA';
