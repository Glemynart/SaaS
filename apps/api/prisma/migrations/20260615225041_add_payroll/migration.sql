-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('DRAFT', 'CLOSED');

-- CreateEnum
CREATE TYPE "PayrollConceptType" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "PayrollNoveltyType" AS ENUM ('VACATION', 'SICKNESS', 'LICENSE', 'OVERTIME', 'BONUS', 'OTHER');

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "totalDevengos" DECIMAL(12,2) NOT NULL,
    "totalDeducciones" DECIMAL(12,2) NOT NULL,
    "netoPagar" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_concepts" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payrollRunId" TEXT NOT NULL,
    "tipo" "PayrollConceptType" NOT NULL,
    "nombre" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "payroll_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_novelties" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tipo" "PayrollNoveltyType" NOT NULL,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(12,2),

    CONSTRAINT "payroll_novelties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_periods_tenantId_idx" ON "payroll_periods"("tenantId");

-- CreateIndex
CREATE INDEX "payroll_periods_tenantId_status_idx" ON "payroll_periods"("tenantId", "status");

-- CreateIndex
CREATE INDEX "payroll_runs_tenantId_idx" ON "payroll_runs"("tenantId");

-- CreateIndex
CREATE INDEX "payroll_runs_tenantId_payrollPeriodId_idx" ON "payroll_runs"("tenantId", "payrollPeriodId");

-- CreateIndex
CREATE INDEX "payroll_runs_tenantId_employeeId_idx" ON "payroll_runs"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "payroll_concepts_payrollRunId_idx" ON "payroll_concepts"("payrollRunId");

-- CreateIndex
CREATE INDEX "payroll_novelties_tenantId_idx" ON "payroll_novelties"("tenantId");

-- CreateIndex
CREATE INDEX "payroll_novelties_tenantId_employeeId_idx" ON "payroll_novelties"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "payroll_novelties_tenantId_tipo_idx" ON "payroll_novelties"("tenantId", "tipo");

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_concepts" ADD CONSTRAINT "payroll_concepts_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_novelties" ADD CONSTRAINT "payroll_novelties_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_novelties" ADD CONSTRAINT "payroll_novelties_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
