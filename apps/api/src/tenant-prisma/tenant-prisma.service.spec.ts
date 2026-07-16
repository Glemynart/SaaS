import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantPrismaService } from './tenant-prisma.service';

describe('TenantPrismaService', () => {
  const tenantContext = {
    tenantId: 'tenant-a',
    userId: 'user-a',
    rol: 'ADMIN',
    email: 'admin@example.com',
  };

  const executeRaw = jest.fn();
  const transaction = jest.fn();
  const requireTenantContext = jest.fn();
  const client = { $executeRaw: executeRaw };

  let service: TenantPrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    requireTenantContext.mockReturnValue(tenantContext);
    executeRaw.mockResolvedValue(undefined);
    transaction.mockImplementation(
      (work: (transactionClient: typeof client) => unknown) =>
        Promise.resolve(work(client)),
    );
    service = new TenantPrismaService(
      { $transaction: transaction } as unknown as PrismaService,
      { require: requireTenantContext } as unknown as TenantContextBoundary,
    );
  });

  it('installs the tenant before running tenant-aware data work', async () => {
    const work = jest.fn().mockResolvedValue('result');

    await expect(service.execute(work)).resolves.toBe('result');

    expect(requireTenantContext).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith(client, tenantContext);
    expect(executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      work.mock.invocationCallOrder[0],
    );
  });

  it('does not execute data work when no tenant context exists', async () => {
    const work = jest.fn();
    requireTenantContext.mockImplementation(() => {
      throw new ForbiddenException();
    });

    await expect(service.execute(work)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(transaction).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
    expect(work).not.toHaveBeenCalled();
  });

  it('reuses the active transaction and tenant context for nested work', async () => {
    const outerClient = client;
    const nestedWork = jest.fn().mockResolvedValue('nested');

    const result = await service.execute(async (transactionClient, context) => {
      expect(transactionClient).toBe(outerClient);
      expect(context).toBe(tenantContext);
      return service.execute(nestedWork);
    });

    expect(result).toBe('nested');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(requireTenantContext).toHaveBeenCalledTimes(1);
    expect(nestedWork).toHaveBeenCalledWith(outerClient, tenantContext);
  });

  it('creates a new transaction after tenant-aware work has completed', async () => {
    await service.execute(jest.fn().mockResolvedValue(undefined));
    await service.execute(jest.fn().mockResolvedValue(undefined));

    expect(transaction).toHaveBeenCalledTimes(2);
    expect(executeRaw).toHaveBeenCalledTimes(2);
    expect(requireTenantContext).toHaveBeenCalledTimes(2);
  });
});
