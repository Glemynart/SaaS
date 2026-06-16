-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "alerts_new" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT,
    "employeeFileId" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "alerts_new_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alerts_new_tenantId_idx" ON "alerts_new"("tenantId");

-- CreateIndex
CREATE INDEX "alerts_new_tenantId_status_idx" ON "alerts_new"("tenantId", "status");

-- CreateIndex
CREATE INDEX "alerts_new_tenantId_severity_idx" ON "alerts_new"("tenantId", "severity");

-- CreateIndex
CREATE INDEX "alerts_new_tenantId_employeeId_idx" ON "alerts_new"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "alerts_new_tenantId_dueDate_idx" ON "alerts_new"("tenantId", "dueDate");

-- AddForeignKey
ALTER TABLE "alerts_new" ADD CONSTRAINT "alerts_new_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts_new" ADD CONSTRAINT "alerts_new_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts_new" ADD CONSTRAINT "alerts_new_employeeFileId_fkey" FOREIGN KEY ("employeeFileId") REFERENCES "employee_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
