import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantExecutionContext } from '../tenant-context/tenant-context.types';

export type TenantPrismaClient = Prisma.TransactionClient;

interface ActiveTenantTransaction {
  readonly client: TenantPrismaClient;
  readonly context: TenantExecutionContext;
}

/**
 * Única frontera de datos tenant-aware.
 *
 * Abre una transacción Prisma, instala el tenant como configuración local de
 * PostgreSQL y entrega exclusivamente el cliente transaccional al trabajo.
 */
@Injectable()
export class TenantPrismaService {
  private readonly transactions =
    new AsyncLocalStorage<ActiveTenantTransaction>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextBoundary,
  ) {}

  async execute<T>(
    work: (
      client: TenantPrismaClient,
      context: TenantExecutionContext,
    ) => Promise<T>,
  ): Promise<T> {
    const active = this.transactions.getStore();
    if (active) {
      return work(active.client, active.context);
    }

    const context = this.tenantContext.require();

    return this.prisma.$transaction(async (client) => {
      await client.$executeRaw`
        SELECT set_config('app.current_tenant_id', ${context.tenantId}, true)
      `;

      return this.transactions.run(Object.freeze({ client, context }), () =>
        work(client, context),
      );
    });
  }
}
