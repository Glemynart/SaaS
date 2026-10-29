CREATE TABLE "user_invitations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "rol" "UserRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "openKey" TEXT DEFAULT 'OPEN',

    CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_invitations_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_invitations_createdByUserId_fkey"
        FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "user_invitations_tokenHash_key"
    ON "user_invitations"("tokenHash");
CREATE UNIQUE INDEX "user_invitations_tenantId_email_openKey_key"
    ON "user_invitations"("tenantId", "email", "openKey");
CREATE INDEX "user_invitations_tenantId_openKey_createdAt_idx"
    ON "user_invitations"("tenantId", "openKey", "createdAt");
CREATE INDEX "user_invitations_expiresAt_acceptedAt_revokedAt_idx"
    ON "user_invitations"("expiresAt", "acceptedAt", "revokedAt");
