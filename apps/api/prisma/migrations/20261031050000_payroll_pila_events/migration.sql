CREATE TYPE "PilaEventCode" AS ENUM (
  'ING',
  'RET',
  'VSP',
  'VST',
  'SLN',
  'IGE',
  'LMA',
  'VAC_LR',
  'IRL',
  'VCT'
);

CREATE TABLE "payroll_pila_events" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "payrollPeriodId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "codigo" "PilaEventCode" NOT NULL,
  "fechaInicio" DATE NOT NULL,
  "fechaFin" DATE,
  "dias" INTEGER,
  CONSTRAINT "payroll_pila_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_pila_events_tenantId_payrollPeriodId_employeeId_idx"
  ON "payroll_pila_events"("tenantId", "payrollPeriodId", "employeeId");

CREATE INDEX "payroll_pila_events_tenantId_payrollPeriodId_codigo_idx"
  ON "payroll_pila_events"("tenantId", "payrollPeriodId", "codigo");

ALTER TABLE "payroll_pila_events"
  ADD CONSTRAINT "payroll_pila_events_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_pila_events"
  ADD CONSTRAINT "payroll_pila_events_payrollPeriodId_fkey"
  FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_pila_events"
  ADD CONSTRAINT "payroll_pila_events_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "empleados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
