ALTER TABLE "audit_logs"
  ADD COLUMN "actorType" TEXT NOT NULL DEFAULT 'HUMAN';

UPDATE "audit_logs"
SET "actorType" = 'SYSTEM'
WHERE "userId" LIKE 'system:%'
   OR "userId" = 'service-premium-worker';

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_type_check"
  CHECK ("actorType" IN ('HUMAN', 'SYSTEM'));

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_tenant_select"
  ON "audit_logs"
  FOR SELECT
  USING (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

CREATE POLICY "audit_logs_tenant_insert"
  ON "audit_logs"
  FOR INSERT
  WITH CHECK (
    "tenantId" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "audit_logs" FROM PUBLIC;
