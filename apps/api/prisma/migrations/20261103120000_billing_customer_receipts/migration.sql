CREATE TYPE "CustomerReceiptMethod" AS ENUM ('EFECTIVO', 'TRANSFERENCIA');

CREATE UNIQUE INDEX "customers_id_tenant_key"
ON "customers" ("id", "tenantId");

CREATE UNIQUE INDEX "invoices_id_tenant_key"
ON "invoices" ("id", "tenantId");

ALTER TABLE "invoices"
ADD COLUMN "fechaVencimiento" DATE;

CREATE INDEX "invoices_tenant_status_due_date_idx"
ON "invoices" ("tenantId", "status", "fechaVencimiento");

CREATE TABLE "customer_receipts" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fechaRecibo" DATE NOT NULL,
    "medio" "CustomerReceiptMethod" NOT NULL,
    "referencia" VARCHAR(120),
    "monto" DECIMAL(14,2) NOT NULL,
    "idempotencyKey" VARCHAR(36) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "registradoPorId" TEXT NOT NULL,

    CONSTRAINT "customer_receipts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_receipts_positive_amount_check" CHECK ("monto" > 0),
    CONSTRAINT "customer_receipts_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "customer_receipts_customerId_tenantId_fkey"
        FOREIGN KEY ("customerId", "tenantId") REFERENCES "customers"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "customer_receipts_id_tenant_key"
ON "customer_receipts" ("id", "tenantId");

CREATE UNIQUE INDEX "customer_receipts_tenant_idempotency_key"
ON "customer_receipts" ("tenantId", "idempotencyKey");

CREATE INDEX "customer_receipts_tenant_customer_date_idx"
ON "customer_receipts" ("tenantId", "customerId", "fechaRecibo");

CREATE TABLE "invoice_receipt_allocations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "invoice_receipt_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invoice_receipt_allocations_positive_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "invoice_receipt_allocations_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoice_receipt_allocations_receiptId_tenantId_fkey"
        FOREIGN KEY ("receiptId", "tenantId") REFERENCES "customer_receipts"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoice_receipt_allocations_invoiceId_tenantId_fkey"
        FOREIGN KEY ("invoiceId", "tenantId") REFERENCES "invoices"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "invoice_receipt_allocations_receipt_invoice_key"
ON "invoice_receipt_allocations" ("receiptId", "invoiceId");

CREATE INDEX "invoice_receipt_allocations_tenant_invoice_idx"
ON "invoice_receipt_allocations" ("tenantId", "invoiceId");

CREATE TABLE "customer_receipt_reversals" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "reversedById" TEXT NOT NULL,
    "originalVoucherId" TEXT NOT NULL,
    "reversalVoucherId" TEXT NOT NULL,

    CONSTRAINT "customer_receipt_reversals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_receipt_reversals_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "customer_receipt_reversals_receiptId_tenantId_fkey"
        FOREIGN KEY ("receiptId", "tenantId") REFERENCES "customer_receipts"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "customer_receipt_reversals_receipt_tenant_key"
ON "customer_receipt_reversals" ("receiptId", "tenantId");

CREATE INDEX "customer_receipt_reversals_tenant_created_idx"
ON "customer_receipt_reversals" ("tenantId", "createdAt");

ALTER TABLE "customer_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_receipts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_receipts_tenant_policy"
  ON "customer_receipts"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));

ALTER TABLE "invoice_receipt_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_receipt_allocations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "invoice_receipt_allocations_tenant_policy"
  ON "invoice_receipt_allocations"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));

ALTER TABLE "customer_receipt_reversals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_receipt_reversals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "customer_receipt_reversals_tenant_policy"
  ON "customer_receipt_reversals"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));
