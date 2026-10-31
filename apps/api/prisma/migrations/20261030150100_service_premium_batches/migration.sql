CREATE TYPE "ServicePremiumBatchStatus" AS ENUM (
  'BORRADOR',
  'APROBADO',
  'PROCESANDO',
  'COMPLETADO',
  'COMPLETADO_CON_BLOQUEOS',
  'ERROR',
  'ANULADO'
);

CREATE TYPE "ServicePremiumLineStatus" AS ENUM (
  'LISTA',
  'BLOQUEADA',
  'NO_APLICA',
  'APROBADA',
  'PROCESANDO',
  'DOCUMENTADA',
  'ERROR'
);

CREATE TABLE "service_premium_batches" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "anio" INTEGER NOT NULL,
  "semestre" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "formulaVersion" INTEGER NOT NULL,
  "status" "ServicePremiumBatchStatus" NOT NULL DEFAULT 'BORRADOR',
  "createdById" TEXT NOT NULL,
  "correctionReason" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "processingLeaseOwner" TEXT,
  "processingLeaseUntil" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "supersedesBatchId" TEXT,

  CONSTRAINT "service_premium_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_premium_lines" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "status" "ServicePremiumLineStatus" NOT NULL,
  "snapshot" JSONB NOT NULL,
  "sourceFingerprint" TEXT,
  "salaryBase" DECIMAL(14,2),
  "variableSalary" DECIMAL(14,2),
  "transportAllowance" DECIMAL(14,2),
  "serviceDays360" INTEGER,
  "amount" DECIMAL(14,2),
  "blockReason" TEXT,
  "processingAttempts" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" TEXT,
  "documentStorageKey" TEXT,
  "documentSizeBytes" INTEGER,
  "documentSha256" TEXT,

  CONSTRAINT "service_premium_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_premium_batches_tenantId_anio_semestre_version_key"
  ON "service_premium_batches"("tenantId", "anio", "semestre", "version");
CREATE UNIQUE INDEX "service_premium_batches_id_tenantId_key"
  ON "service_premium_batches"("id", "tenantId");
CREATE INDEX "service_premium_batches_tenantId_status_createdAt_idx"
  ON "service_premium_batches"("tenantId", "status", "createdAt");
CREATE INDEX "service_premium_batches_tenantId_anio_semestre_idx"
  ON "service_premium_batches"("tenantId", "anio", "semestre");
CREATE UNIQUE INDEX "service_premium_lines_tenantId_batchId_employeeId_key"
  ON "service_premium_lines"("tenantId", "batchId", "employeeId");
CREATE UNIQUE INDEX "service_premium_lines_id_tenantId_key"
  ON "service_premium_lines"("id", "tenantId");
CREATE INDEX "service_premium_lines_tenantId_batchId_status_idx"
  ON "service_premium_lines"("tenantId", "batchId", "status");
CREATE INDEX "service_premium_lines_tenantId_employeeId_createdAt_idx"
  ON "service_premium_lines"("tenantId", "employeeId", "createdAt");

ALTER TABLE "service_premium_batches"
  ADD CONSTRAINT "service_premium_batches_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_premium_batches"
  ADD CONSTRAINT "service_premium_batches_supersedesBatchId_fkey"
  FOREIGN KEY ("supersedesBatchId", "tenantId") REFERENCES "service_premium_batches"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_premium_lines"
  ADD CONSTRAINT "service_premium_lines_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "empleados_id_tenantId_key" ON "empleados"("id", "tenantId");
ALTER TABLE "service_premium_lines"
  ADD CONSTRAINT "service_premium_lines_batchId_fkey"
  FOREIGN KEY ("batchId", "tenantId") REFERENCES "service_premium_batches"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_premium_lines"
  ADD CONSTRAINT "service_premium_lines_employeeId_fkey"
  FOREIGN KEY ("employeeId", "tenantId") REFERENCES "empleados"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_premium_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_premium_batches" FORCE ROW LEVEL SECURITY;
CREATE POLICY "service_premium_batches_tenant_policy"
  ON "service_premium_batches"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));

ALTER TABLE "service_premium_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_premium_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY "service_premium_lines_tenant_policy"
  ON "service_premium_lines"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));

ALTER TABLE "expediente_docs"
  ADD COLUMN "servicePremiumLineId" TEXT;
CREATE UNIQUE INDEX "expediente_docs_servicePremiumLineId_key"
  ON "expediente_docs"("servicePremiumLineId");
CREATE UNIQUE INDEX "expediente_docs_servicePremiumLineId_tenantId_key"
  ON "expediente_docs"("servicePremiumLineId", "tenantId");
ALTER TABLE "expediente_docs"
  ADD CONSTRAINT "expediente_docs_servicePremiumLineId_fkey"
  FOREIGN KEY ("servicePremiumLineId", "tenantId") REFERENCES "service_premium_lines"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
