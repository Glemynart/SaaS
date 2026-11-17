import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { AuditService } from './audit.service';
import { SYSTEM_AUDIT_ACTORS } from './audit-actor';

describe('AuditService', () => {
  type QueryRawCall = [strings: TemplateStringsArray, ...values: unknown[]];

  const tenantContext = new TenantContextService();
  const queryRaw = jest.fn<Promise<unknown[]>, QueryRawCall>();
  const executeRaw = jest.fn();
  const findActor = jest.fn().mockResolvedValue({ id: 'human-user-a' });
  const client = {
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
    user: { findFirst: findActor },
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

  const storedEvent = {
    id: 'event-id',
    createdAt: new Date('2026-11-17T00:00:00.000Z'),
    tenantId: 'tenant-a',
    actorId: 'human-user-a',
    actorKind: 'HUMAN',
    action: 'AUDIT_TEST',
    entityType: 'AuditLogTest',
    entityId: null,
    metadata: {},
  };

  function parseEventPayload(payload: unknown): Record<string, unknown> {
    if (typeof payload !== 'string') {
      throw new Error('The AuditLog append payload must be a string.');
    }
    return JSON.parse(payload) as Record<string, unknown>;
  }

  beforeAll(() => {
    process.env.AUDIT_LOG_SIGNING_KEY = Buffer.from(
      'goal02-disposable-audit-signing-key-for-unit-tests',
    ).toString('base64');
    process.env.AUDIT_LOG_SIGNING_KEY_ID = 'unit-test-v1';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    queryRaw.mockImplementation((strings: TemplateStringsArray) => {
      if (strings.join('').includes('pg_current_xact_id')) {
        return Promise.resolve([
          {
            transactionId: '123',
            tenantId: null,
            actorId: null,
            actorType: null,
            rawTenantId: null,
            rawPayload: null,
            rawSignature: null,
          },
        ]);
      }
      return Promise.resolve([storedEvent]);
    });
    executeRaw.mockResolvedValue(1);
    findActor.mockResolvedValue({ id: 'human-user-a' });
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
    const appendCall = queryRaw.mock.calls.find(([strings]) =>
      strings.join('').includes('append_audit_event'),
    );
    expect(appendCall).toBeDefined();
    if (!appendCall) throw new Error('Expected the AuditLog append call.');
    const event = parseEventPayload(appendCall[1]);
    expect(event).toMatchObject({
      tenantId: 'tenant-a',
      actorId: 'human-user-a',
      actorType: 'HUMAN',
      action: 'EMPLOYEE_UPDATED',
    });
    expect(Buffer.isBuffer(appendCall[2])).toBe(true);
    expect(appendCall[3]).toBe('unit-test-v1');
  });

  it('persists an allowlisted system actor explicitly', async () => {
    await service.log({
      tenantId: 'tenant-a',
      actor: { kind: 'SYSTEM', id: SYSTEM_AUDIT_ACTORS.ALERTS_SCHEDULER },
      action: 'ALERT_GENERATION_STARTED',
      entityType: 'AlertGenerationRun',
    });

    const appendCall = queryRaw.mock.calls.find(([strings]) =>
      strings.join('').includes('append_audit_event'),
    );
    expect(appendCall).toBeDefined();
    if (!appendCall) throw new Error('Expected the AuditLog append call.');
    const event = parseEventPayload(appendCall[1]);
    expect(event).toMatchObject({
      actorId: 'system:alerts-scheduler',
      actorType: 'SYSTEM',
    });
  });

  it('reuses a matching signed transaction scope without resetting it', async () => {
    queryRaw.mockResolvedValueOnce([
      {
        transactionId: '123',
        tenantId: 'tenant-a',
        actorId: 'human-user-a',
        actorType: 'HUMAN',
        rawTenantId: 'tenant-a',
        rawPayload: 'signed',
        rawSignature: 'signature',
      },
    ]);
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
    expect(
      queryRaw.mock.calls.some(([strings]) =>
        strings.join('').includes('append_audit_event'),
      ),
    ).toBe(true);
  });

  it('rejects a tenant mismatch in an existing signed transaction', async () => {
    queryRaw.mockResolvedValueOnce([
      {
        transactionId: '123',
        tenantId: 'tenant-a',
        actorId: 'human-user-a',
        actorType: 'HUMAN',
        rawTenantId: 'tenant-a',
        rawPayload: 'signed',
        rawSignature: 'signature',
      },
    ]);

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

    expect(queryRaw).toHaveBeenCalledTimes(1);
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
    expect(queryRaw).not.toHaveBeenCalled();
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
    const txQueryRaw = jest
      .fn<Promise<unknown[]>, QueryRawCall>()
      .mockImplementation((strings: TemplateStringsArray) =>
        strings.join('').includes('pg_current_xact_id')
          ? Promise.resolve([
              {
                transactionId: '123',
                tenantId: null,
                actorId: null,
                actorType: null,
                rawTenantId: null,
                rawPayload: null,
                rawSignature: null,
              },
            ])
          : Promise.resolve([storedEvent]),
      );
    const tx = {
      $queryRaw: txQueryRaw,
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: { findFirst: findActor },
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
    expect(
      txQueryRaw.mock.calls.some(([strings]) =>
        strings.join('').includes('append_audit_event'),
      ),
    ).toBe(false);
  });
});
