-- Payroll P1.5 - Unidad A: acto de corrección post-aprobación.
-- Aditiva: crea PayrollCorrection como hecho independiente asociado a un
-- PayrollPeriod aprobado, sin efectos materiales.

CREATE TYPE "PayrollCorrectionStatus" AS ENUM (
    'BORRADOR',
    'EN_REVISION',
    'APROBADA',
    'RECHAZADA',
    'CANCELADA'
);

CREATE TABLE "payroll_corrections" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "status" "PayrollCorrectionStatus" NOT NULL DEFAULT 'BORRADOR',
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "payroll_corrections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_corrections_tenantId_idx"
    ON "payroll_corrections" ("tenantId");

CREATE INDEX "payroll_corrections_tenantId_payrollPeriodId_idx"
    ON "payroll_corrections" ("tenantId", "payrollPeriodId");

CREATE INDEX "payroll_corrections_tenantId_payrollPeriodId_status_idx"
    ON "payroll_corrections" ("tenantId", "payrollPeriodId", "status");

ALTER TABLE "payroll_corrections"
    ADD CONSTRAINT "payroll_corrections_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_corrections"
    ADD CONSTRAINT "payroll_corrections_payrollPeriodId_fkey"
    FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
