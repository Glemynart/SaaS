-- Accounting periods are tenant-owned and immutable as catalog records. Runtime
-- access is limited to the active tenant; no DELETE policy is intentional.
ALTER TABLE "periodos_contables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "periodos_contables" FORCE ROW LEVEL SECURITY;

CREATE POLICY "periodos_contables_tenant_select" ON "periodos_contables"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "periodos_contables_tenant_insert" ON "periodos_contables"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "periodos_contables_tenant_update" ON "periodos_contables"
  FOR UPDATE
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

-- No DELETE policy: PeriodoContable has no delete endpoint or soft-delete
-- lifecycle. Even a database role with table-level DELETE cannot remove rows.
