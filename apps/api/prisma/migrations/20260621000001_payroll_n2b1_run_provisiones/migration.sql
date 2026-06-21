-- N2B.1 — Migración B: columna totalProvisiones en PayrollRun
-- Columna nullable → aditiva, reversible, sin impacto en runs N1/N2A existentes.
-- Los runs previos quedan con NULL: aún no causaron provisiones prestacionales.
-- Sin backfill (decisión N2B.1): re-provisionar histórico alteraría pasivos
-- ya contabilizados en períodos cerrados.
--
-- El desglose por provisión (PROV_PRIMA, PROV_CESANTIAS, PROV_INT_CESANTIAS,
-- PROV_VACACIONES) NO se crea aquí: vivirá como filas PayrollConcept con
-- tipo = 'PROVISION' reutilizando codigo/base/factor/valor de N2A (lo añade N2B.2).

-- ─── PayrollRun: snapshot de provisiones N2B ─────────────────────────────────
ALTER TABLE "payroll_runs"
  ADD COLUMN "totalProvisiones" DECIMAL(14, 2);
