import { TenantPrismaClient } from '../tenant-prisma/tenant-prisma.service';

/**
 * Serializa durante una transacción las operaciones que cambian u observan la
 * contabilización de una corrección de nómina. El bloqueo es por tenant y por
 * corrección, se libera al confirmar o revertir la transacción y no requiere
 * estado persistente adicional.
 */
export async function lockPayrollCorrectionDependencies(
  tx: TenantPrismaClient,
  tenantId: string,
  correctionIds: string[],
): Promise<void> {
  const orderedIds = [...new Set(correctionIds)].sort();

  for (const correctionId of orderedIds) {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext(${tenantId}),
        hashtext(${correctionId})
      )
    `;
  }
}
