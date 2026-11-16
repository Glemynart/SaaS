import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { AuditService } from './audit.service';
import { SYSTEM_AUDIT_ACTORS } from './audit-actor';

describe('AuditService', () => {
  const tenantContext = new TenantContextService();
  const queryRaw = jest.fn();
  const executeRaw = jest.fn();
  const create = jest.fn<
    Promise<unknown>,
    [{ data: Record<string, unknown> }]
  >();
  const client = {
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
    auditLog: { create },
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'human-user-a' }) },
  } as unknown as Prisma.TransactionClient;
  const prismaTransaction = jest.fn(
    (work: (transaction: Prisma.TransactionClient) => Promise<unknown>) =>
      work(client),
  );
  const tenantExecute = jest.fn(
    (work: (transaction: Prisma.TransactionClient) => Promise<unknown>) =>
      work(client),
  );
  const service = new AuditService(
    { $transaction: prismaTransaction } as unknown as PrismaService,
    { execute: tenantExecute } as unknown as TenantPrismaService,
    tenantContext,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    queryRaw.mockResolvedValue([{ tenantId: null }]);
    executeRaw.mockResolvedValue(1);
    create.mockImplementation(({ data }: { data: unknown }) =>
      Promise.resolve(data),
    );
  });

  it('keeps existing userId callers as human actors and installs transaction scope', async () => {
    await service.log({
      tenantId: 'tenant-a',
      userId: 'human-user-a',
      action: 'EMPLOYEE_UPDATED',
      entityType: 'Employee',
    });

    expect(prismaTransaction).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const [call] = create.mock.calls;
    expect(call?.[0].data).toMatchObject({
      tenantId: 'tenant-a',
      actorId: 'human-user-a',
      actorKind: 'HUMAN',
    });
  });

  it('persists an allowlisted system actor explicitly', async () => {
    await service.log({
      tenantId: 'tenant-a',
      actor: { kind: 'SYSTEM', id: SYSTEM_AUDIT_ACTORS.ALERTS_SCHEDULER },
      action: 'ALERT_GENERATION_STARTED',
      entityType: 'AlertGenerationRun',
    });

    const [call] = create.mock.calls;
    expect(call?.[0].data).toMatchObject({
      actorId: 'system:alerts-scheduler',
      actorKind: 'SYSTEM',
    });
  });

  it('reuses an already matching transaction tenant without resetting it', async () => {
    queryRaw.mockResolvedValueOnce([{ tenantId: 'tenant-a' }]);
    const tx = client;

    await service.log(
      {
        tenantId: 'tenant-a',
        userId: 'human-user-a',
        action: 'PAYROLL_APPROVED',
        entityType: 'PayrollPeriod',
      },
      tx,
    );

    expect(prismaTransaction).not.toHaveBeenCalled();
    expect(tenantExecute).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('rejects a tenant mismatch in an existing transaction', async () => {
    queryRaw.mockResolvedValueOnce([{ tenantId: 'tenant-a' }]);

    await expect(
      service.log(
        {
          tenantId: 'tenant-b',
          userId: 'human-user-b',
          action: 'PAYROLL_APPROVED',
          entityType: 'PayrollPeriod',
        },
        client,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(create).not.toHaveBeenCalled();
  });

  it('uses the active tenant transaction and rejects a mismatched human actor', async () => {
    const context = {
      tenantId: 'tenant-a',
      userId: 'human-user-a',
      rol: 'ADMIN',
      email: 'admin@example.test',
    } as const;

    await expect(
      tenantContext.run(context, () =>
        service.log({
          tenantId: 'tenant-a',
          userId: 'human-user-b',
          action: 'USER_UPDATED',
          entityType: 'User',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(tenantExecute).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects system identities that are not registered', async () => {
    await expect(
      service.log({
        tenantId: 'tenant-a',
        actor: { kind: 'SYSTEM', id: 'system:unregistered-worker' as never },
        action: 'INTERNAL_EVENT',
        entityType: 'Worker',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaTransaction).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated human actor that does not belong to the tenant', async () => {
    const findActor = jest.fn().mockResolvedValue(null);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ tenantId: null }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: { findFirst: findActor },
      auditLog: { create },
    } as unknown as Prisma.TransactionClient;
    const transaction = jest.fn(
      (work: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        work(tx),
    );
    const serviceWithoutContext = new AuditService(
      { $transaction: transaction } as unknown as PrismaService,
      { execute: tenantExecute } as unknown as TenantPrismaService,
      tenantContext,
    );

    await expect(
      serviceWithoutContext.log({
        tenantId: 'tenant-a',
        userId: 'unknown-human',
        action: 'UNAUTHENTICATED_EVENT',
        entityType: 'Auth',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(findActor).toHaveBeenCalledWith({
      where: { id: 'unknown-human', tenantId: 'tenant-a' },
      select: { id: true },
    });
    expect(create).not.toHaveBeenCalled();
  });
});
