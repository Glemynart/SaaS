import { TenantPrismaClient } from '../tenant-prisma/tenant-prisma.service';

/**
 * Serializa dentro de una transacción los cambios de estado y los posteos de
 * un período contable. El bloqueo se libera al confirmar o revertir la
 * transacción y no requiere estado persistente adicional.
 */
export async function lockAccountingPeriod(
  tx: TenantPrismaClient,
  tenantId: string,
  periodoId: string,
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${tenantId}),
      hashtext(${periodoId})
    )
  `;
}
