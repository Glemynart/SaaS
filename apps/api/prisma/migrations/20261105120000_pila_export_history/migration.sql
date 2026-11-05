CREATE TYPE "PilaExportStatus" AS ENUM ('LOCAL_VALIDATED');

CREATE UNIQUE INDEX "payroll_periods_id_tenantId_key"
  ON "payroll_periods"("id", "tenantId");

CREATE TABLE "pila_exports" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "payrollPeriodId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "status" "PilaExportStatus" NOT NULL DEFAULT 'LOCAL_VALIDATED',
  "fechaInicioPeriodo" DATE NOT NULL,
  "fechaFinPeriodo" DATE NOT NULL,
  "fechaPrevistaPagoPila" DATE,
  "normativeVersion" VARCHAR(32) NOT NULL,
  "fileFormatVersion" VARCHAR(64) NOT NULL,
  "normativeRuleVersions" TEXT[] NOT NULL,
  "sourceSnapshotIds" TEXT[] NOT NULL,
  "sourceFingerprint" CHAR(64) NOT NULL,
  "type1StorageKey" VARCHAR(512) NOT NULL,
  "type1Sha256" CHAR(64) NOT NULL,
  "type1SizeBytes" INTEGER NOT NULL,
  "type1RecordCount" INTEGER NOT NULL DEFAULT 1,
  "type2StorageKey" VARCHAR(512) NOT NULL,
  "type2Sha256" CHAR(64) NOT NULL,
  "type2SizeBytes" INTEGER NOT NULL,
  "type2RecordCount" INTEGER NOT NULL,
  "detailRecordCount" INTEGER NOT NULL,

  CONSTRAINT "pila_exports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pila_exports_positive_sizes_check"
    CHECK ("type1SizeBytes" > 0 AND "type2SizeBytes" > 0),
  CONSTRAINT "pila_exports_positive_record_counts_check"
    CHECK ("type1RecordCount" = 1 AND "type2RecordCount" > 1 AND "detailRecordCount" > 0),
  CONSTRAINT "pila_exports_period_dates_check"
    CHECK ("fechaFinPeriodo" >= "fechaInicioPeriodo"),
  CONSTRAINT "pila_exports_source_snapshots_check"
    CHECK (cardinality("sourceSnapshotIds") > 0),
  CONSTRAINT "pila_exports_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pila_exports_payrollPeriodId_tenantId_fkey"
    FOREIGN KEY ("payrollPeriodId", "tenantId") REFERENCES "payroll_periods"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "pila_exports_tenant_period_fingerprint_key"
  ON "pila_exports"("tenantId", "payrollPeriodId", "sourceFingerprint");
CREATE INDEX "pila_exports_tenant_period_created_idx"
  ON "pila_exports"("tenantId", "payrollPeriodId", "createdAt");

ALTER TABLE "pila_exports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pila_exports" FORCE ROW LEVEL SECURITY;
CREATE POLICY "pila_exports_tenant_policy"
  ON "pila_exports"
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant_id', true), ''));

CREATE FUNCTION "reject_pila_export_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'PILA export history is append-only.' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "pila_exports_immutable_trigger"
  BEFORE UPDATE OR DELETE ON "pila_exports"
  FOR EACH ROW EXECUTE FUNCTION "reject_pila_export_mutation"();

CREATE TRIGGER "pila_exports_no_truncate_trigger"
  BEFORE TRUNCATE ON "pila_exports"
  FOR EACH STATEMENT EXECUTE FUNCTION "reject_pila_export_mutation"();
