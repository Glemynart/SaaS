-- Payroll P1 - U3: Snapshot inmutable de liquidacion aprobada.
-- Aditiva: crea evidencia historica 1:1 por PayrollRun, sin backfill.

ALTER TABLE "payroll_runs"
    ADD COLUMN "calculationTrace" JSONB;

CREATE TABLE "payroll_snapshots" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "contratoId" TEXT,
    "parametroLegalId" TEXT,
    "centroCostoId" TEXT,
    "aprobadoPorId" TEXT,
    "estadoPeriodo" "PayrollPeriodStatus" NOT NULL,
    "origen" TEXT NOT NULL,
    "payloadVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,

    CONSTRAINT "payroll_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_snapshots_payrollRunId_key"
    ON "payroll_snapshots" ("payrollRunId");

CREATE INDEX "payroll_snapshots_tenantId_idx"
    ON "payroll_snapshots" ("tenantId");

CREATE INDEX "payroll_snapshots_tenantId_payrollPeriodId_idx"
    ON "payroll_snapshots" ("tenantId", "payrollPeriodId");

CREATE INDEX "payroll_snapshots_tenantId_employeeId_idx"
    ON "payroll_snapshots" ("tenantId", "employeeId");

CREATE INDEX "payroll_snapshots_tenantId_createdAt_idx"
    ON "payroll_snapshots" ("tenantId", "createdAt");

CREATE INDEX "payroll_snapshots_parametroLegalId_idx"
    ON "payroll_snapshots" ("parametroLegalId");

CREATE INDEX "payroll_snapshots_centroCostoId_idx"
    ON "payroll_snapshots" ("centroCostoId");

ALTER TABLE "payroll_snapshots"
    ADD CONSTRAINT "payroll_snapshots_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_snapshots"
    ADD CONSTRAINT "payroll_snapshots_payrollRunId_fkey"
    FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_snapshots"
    ADD CONSTRAINT "payroll_snapshots_payrollPeriodId_fkey"
    FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_snapshots"
    ADD CONSTRAINT "payroll_snapshots_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "empleados"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_snapshots"
    ADD CONSTRAINT "payroll_snapshots_contratoId_fkey"
    FOREIGN KEY ("contratoId") REFERENCES "contratos"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_snapshots"
    ADD CONSTRAINT "payroll_snapshots_parametroLegalId_fkey"
    FOREIGN KEY ("parametroLegalId") REFERENCES "parametros_legales_nomina"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_snapshots"
    ADD CONSTRAINT "payroll_snapshots_centroCostoId_fkey"
    FOREIGN KEY ("centroCostoId") REFERENCES "centros_costo"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_snapshots"
    ADD CONSTRAINT "payroll_snapshots_aprobadoPorId_fkey"
    FOREIGN KEY ("aprobadoPorId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
