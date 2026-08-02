import { AlertsSchedulerService } from './alerts-scheduler.service';

describe('AlertsSchedulerService', () => {
  type TransactionClientStub = {
    $queryRaw: typeof queryRaw;
    $executeRaw: typeof executeRaw;
    tenant: { findMany: typeof findMany };
  };

  type GenerationResult = {
    contractAlerts: { created: number };
    missingDocAlerts: { created: number };
  };

  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';
  const generationCalls: Array<[string, TransactionClientStub]> = [];
  const generateForTenant = jest.fn(
    (
      tenantId: string,
      client: TransactionClientStub,
    ): Promise<GenerationResult> => {
      generationCalls.push([tenantId, client]);
      return Promise.resolve({
        contractAlerts: { created: 2 },
        missingDocAlerts: { created: 1 },
      });
    },
  );
  const run = jest.fn((_: unknown, callback: () => unknown) => callback());
  const queryRaw = jest.fn();
  const executeRaw = jest.fn();
  const findMany = jest.fn();
  const transaction = jest.fn();
  const service = new AlertsSchedulerService(
    {
      $transaction: transaction,
    } as never,
    { generateForTenant } as never,
    { run } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    generationCalls.length = 0;
    transaction.mockImplementation(
      (callback: (tx: TransactionClientStub) => unknown) =>
        callback({
          $queryRaw: queryRaw,
          $executeRaw: executeRaw,
          tenant: { findMany },
        }),
    );
    queryRaw.mockResolvedValue([{ locked: true }]);
    executeRaw.mockResolvedValue(0);
    findMany.mockResolvedValue([{ id: tenantA }, { id: tenantB }]);
  });

  it('processes every active tenant in one locked transaction', async () => {
    const result = await service.runDailyGeneration();

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(queryRaw).toHaveBeenCalledWith(expect.anything());
    expect(findMany).toHaveBeenCalledWith({
      where: { activo: true },
      select: { id: true },
    });
    expect(executeRaw).toHaveBeenCalledTimes(2);
    expect(generationCalls.map(([tenantId]) => tenantId)).toEqual([
      tenantA,
      tenantB,
    ]);
    expect(result).toEqual({
      skipped: false,
      tenantsProcessed: 2,
      contractAlertsCreated: 4,
      missingDocAlertsCreated: 2,
    });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does not generate alerts when another scheduler owns the lock', async () => {
    queryRaw.mockResolvedValue([{ locked: false }]);

    const result = await service.runDailyGeneration();

    expect(findMany).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
    expect(generateForTenant).not.toHaveBeenCalled();
    expect(result).toEqual({
      skipped: true,
      tenantsProcessed: 0,
      contractAlertsCreated: 0,
      missingDocAlertsCreated: 0,
    });
  });

  it('keeps the transaction client for tenant-scoped generation', async () => {
    await service.runDailyGeneration();

    const firstCall = generationCalls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) throw new Error('Expected a tenant generation call.');
    const transactionClient = firstCall[1];

    expect(transactionClient.$queryRaw).toBe(queryRaw);
    expect(transactionClient.$executeRaw).toBe(executeRaw);
  });
});
