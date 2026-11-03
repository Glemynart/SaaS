import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ServicePremiumService } from './service-premium.service';

describe('ServicePremiumService tenant-scoped lifecycle', () => {
  const findBatch = jest.fn();
  const updateBatchMany = jest.fn();
  const batchUpdateInputs: Array<{ where?: unknown; data?: unknown }> = [];
  const findBatchUnique = jest.fn();
  const countLines = jest.fn();
  const updateLinesMany = jest.fn();
  const auditLog = jest.fn();
  const transaction = {
    servicePremiumBatch: {
      findFirst: findBatch,
      updateMany: updateBatchMany,
      findUniqueOrThrow: findBatchUnique,
    },
    servicePremiumLine: {
      count: countLines,
      updateMany: updateLinesMany,
    },
  };
  const tenantExecute = jest.fn((work: (tx: typeof transaction) => unknown) =>
    work(transaction),
  );

  const service = new ServicePremiumService(
    {} as never,
    { execute: tenantExecute } as never,
    {} as never,
    { log: auditLog } as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    batchUpdateInputs.length = 0;
    updateBatchMany.mockImplementation(
      (args: { where?: unknown; data?: unknown }) => {
        batchUpdateInputs.push(args);
        return Promise.resolve({ count: 1 });
      },
    );
    tenantExecute.mockImplementation((work) => work(transaction));
  });

  it('filtra la lectura del lote por el tenant activo', async () => {
    findBatch.mockResolvedValue(null);
    await expect(service.getOne('tenant-a', 'batch-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-a', id: 'batch-1' },
      }),
    );
  });

  it('rechaza julio–diciembre antes de consultar o persistir un lote', async () => {
    await expect(
      service.createPreview('tenant-a', 'user-a', { year: 2026, semester: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tenantExecute).not.toHaveBeenCalled();
  });

  it('no aprueba un lote de otro tenant ni intenta leer sus empleados', async () => {
    findBatch.mockResolvedValue(null);
    await expect(
      service.approve('tenant-b', 'user-b', 'batch-from-tenant-a'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(countLines).not.toHaveBeenCalled();
    expect(updateBatchMany).not.toHaveBeenCalled();
  });

  it('requiere al menos una línea calculable antes de aprobar', async () => {
    findBatch.mockResolvedValue({
      id: 'batch-1',
      status: 'BORRADOR',
      _count: { lines: 3 },
    });
    countLines.mockResolvedValue(0);
    await expect(
      service.approve('tenant-a', 'user-a', 'batch-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(updateBatchMany).not.toHaveBeenCalled();
  });

  it('aprueba solo las líneas LISTA del tenant y deja auditoría', async () => {
    findBatch.mockResolvedValue({
      id: 'batch-1',
      status: 'BORRADOR',
      _count: { lines: 2 },
    });
    countLines.mockResolvedValue(1);
    updateLinesMany.mockResolvedValue({ count: 1 });
    findBatchUnique.mockResolvedValue({ id: 'batch-1', status: 'APROBADO' });
    auditLog.mockResolvedValue(undefined);

    const result = await service.approve('tenant-a', 'user-a', 'batch-1');

    expect(result).toMatchObject({ id: 'batch-1', status: 'APROBADO' });
    expect(batchUpdateInputs[0]?.where).toEqual({
      id: 'batch-1',
      tenantId: 'tenant-a',
      status: 'BORRADOR',
    });
    expect(batchUpdateInputs[0]?.data).toMatchObject({
      status: 'APROBADO',
      approvedById: 'user-a',
    });
    expect(updateLinesMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', batchId: 'batch-1', status: 'LISTA' },
      data: { status: 'APROBADA' },
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', userId: 'user-a' }),
      transaction,
    );
  });

  it('solo reintenta líneas con error dentro del tenant', async () => {
    findBatch.mockResolvedValue({ status: 'COMPLETADO_CON_BLOQUEOS' });
    updateLinesMany.mockResolvedValue({ count: 2 });

    await expect(
      service.retryErrors('tenant-a', 'user-a', 'batch-1'),
    ).resolves.toEqual({
      batchId: 'batch-1',
      retriedLines: 2,
      status: 'APROBADO',
    });
    expect(updateLinesMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', batchId: 'batch-1', status: 'ERROR' },
      data: { status: 'APROBADA', lastErrorCode: null },
    });
    expect(batchUpdateInputs[0]?.where).toMatchObject({
      id: 'batch-1',
      tenantId: 'tenant-a',
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        userId: 'user-a',
        action: 'SERVICE_PREMIUM_DOCUMENTS_RETRY_REQUESTED',
        entityId: 'batch-1',
        metadata: { retriedLines: 2 },
      }),
      transaction,
    );
  });
});
