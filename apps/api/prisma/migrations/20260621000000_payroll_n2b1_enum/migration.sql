-- N2B.1 — Migración A: extensión del enum PayrollConceptType con PROVISION
-- Aislada porque ALTER TYPE ... ADD VALUE no puede coexistir con DDL que
-- use el valor nuevo en la misma transacción (PostgreSQL < 12).
-- En PG 12+ es posible, pero el aislamiento facilita el rollback conceptual y
-- replica el patrón de N2A.2 (20260620000001_payroll_n2a2_enum).
-- NOTA: un valor de enum en PostgreSQL no puede eliminarse una vez creado.
-- Si se revierte N2B.1, este valor queda residual pero inofensivo.

ALTER TYPE "PayrollConceptType" ADD VALUE 'PROVISION';
