ALTER TABLE "product_services" ALTER COLUMN "impuesto" DROP DEFAULT;

ALTER TABLE "invoice_items"
ADD COLUMN "impuestoTarifa" DECIMAL(5, 2),
ADD COLUMN "impuestoValor" DECIMAL(12, 2);
