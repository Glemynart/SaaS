CREATE TYPE "PilaVacLrSubtype" AS ENUM (
  'VACACIONES_DISFRUTADAS',
  'LICENCIA_REMUNERADA'
);

ALTER TABLE "payroll_pila_events"
  ADD COLUMN "subtipo" "PilaVacLrSubtype";