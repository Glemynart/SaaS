-- A reset token must belong to the same tenant as its user. Fail closed if
-- historical data violates that invariant before replacing the single-column FK.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "password_reset_tokens" AS reset_token
    JOIN "users" AS account ON account."id" = reset_token."userId"
    WHERE account."tenantId" IS DISTINCT FROM reset_token."tenantId"
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce password reset tenant integrity: a token belongs to a different tenant than its user';
  END IF;
END;
$$;

CREATE UNIQUE INDEX "users_tenantId_id_key" ON "users"("tenantId", "id");

ALTER TABLE "password_reset_tokens"
  DROP CONSTRAINT "password_reset_tokens_userId_fkey";

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_tenantId_userId_fkey"
  FOREIGN KEY ("tenantId", "userId")
  REFERENCES "users"("tenantId", "id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
