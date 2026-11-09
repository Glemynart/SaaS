ALTER TABLE "payroll_pila_events"
  ADD COLUMN "ultimoIbcReportado" DECIMAL(14, 2),
  ADD COLUMN "periodoIbcReportado" DATE,
  ADD COLUMN "operadorFuenteIbc" VARCHAR(80),
  ADD COLUMN "referenciaFuenteIbc" VARCHAR(160),
  ADD COLUMN "confirmoFuenteIbc" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "payroll_pila_events"
  ADD CONSTRAINT "payroll_pila_events_prior_ibc_source_check"
  CHECK (
    (
      "ultimoIbcReportado" IS NULL
      AND "periodoIbcReportado" IS NULL
      AND "operadorFuenteIbc" IS NULL
      AND "referenciaFuenteIbc" IS NULL
      AND "confirmoFuenteIbc" = FALSE
    )
    OR (
      "ultimoIbcReportado" IS NOT NULL
      AND "ultimoIbcReportado" > 0
      AND "periodoIbcReportado" IS NOT NULL
      AND EXTRACT(DAY FROM "periodoIbcReportado") = 1
      AND "operadorFuenteIbc" IS NOT NULL
      AND LENGTH(BTRIM("operadorFuenteIbc")) > 0
      AND "referenciaFuenteIbc" IS NOT NULL
      AND LENGTH(BTRIM("referenciaFuenteIbc")) > 0
      AND "confirmoFuenteIbc" = TRUE
      AND "codigo" = 'VAC_LR'::"PilaEventCode"
      AND "subtipo" IS NOT NULL
      AND "subtipo" = 'VACACIONES_DISFRUTADAS'::"PilaVacLrSubtype"
      AND "periodoIbcReportado" < DATE_TRUNC('month', "fechaInicio")::date
    )
  );
