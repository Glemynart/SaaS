CREATE UNIQUE INDEX "terceros_id_tenantId_key" ON "terceros"("id", "tenantId");

ALTER TABLE "customers" ADD COLUMN "terceroId" TEXT;

CREATE INDEX "customers_tenantId_terceroId_idx" ON "customers"("tenantId", "terceroId");

ALTER TABLE "customers"
ADD CONSTRAINT "customers_terceroId_tenantId_fkey"
FOREIGN KEY ("terceroId", "tenantId")
REFERENCES "terceros"("id", "tenantId")
ON DELETE RESTRICT ON UPDATE CASCADE;
