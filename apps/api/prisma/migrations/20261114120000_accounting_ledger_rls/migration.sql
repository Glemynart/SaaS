-- Defense in depth for tenant-scoped accounting catalogs and Ledger rows.
-- The global chart template remains readable by every tenant but is never
-- writable through a tenant-scoped application session.

ALTER TABLE "cuentas_contables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cuentas_contables" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cuentas_contables_tenant_policy" ON "cuentas_contables"
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "cuentas_contables_global_template_select" ON "cuentas_contables"
  FOR SELECT
  USING ("tenantId" IS NULL);

ALTER TABLE "terceros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "terceros" FORCE ROW LEVEL SECURITY;
CREATE POLICY "terceros_tenant_policy" ON "terceros"
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

ALTER TABLE "periodos_contables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "periodos_contables" FORCE ROW LEVEL SECURITY;
CREATE POLICY "periodos_contables_tenant_policy" ON "periodos_contables"
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

ALTER TABLE "centros_costo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "centros_costo" FORCE ROW LEVEL SECURITY;
CREATE POLICY "centros_costo_tenant_policy" ON "centros_costo"
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

ALTER TABLE "cuenta_sistema_map" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cuenta_sistema_map" FORCE ROW LEVEL SECURITY;
CREATE POLICY "cuenta_sistema_map_tenant_policy" ON "cuenta_sistema_map"
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

ALTER TABLE "comprobantes_contables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comprobantes_contables" FORCE ROW LEVEL SECURITY;
CREATE POLICY "comprobantes_contables_tenant_policy" ON "comprobantes_contables"
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

ALTER TABLE "movimientos_contables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "movimientos_contables" FORCE ROW LEVEL SECURITY;
CREATE POLICY "movimientos_contables_tenant_policy" ON "movimientos_contables"
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

ALTER TABLE "secuencias_comprobante" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "secuencias_comprobante" FORCE ROW LEVEL SECURITY;
CREATE POLICY "secuencias_comprobante_tenant_policy" ON "secuencias_comprobante"
  FOR ALL
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  )
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );
