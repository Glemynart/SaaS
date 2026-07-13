-- Payroll P1 - U4: Persistencia y ciclo de vida de bloqueos fail-secure.
-- Aditiva: crea la entidad independiente PayrollBlock sin modificar PayrollRun
-- ni PayrollSnapshot.

CREATE TYPE "PayrollBlockStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'EXCLUDED');

CREATE TABLE "payroll_blocks" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "PayrollBlockStatus" NOT NULL DEFAULT 'ACTIVE',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "excludedAt" TIMESTAMP(3),
    "excludedById" TEXT,
    "exclusionReason" TEXT,

    CONSTRAINT "payroll_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_blocks_tenantId_payrollPeriodId_employeeId_code_key"
    ON "payroll_blocks" ("tenantId", "payrollPeriodId", "employeeId", "code");

CREATE INDEX "payroll_blocks_tenantId_idx"
    ON "payroll_blocks" ("tenantId");

CREATE INDEX "payroll_blocks_tenantId_payrollPeriodId_idx"
    ON "payroll_blocks" ("tenantId", "payrollPeriodId");

CREATE INDEX "payroll_blocks_tenantId_payrollPeriodId_status_idx"
    ON "payroll_blocks" ("tenantId", "payrollPeriodId", "status");

CREATE INDEX "payroll_blocks_tenantId_employeeId_idx"
    ON "payroll_blocks" ("tenantId", "employeeId");

CREATE INDEX "payroll_blocks_excludedById_idx"
    ON "payroll_blocks" ("excludedById");

ALTER TABLE "payroll_blocks"
    ADD CONSTRAINT "payroll_blocks_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_blocks"
    ADD CONSTRAINT "payroll_blocks_payrollPeriodId_fkey"
    FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_blocks"
    ADD CONSTRAINT "payroll_blocks_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "empleados"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_blocks"
    ADD CONSTRAINT "payroll_blocks_excludedById_fkey"
    FOREIGN KEY ("excludedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
