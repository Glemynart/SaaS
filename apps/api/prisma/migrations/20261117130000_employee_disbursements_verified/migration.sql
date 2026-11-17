CREATE TYPE "EmployeeDisbursementStatus" AS ENUM (
  'DECLARED',
  'SUPPORTED',
  'VERIFIED',
  'CANCELLED'
);

CREATE TYPE "EmployeeDisbursementMethod" AS ENUM (
  'BANK_TRANSFER',
  'CASH',
  'CHECK',
  'OTHER'
);

ALTER TABLE "payroll_runs"
  ADD CONSTRAINT "payroll_runs_tenant_id_employee_key"
  UNIQUE ("tenantId", "id", "employeeId");

ALTER TABLE "liquidations"
  ADD CONSTRAINT "liquidations_tenant_id_employee_key"
  UNIQUE ("tenantId", "id", "empleadoId");

CREATE TABLE "employee_disbursements" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "payrollRunId" TEXT,
  "liquidationId" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'COP',
  "paidAt" DATE NOT NULL,
  "method" "EmployeeDisbursementMethod" NOT NULL,
  "reference" VARCHAR(128),
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "status" "EmployeeDisbursementStatus" NOT NULL DEFAULT 'DECLARED',
  "supportStorageKey" VARCHAR(512),
  "supportMimeType" VARCHAR(100),
  "supportSizeBytes" INTEGER,
  "supportSha256" CHAR(64),
  "supportedAt" TIMESTAMP(3),
  "registeredByUserId" TEXT NOT NULL,
  "verifiedByUserId" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "cancelledByUserId" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" VARCHAR(512),

  CONSTRAINT "employee_disbursements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_disbursements_tenant_id_key" UNIQUE ("tenantId", "id"),
  CONSTRAINT "employee_disbursements_tenant_idempotency_key"
    UNIQUE ("tenantId", "idempotencyKey"),
  CONSTRAINT "employee_disbursements_tenant_support_key"
    UNIQUE ("tenantId", "supportStorageKey"),
  CONSTRAINT "employee_disbursements_source_xor_check"
    CHECK (("payrollRunId" IS NULL) <> ("liquidationId" IS NULL)),
  CONSTRAINT "employee_disbursements_amount_positive_check"
    CHECK ("amount" > 0),
  CONSTRAINT "employee_disbursements_currency_check"
    CHECK ("currency" = 'COP'),
  CONSTRAINT "employee_disbursements_support_metadata_check"
    CHECK (
      (
        "supportStorageKey" IS NULL AND "supportMimeType" IS NULL AND
        "supportSizeBytes" IS NULL AND "supportSha256" IS NULL AND
        "supportedAt" IS NULL
      ) OR (
        "supportStorageKey" IS NOT NULL AND "supportMimeType" IS NOT NULL AND
        "supportSizeBytes" > 0 AND "supportSha256" IS NOT NULL AND
        "supportedAt" IS NOT NULL AND
        "supportStorageKey" LIKE 'tenants/' || "tenantId" ||
          '/employee-disbursements/' || "id" || '/%'
      )
    ),
  CONSTRAINT "employee_disbursements_supported_requires_file_check"
    CHECK ("status" NOT IN ('SUPPORTED', 'VERIFIED') OR "supportStorageKey" IS NOT NULL),
  CONSTRAINT "employee_disbursements_verification_fields_check"
    CHECK (
      ("status" = 'VERIFIED' AND "verifiedByUserId" IS NOT NULL AND "verifiedAt" IS NOT NULL) OR
      ("status" <> 'VERIFIED' AND "verifiedByUserId" IS NULL AND "verifiedAt" IS NULL)
    ),
  CONSTRAINT "employee_disbursements_cancellation_fields_check"
    CHECK (
      ("status" = 'CANCELLED' AND "cancelledByUserId" IS NOT NULL AND "cancelledAt" IS NOT NULL AND length(trim("cancellationReason")) > 0) OR
      ("status" <> 'CANCELLED' AND "cancelledByUserId" IS NULL AND "cancelledAt" IS NULL AND "cancellationReason" IS NULL)
    ),
  CONSTRAINT "employee_disbursements_declared_without_support_check"
    CHECK ("status" <> 'DECLARED' OR "supportStorageKey" IS NULL),
  CONSTRAINT "employee_disbursements_tenant_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "employee_disbursements_employee_tenant_fkey"
    FOREIGN KEY ("employeeId", "tenantId") REFERENCES "empleados"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "employee_disbursements_payroll_run_employee_fkey"
    FOREIGN KEY ("tenantId", "payrollRunId", "employeeId")
    REFERENCES "payroll_runs"("tenantId", "id", "employeeId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "employee_disbursements_liquidation_employee_fkey"
    FOREIGN KEY ("tenantId", "liquidationId", "employeeId")
    REFERENCES "liquidations"("tenantId", "id", "empleadoId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "employee_disbursements_registered_by_fkey"
    FOREIGN KEY ("tenantId", "registeredByUserId") REFERENCES "users"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "employee_disbursements_verified_by_fkey"
    FOREIGN KEY ("tenantId", "verifiedByUserId") REFERENCES "users"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "employee_disbursements_cancelled_by_fkey"
    FOREIGN KEY ("tenantId", "cancelledByUserId") REFERENCES "users"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "employee_disbursement_reversals" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "disbursementId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "reason" VARCHAR(512) NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "createdByUserId" TEXT NOT NULL,

  CONSTRAINT "employee_disbursement_reversals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_disbursement_reversals_tenant_id_key" UNIQUE ("tenantId", "id"),
  CONSTRAINT "employee_disbursement_reversals_tenant_idempotency_key"
    UNIQUE ("tenantId", "idempotencyKey"),
  CONSTRAINT "employee_disbursement_reversals_amount_positive_check"
    CHECK ("amount" > 0),
  CONSTRAINT "employee_disbursement_reversals_reason_check"
    CHECK (length(trim("reason")) > 0),
  CONSTRAINT "employee_disbursement_reversals_tenant_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "employee_disbursement_reversals_disbursement_fkey"
    FOREIGN KEY ("tenantId", "disbursementId") REFERENCES "employee_disbursements"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "employee_disbursement_reversals_created_by_fkey"
    FOREIGN KEY ("tenantId", "createdByUserId") REFERENCES "users"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "employee_disbursements_tenant_employee_paid_at_idx"
  ON "employee_disbursements"("tenantId", "employeeId", "paidAt");
CREATE INDEX "employee_disbursements_tenant_payroll_status_idx"
  ON "employee_disbursements"("tenantId", "payrollRunId", "status");
CREATE INDEX "employee_disbursements_tenant_liquidation_status_idx"
  ON "employee_disbursements"("tenantId", "liquidationId", "status");
CREATE INDEX "employee_disbursement_reversals_tenant_disbursement_created_idx"
  ON "employee_disbursement_reversals"("tenantId", "disbursementId", "createdAt");

ALTER TABLE "employee_disbursements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_disbursements" FORCE ROW LEVEL SECURITY;
CREATE POLICY "employee_disbursements_tenant_select"
  ON "employee_disbursements" FOR SELECT
  USING ("tenantId" = (SELECT audit_private.current_tenant_id()));
CREATE POLICY "employee_disbursements_tenant_insert"
  ON "employee_disbursements" FOR INSERT
  WITH CHECK ("tenantId" = (SELECT audit_private.current_tenant_id()));
CREATE POLICY "employee_disbursements_tenant_update"
  ON "employee_disbursements" FOR UPDATE
  USING ("tenantId" = (SELECT audit_private.current_tenant_id()))
  WITH CHECK ("tenantId" = (SELECT audit_private.current_tenant_id()));

ALTER TABLE "employee_disbursement_reversals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_disbursement_reversals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "employee_disbursement_reversals_tenant_select"
  ON "employee_disbursement_reversals" FOR SELECT
  USING ("tenantId" = (SELECT audit_private.current_tenant_id()));
CREATE POLICY "employee_disbursement_reversals_tenant_insert"
  ON "employee_disbursement_reversals" FOR INSERT
  WITH CHECK ("tenantId" = (SELECT audit_private.current_tenant_id()));

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "employee_disbursement_reversals" FROM PUBLIC;
REVOKE DELETE, TRUNCATE ON TABLE "employee_disbursements" FROM PUBLIC;

-- The staging bootstrap grants CRUD on newly-created public tables by default.
-- Remove destructive privileges from the identified API runtime role while
-- retaining only the table operations required by this workflow.
DO $$
DECLARE
  runtime_role record;
  recognized_runtime_roles integer := 0;
BEGIN
  FOR runtime_role IN
    SELECT oid, rolname
    FROM pg_roles
    WHERE (rolname = 'saas_api_runtime' AND current_database() = 'oficina_nitida')
       OR pg_catalog.shobj_description(oid, 'pg_authid') = 'dusema:goal01-staging-runtime'
  LOOP
    recognized_runtime_roles := recognized_runtime_roles + 1;
    EXECUTE format(
      'REVOKE DELETE, TRUNCATE ON TABLE public.employee_disbursements FROM %I',
      runtime_role.rolname
    );
    EXECUTE format(
      'REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.employee_disbursement_reversals FROM %I',
      runtime_role.rolname
    );

    IF has_table_privilege(runtime_role.oid, 'public.employee_disbursements', 'DELETE')
       OR has_table_privilege(runtime_role.oid, 'public.employee_disbursements', 'TRUNCATE')
       OR has_table_privilege(runtime_role.oid, 'public.employee_disbursement_reversals', 'UPDATE')
       OR has_table_privilege(runtime_role.oid, 'public.employee_disbursement_reversals', 'DELETE')
       OR has_table_privilege(runtime_role.oid, 'public.employee_disbursement_reversals', 'TRUNCATE') THEN
      RAISE EXCEPTION 'Runtime role % retains destructive employee-disbursement privileges', runtime_role.rolname;
    END IF;
  END LOOP;

  IF recognized_runtime_roles = 0 THEN
    RAISE EXCEPTION
      'No recognized API runtime role found; provision and mark the runtime role before applying employee-disbursement migration';
  END IF;
END;
$$;

CREATE FUNCTION "guard_employee_disbursement_history"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'DECLARED' OR NEW."supportStorageKey" IS NOT NULL OR
       NEW."verifiedByUserId" IS NOT NULL OR NEW."verifiedAt" IS NOT NULL OR
       NEW."cancelledByUserId" IS NOT NULL OR NEW."cancelledAt" IS NOT NULL OR
       NEW."cancellationReason" IS NOT NULL THEN
      RAISE EXCEPTION 'employee disbursement must start as DECLARED';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW."id", NEW."createdAt", NEW."tenantId", NEW."employeeId",
           NEW."payrollRunId", NEW."liquidationId", NEW."amount", NEW."currency",
           NEW."paidAt", NEW."method", NEW."reference", NEW."idempotencyKey",
           NEW."registeredByUserId") IS DISTINCT FROM
       ROW(OLD."id", OLD."createdAt", OLD."tenantId", OLD."employeeId",
           OLD."payrollRunId", OLD."liquidationId", OLD."amount", OLD."currency",
           OLD."paidAt", OLD."method", OLD."reference", OLD."idempotencyKey",
           OLD."registeredByUserId") THEN
      RAISE EXCEPTION 'employee disbursement facts are immutable';
    END IF;

    IF OLD."status" = 'DECLARED' AND NEW."status" = 'SUPPORTED' THEN
      IF NEW."supportStorageKey" IS NULL OR NEW."verifiedByUserId" IS NOT NULL OR
         NEW."verifiedAt" IS NOT NULL OR NEW."cancelledByUserId" IS NOT NULL OR
         NEW."cancelledAt" IS NOT NULL OR NEW."cancellationReason" IS NOT NULL THEN
        RAISE EXCEPTION 'invalid DECLARED to SUPPORTED transition';
      END IF;
      RETURN NEW;
    ELSIF OLD."status" = 'DECLARED' AND NEW."status" = 'CANCELLED' THEN
      IF ROW(NEW."supportStorageKey", NEW."supportMimeType", NEW."supportSizeBytes",
             NEW."supportSha256", NEW."supportedAt") IS DISTINCT FROM
         ROW(OLD."supportStorageKey", OLD."supportMimeType", OLD."supportSizeBytes",
             OLD."supportSha256", OLD."supportedAt") OR
         NEW."cancelledByUserId" IS NULL OR NEW."cancelledAt" IS NULL OR
         NEW."cancellationReason" IS NULL THEN
        RAISE EXCEPTION 'invalid DECLARED to CANCELLED transition';
      END IF;
      RETURN NEW;
    ELSIF OLD."status" = 'SUPPORTED' AND NEW."status" = 'VERIFIED' THEN
      IF NEW."paidAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date THEN
        RAISE EXCEPTION 'future disbursement cannot be verified';
      END IF;
      IF ROW(NEW."supportStorageKey", NEW."supportMimeType", NEW."supportSizeBytes",
             NEW."supportSha256", NEW."supportedAt") IS DISTINCT FROM
         ROW(OLD."supportStorageKey", OLD."supportMimeType", OLD."supportSizeBytes",
             OLD."supportSha256", OLD."supportedAt") OR
         NEW."verifiedByUserId" IS NULL OR NEW."verifiedAt" IS NULL OR
         NEW."cancelledByUserId" IS NOT NULL OR NEW."cancelledAt" IS NOT NULL OR
         NEW."cancellationReason" IS NOT NULL THEN
        RAISE EXCEPTION 'invalid SUPPORTED to VERIFIED transition';
      END IF;
      RETURN NEW;
    ELSIF OLD."status" = 'SUPPORTED' AND NEW."status" = 'CANCELLED' THEN
      IF ROW(NEW."supportStorageKey", NEW."supportMimeType", NEW."supportSizeBytes",
             NEW."supportSha256", NEW."supportedAt") IS DISTINCT FROM
         ROW(OLD."supportStorageKey", OLD."supportMimeType", OLD."supportSizeBytes",
             OLD."supportSha256", OLD."supportedAt") OR
         NEW."cancelledByUserId" IS NULL OR NEW."cancelledAt" IS NULL OR
         NEW."cancellationReason" IS NULL THEN
        RAISE EXCEPTION 'invalid SUPPORTED to CANCELLED transition';
      END IF;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'invalid or terminal employee disbursement transition';
  END IF;

  RAISE EXCEPTION 'employee disbursements cannot be deleted or truncated';
END;
$$;

CREATE TRIGGER "employee_disbursements_history_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "employee_disbursements"
  FOR EACH ROW EXECUTE FUNCTION "guard_employee_disbursement_history"();
CREATE TRIGGER "employee_disbursements_truncate_guard"
  BEFORE TRUNCATE ON "employee_disbursements"
  FOR EACH STATEMENT EXECUTE FUNCTION "guard_employee_disbursement_history"();

CREATE FUNCTION "guard_employee_disbursement_reversal"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  original_status "EmployeeDisbursementStatus";
  original_amount DECIMAL(14,2);
  already_reversed DECIMAL(14,2);
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT "status", "amount"
      INTO original_status, original_amount
      FROM "employee_disbursements"
      WHERE "tenantId" = NEW."tenantId" AND "id" = NEW."disbursementId"
      FOR UPDATE;
    IF NOT FOUND OR original_status <> 'VERIFIED' THEN
      RAISE EXCEPTION 'only a verified disbursement can be reversed';
    END IF;
    SELECT COALESCE(SUM("amount"), 0)
      INTO already_reversed
      FROM "employee_disbursement_reversals"
      WHERE "tenantId" = NEW."tenantId" AND "disbursementId" = NEW."disbursementId";
    IF NEW."amount" + already_reversed > original_amount THEN
      RAISE EXCEPTION 'reversal amount exceeds verified disbursement';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'employee disbursement reversals are append-only';
END;
$$;

CREATE TRIGGER "employee_disbursement_reversals_append_only"
  BEFORE INSERT OR UPDATE OR DELETE ON "employee_disbursement_reversals"
  FOR EACH ROW EXECUTE FUNCTION "guard_employee_disbursement_reversal"();
CREATE TRIGGER "employee_disbursement_reversals_truncate_guard"
  BEFORE TRUNCATE ON "employee_disbursement_reversals"
  FOR EACH STATEMENT EXECUTE FUNCTION "guard_employee_disbursement_reversal"();
