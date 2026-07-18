-- P2 / ACC-13: transición contable aditiva de Payroll.
-- PostgreSQL no permite quitar valores de enum de forma simple; esta migración
-- únicamente habilita el nuevo estado y no modifica registros existentes.
ALTER TYPE "PayrollPeriodStatus" ADD VALUE IF NOT EXISTS 'CAUSADA' AFTER 'APROBADA';
