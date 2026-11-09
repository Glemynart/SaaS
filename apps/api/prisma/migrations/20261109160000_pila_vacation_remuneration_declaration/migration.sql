ALTER TABLE "payroll_pila_events"
  ADD COLUMN "remuneracionVacacionesReportada" DECIMAL(14,2),
  ADD COLUMN "periodoPagoVacaciones" DATE,
  ADD COLUMN "referenciaFuenteRemuneracion" VARCHAR(160),
  ADD COLUMN "confirmoFuenteRemuneracion" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "payroll_pila_events"
  ADD CONSTRAINT "payroll_pila_events_vacation_remuneration_declaration_check"
  CHECK (
    (
      "remuneracionVacacionesReportada" IS NULL
      AND "periodoPagoVacaciones" IS NULL
      AND "referenciaFuenteRemuneracion" IS NULL
      AND "confirmoFuenteRemuneracion" = FALSE
    )
    OR
    (
      "remuneracionVacacionesReportada" IS NOT NULL
      AND "remuneracionVacacionesReportada" > 0
      AND "periodoPagoVacaciones" IS NOT NULL
      AND EXTRACT(DAY FROM "periodoPagoVacaciones") = 1
      AND "referenciaFuenteRemuneracion" IS NOT NULL
      AND length(btrim("referenciaFuenteRemuneracion")) BETWEEN 1 AND 160
      AND "confirmoFuenteRemuneracion" = TRUE
      AND "codigo" = 'VAC_LR'::"PilaEventCode"
      AND "subtipo" = 'VACACIONES_DISFRUTADAS'::"PilaVacLrSubtype"
    )
  );
