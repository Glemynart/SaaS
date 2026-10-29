-- E6.2: preserve the actor that resolved an operational alert.
ALTER TABLE "alerts_new" ADD COLUMN "resolvedById" TEXT;

CREATE INDEX "alerts_new_tenantId_resolvedById_idx"
  ON "alerts_new"("tenantId", "resolvedById");
