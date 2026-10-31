import { ServicePremiumService } from './service-premium.service';

describe('ServicePremiumService background worker', () => {
  it('genera y publica el PDF fuera de la petición del navegador', async () => {
    const batchFindFirst = jest.fn();
    const batchUpdates: Array<{ data: { status?: string } }> = [];
    const batchUpdateMany = jest.fn((args: { data: { status?: string } }) => {
      batchUpdates.push(args);
      return Promise.resolve({ count: 1 });
    });
    const lineUpdateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValue({ count: 1 });
    const lineGroupBy = jest
      .fn()
      .mockResolvedValue([{ status: 'DOCUMENTADA', _count: { _all: 1 } }]);
    const transaction = {
      servicePremiumBatch: {
        findFirst: batchFindFirst,
        updateMany: batchUpdateMany,
      },
      servicePremiumLine: {
        updateMany: lineUpdateMany,
        groupBy: lineGroupBy,
      },
    };
    const tenantExecute = jest.fn((work: (tx: typeof transaction) => unknown) =>
      work(transaction),
    );
    const pdf = Buffer.from('synthetic-pdf');
    const renderPdf = jest.fn().mockResolvedValue(pdf);
    const putObject = jest.fn().mockResolvedValue(undefined);
    const publishServicePremiumDocument = jest
      .fn()
      .mockResolvedValue({ outcome: 'CREATED', expedienteDocId: 'document-1' });
    const batch = {
      id: 'batch-1',
      anio: 2026,
      semestre: 1,
      version: 1,
      status: 'PROCESANDO',
      approvedById: 'approver-1',
      createdById: 'creator-1',
      lines: [
        {
          id: 'line-1',
          snapshot: {
            employee: { fullName: 'Ana Demo', identification: '1001' },
            sourceSnapshotIds: ['snapshot-1'],
          },
          salaryBase: 2_000_000,
          variableSalary: 0,
          transportAllowance: 200_000,
          serviceDays360: 180,
          amount: 1_100_000,
          sourceFingerprint: 'fingerprint-1',
          employee: {
            id: 'employee-1',
            primerNombre: 'Ana',
            segundoNombre: null,
            primerApellido: 'Demo',
            segundoApellido: null,
            cedula: '1001',
          },
        },
      ],
    };
    batchFindFirst
      .mockResolvedValueOnce({ id: 'batch-1' })
      .mockResolvedValueOnce(batch);

    const service = new ServicePremiumService(
      {
        tenant: { findMany: jest.fn().mockResolvedValue([{ id: 'tenant-1' }]) },
      } as never,
      { execute: tenantExecute } as never,
      {
        run: (_context: unknown, work: () => Promise<void>) => work(),
      } as never,
      { log: jest.fn() } as never,
      { renderPdf } as never,
      {
        objectExists: jest.fn().mockResolvedValue(false),
        putObject,
      } as never,
      { publishServicePremiumDocument } as never,
    );

    await service.processApprovedBatches();

    expect(renderPdf).toHaveBeenCalledTimes(1);
    expect(putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'tenant-1/nomina/prima/2026/S1/v1/line-1.pdf',
        body: pdf,
        contentType: 'application/pdf',
      }),
    );
    expect(publishServicePremiumDocument).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', lineId: 'line-1' }),
    );
    expect(batchUpdates.at(-1)?.data.status).toBe('COMPLETADO');
  });
});
