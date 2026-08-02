import {
  AlertGenerationRunStatus,
  AlertGenerationRunTenantStatus,
  Prisma,
} from '@prisma/client';
import { AlertsSchedulerService } from './alerts-scheduler.service';

describe('AlertsSchedulerService', () => {
  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';
  const runId = 'run-1';
  const run = {
    id: runId,
    status: AlertGenerationRunStatus.RUNNING,
    tenantsProcessed: 0,
    tenantsFailed: 0,
    contractAlertsCreated: 0,
    missingDocAlertsCreated: 0,
  };

  const transaction = jest.fn();
  const findManyTenants = jest.fn();
  const staleRuns = jest.fn();
  const deleteExpiredRuns = jest.fn();
  const createRun = jest.fn();
  const createRunTenants = jest.fn();
  const updateRunTenant = jest.fn();
  const findRunTenants = jest.fn();
  const updateRun = jest.fn();
  const executeRaw = jest.fn();
  const generateForTenant = jest.fn();
  const auditLog = jest.fn();
  const findFailedRunTenant = jest.fn();
  const tenantContextRun = jest.fn((_: unknown, callback: () => unknown) =>
    callback(),
  );
  let currentRun: {
    id: string;
    status: AlertGenerationRunStatus;
    tenantsProcessed: number;
    tenantsFailed: number;
    contractAlertsCreated: number;
    missingDocAlertsCreated: number;
  } = {
    ...run,
    status: run.status,
  };

  const tx = {
    $executeRaw: executeRaw,
    tenant: { findMany: findManyTenants },
    alertGenerationRun: {
      findMany: staleRuns,
      deleteMany: deleteExpiredRuns,
      create: createRun,
      update: updateRun,
    },
    alertGenerationRunTenant: {
      createMany: createRunTenants,
      update: updateRunTenant,
    },
  };

  const prisma = {
    $transaction: transaction,
    alertGenerationRun: {
      create: createRun,
      update: updateRun,
    },
    alertGenerationRunTenant: {
      findFirst: findFailedRunTenant,
      findMany: findRunTenants,
      update: updateRunTenant,
    },
  };

  const service = new AlertsSchedulerService(
    prisma as never,
    { generateForTenant } as never,
    { run: tenantContextRun } as never,
    { log: auditLog } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
    findManyTenants.mockResolvedValue([{ id: tenantA }, { id: tenantB }]);
    staleRuns.mockResolvedValue([]);
    deleteExpiredRuns.mockResolvedValue({ count: 0 });
    createRun.mockResolvedValue({ ...run });
    currentRun = {
      ...run,
      status: run.status,
    };
    createRunTenants.mockResolvedValue({ count: 2 });
    updateRunTenant.mockResolvedValue({});
    updateRun.mockImplementation(
      (args: {
        data?: {
          status?: AlertGenerationRunStatus;
          tenantsProcessed?: { increment: number };
          tenantsFailed?: { increment: number };
          contractAlertsCreated?: { increment: number };
          missingDocAlertsCreated?: { increment: number };
        };
      }) => {
        const data = args.data;
        if (data?.status) currentRun.status = data.status;
        if (data?.tenantsProcessed) {
          currentRun.tenantsProcessed += data.tenantsProcessed.increment;
        }
        if (data?.tenantsFailed) {
          currentRun.tenantsFailed += data.tenantsFailed.increment;
        }
        if (data?.contractAlertsCreated) {
          currentRun.contractAlertsCreated +=
            data.contractAlertsCreated.increment;
        }
        if (data?.missingDocAlertsCreated) {
          currentRun.missingDocAlertsCreated +=
            data.missingDocAlertsCreated.increment;
        }
        return Promise.resolve({ ...currentRun });
      },
    );
    findRunTenants.mockResolvedValue([
      { status: AlertGenerationRunTenantStatus.SUCCEEDED },
      { status: AlertGenerationRunTenantStatus.SUCCEEDED },
    ]);
    findFailedRunTenant.mockResolvedValue({ id: 'failed-result' });
    executeRaw.mockResolvedValue(0);
    generateForTenant.mockResolvedValue({
      contractAlerts: { created: 2 },
      missingDocAlerts: { created: 1 },
    });
    auditLog.mockResolvedValue({});
  });

  it('isolates tenants and completes a successful run', async () => {
    const result = await service.runDailyGeneration();

    expect(result).toEqual({
      runId,
      status: AlertGenerationRunStatus.SUCCEEDED,
      skipped: false,
      tenantsProcessed: 2,
      tenantsFailed: 0,
      contractAlertsCreated: 4,
      missingDocAlertsCreated: 2,
    });
    expect(createRunTenants).toHaveBeenCalledWith({
      data: [
        { runId, tenantId: tenantA },
        { runId, tenantId: tenantB },
      ],
    });
    expect(generateForTenant).toHaveBeenCalledTimes(2);
    expect(generateForTenant).toHaveBeenNthCalledWith(
      1,
      tenantA,
      expect.anything(),
    );
    expect(generateForTenant).toHaveBeenNthCalledWith(
      2,
      tenantB,
      expect.anything(),
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ALERT_GENERATION_STARTED' }),
      expect.anything(),
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ALERT_GENERATION_FINISHED' }),
      expect.anything(),
    );
  });

  it('retries a failed tenant once and preserves the other tenant result', async () => {
    generateForTenant
      .mockResolvedValueOnce({
        contractAlerts: { created: 2 },
        missingDocAlerts: { created: 1 },
      })
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockRejectedValueOnce(new Error('permanent failure'));
    findRunTenants.mockResolvedValue([
      { status: AlertGenerationRunTenantStatus.SUCCEEDED },
      { status: AlertGenerationRunTenantStatus.FAILED },
    ]);

    const result = await service.runDailyGeneration();

    expect(generateForTenant).toHaveBeenCalledTimes(3);
    expect(result.status).toBe(AlertGenerationRunStatus.PARTIAL);
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ALERT_GENERATION_RETRIED' }),
      expect.anything(),
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ALERT_GENERATION_TENANT_FAILED' }),
      expect.anything(),
    );
    expect(updateRunTenant).toHaveBeenCalled();
  });

  it('records a skipped run when PostgreSQL rejects a concurrent RUNNING claim', async () => {
    createRun
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('conflict', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      )
      .mockResolvedValueOnce({
        ...run,
        status: AlertGenerationRunStatus.SKIPPED,
      });

    const result = await service.runDailyGeneration();

    expect(result).toEqual({
      runId,
      status: AlertGenerationRunStatus.SKIPPED,
      skipped: true,
      tenantsProcessed: 0,
      tenantsFailed: 0,
      contractAlertsCreated: 0,
      missingDocAlertsCreated: 0,
    });
    expect(generateForTenant).not.toHaveBeenCalled();
  });

  it('starts an explicit retry for only the failed tenant', async () => {
    findManyTenants.mockResolvedValue([{ id: tenantB }]);

    const result = await service.retryFailedTenant(
      tenantB,
      'failed-run',
      'admin-1',
    );

    expect(result.status).toBe(AlertGenerationRunStatus.SUCCEEDED);
    expect(createRun).toHaveBeenCalled();
    expect(createRunTenants).toHaveBeenCalledWith({
      data: [{ runId, tenantId: tenantB }],
    });
    expect(generateForTenant).toHaveBeenCalledTimes(1);
    expect(generateForTenant).toHaveBeenNthCalledWith(
      1,
      tenantB,
      expect.anything(),
    );
  });
});
