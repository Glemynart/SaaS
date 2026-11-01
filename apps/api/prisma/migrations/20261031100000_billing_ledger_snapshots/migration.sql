-- Snapshot tax and counterparty data for internal invoice-to-Ledger posting.
-- Existing invoices/items remain nullable and are not backfilled automatically.

CREATE UNIQUE INDEX "terceros_id_tenantId_key" ON "terceros"("id", "tenantId");

ALTER TABLE "customers" ADD COLUMN "terceroId" TEXT;
ALTER TABLE "customers"
  ADD CONSTRAINT "customers_terceroId_tenantId_fkey"
  FOREIGN KEY ("terceroId", "tenantId")
  REFERENCES "terceros"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD COLUMN "terceroId" TEXT,
  ADD COLUMN "customerRazonSocialSnapshot" TEXT,
  ADD COLUMN "customerNitSnapshot" TEXT,
  ADD COLUMN "terceroRazonSocialSnapshot" TEXT,
  ADD COLUMN "terceroTipoDocumentoSnapshot" "TipoDocIdentidad",
  ADD COLUMN "terceroNumeroDocumentoSnapshot" TEXT,
  ADD COLUMN "terceroDigitoVerificacionSnapshot" TEXT;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_terceroId_tenantId_fkey"
  FOREIGN KEY ("terceroId", "tenantId")
  REFERENCES "terceros"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoice_items"
  ADD COLUMN "porcentajeImpuesto" DECIMAL(5,2),
  ADD COLUMN "valorImpuesto" DECIMAL(12,2);

CREATE UNIQUE INDEX "customers_terceroId_tenantId_key" ON "customers"("terceroId", "tenantId");
CREATE INDEX "invoices_tenantId_terceroId_idx" ON "invoices"("tenantId", "terceroId");
