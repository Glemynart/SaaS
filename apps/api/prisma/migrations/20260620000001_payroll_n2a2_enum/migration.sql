-- N2A.2 — Migración A: extensión del enum PayrollConceptType
-- Aislada porque ALTER TYPE ... ADD VALUE no puede coexistir con DDL que
-- use el valor nuevo en la misma transacción (PostgreSQL < 12).
-- En PG 12+ es posible, pero el aislamiento facilita el rollback conceptual.
-- NOTA: un valor de enum en PostgreSQL no puede eliminarse una vez creado.
-- Si se revierte N2A.2, este valor queda residual pero inofensivo.

ALTER TYPE "PayrollConceptType" ADD VALUE 'EMPLOYER_CONTRIBUTION';
