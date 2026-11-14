-- Billing records are tenant-owned. Invoice items inherit their tenant scope
-- from the owning invoice because the child table has no tenantId column.
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;

CREATE POLICY "customers_tenant_select" ON "customers"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "customers_tenant_insert" ON "customers"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "customers_tenant_update" ON "customers"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "customers_tenant_delete" ON "customers"
  FOR DELETE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

ALTER TABLE "product_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_services" FORCE ROW LEVEL SECURITY;

CREATE POLICY "product_services_tenant_select" ON "product_services"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "product_services_tenant_insert" ON "product_services"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "product_services_tenant_update" ON "product_services"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;

CREATE POLICY "invoices_tenant_select" ON "invoices"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "invoices_tenant_insert" ON "invoices"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "customers" c
      WHERE c."id" = "invoices"."customerId"
        AND c."tenantId" = "invoices"."tenantId"
    )
  );

CREATE POLICY "invoices_tenant_update" ON "invoices"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    AND EXISTS (
      SELECT 1
      FROM "customers" c
      WHERE c."id" = "invoices"."customerId"
        AND c."tenantId" = "invoices"."tenantId"
    )
  );

ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_items" FORCE ROW LEVEL SECURITY;

CREATE POLICY "invoice_items_tenant_select" ON "invoice_items"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "invoices" i
      WHERE i."id" = "invoice_items"."invoiceId"
        AND i."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    )
  );

CREATE POLICY "invoice_items_tenant_insert" ON "invoice_items"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "invoices" i
      WHERE i."id" = "invoice_items"."invoiceId"
        AND i."tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
    )
  );

-- Invoice items are immutable billing snapshots: no UPDATE or DELETE policy.
-- Invoices have no delete endpoint; their state changes are auditable updates.
