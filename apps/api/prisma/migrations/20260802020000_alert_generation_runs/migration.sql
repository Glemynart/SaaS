CREATE TYPE "AlertGenerationRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED');
CREATE TYPE "AlertGenerationRunTrigger" AS ENUM ('SCHEDULED', 'MANUAL_RETRY');
CREATE TYPE "AlertGenerationRunTenantStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "alert_generation_runs" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schedulerKey" TEXT NOT NULL,
  "trigger" "AlertGenerationRunTrigger" NOT NULL DEFAULT 'SCHEDULED',
  "parentRunId" TEXT,
  "status" "AlertGenerationRunStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "tenantsProcessed" INTEGER NOT NULL DEFAULT 0,
  "tenantsFailed" INTEGER NOT NULL DEFAULT 0,
  "contractAlertsCreated" INTEGER NOT NULL DEFAULT 0,
  "missingDocAlertsCreated" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "alert_generation_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alert_generation_runs_one_running_per_scheduler_idx"
  ON "alert_generation_runs" ("schedulerKey")
  WHERE "status" = 'RUNNING';
CREATE INDEX "alert_generation_runs_schedulerKey_startedAt_idx"
  ON "alert_generation_runs" ("schedulerKey", "startedAt");
CREATE INDEX "alert_generation_runs_parentRunId_idx"
  ON "alert_generation_runs" ("parentRunId");

CREATE TABLE "alert_generation_run_tenants" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "runId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "status" "AlertGenerationRunTenantStatus" NOT NULL DEFAULT 'RUNNING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "contractAlertsCreated" INTEGER NOT NULL DEFAULT 0,
  "missingDocAlertsCreated" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "alert_generation_run_tenants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "alert_generation_run_tenants_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "alert_generation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "alert_generation_run_tenants_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "alert_generation_run_tenants_runId_tenantId_key"
  ON "alert_generation_run_tenants" ("runId", "tenantId");
CREATE INDEX "alert_generation_run_tenants_tenantId_startedAt_idx"
  ON "alert_generation_run_tenants" ("tenantId", "startedAt");
CREATE INDEX "alert_generation_run_tenants_runId_status_idx"
  ON "alert_generation_run_tenants" ("runId", "status");
