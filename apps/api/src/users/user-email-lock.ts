import type { Prisma } from '@prisma/client';

/**
 * Serializes user creation, invitation acceptance, and email changes for one
 * tenant/email pair so checks across the users and user_invitations tables
 * cannot race each other.
 */
export async function lockTenantUserEmailIdentity(
  tx: Prisma.TransactionClient,
  tenantId: string,
  email: string,
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${tenantId}),
      hashtext(${email})
    )
  `;
}
