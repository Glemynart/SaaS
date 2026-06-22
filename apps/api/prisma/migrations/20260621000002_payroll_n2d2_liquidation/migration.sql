-- N2D.2 — Liquidaciones laborales colombianas
-- Dominio propio: independiente de PayrollRun y PayrollPeriod.
-- El calculator (N2D.1) recalcula desde fechas reales; las provisiones
-- N2B (PROV_PRIMA, PROV_CESANTIAS, etc.) son costo contable y nunca
-- se leen en este módulo.

-- CreateEnum
CREATE TYPE "LiquidationStatus" AS ENUM ('DRAFT', 'FINALIZED', 'VOIDED');

-- CreateEnum
CREATE TYPE "LiquidationConceptType" AS ENUM ('EARNING', 'PROVISION');

-- CreateTable
CREATE TABLE "liquidations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "fechaRetiro" TIMESTAMP(3) NOT NULL,
    "status" "LiquidationStatus" NOT NULL DEFAULT 'DRAFT',
    "diasLiquidados" INTEGER NOT NULL,
    "totalDevengado" DECIMAL(14,2) NOT NULL,
    "totalProvisiones" DECIMAL(14,2) NOT NULL,
    "totalLiquidacion" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "liquidations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidation_concepts" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "liquidationId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "LiquidationConceptType" NOT NULL,
    "base" DECIMAL(14,2),
    "factor" DECIMAL(8,6),
    "valor" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "liquidation_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "liquidations_tenantId_idx" ON "liquidations"("tenantId");

-- CreateIndex
CREATE INDEX "liquidations_empleadoId_idx" ON "liquidations"("empleadoId");

-- CreateIndex
CREATE INDEX "liquidations_status_idx" ON "liquidations"("status");

-- CreateIndex
CREATE INDEX "liquidation_concepts_liquidationId_idx" ON "liquidation_concepts"("liquidationId");

-- CreateIndex
CREATE INDEX "liquidation_concepts_codigo_idx" ON "liquidation_concepts"("codigo");

-- AddForeignKey
ALTER TABLE "liquidations" ADD CONSTRAINT "liquidations_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidations" ADD CONSTRAINT "liquidations_empleadoId_fkey"
    FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidation_concepts" ADD CONSTRAINT "liquidation_concepts_liquidationId_fkey"
    FOREIGN KEY ("liquidationId") REFERENCES "liquidations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
