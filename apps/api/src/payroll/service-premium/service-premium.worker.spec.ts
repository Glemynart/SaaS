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
    const renderedHtmlInputs: string[] = [];
    const renderPdf = jest.fn((html: string) => {
      renderedHtmlInputs.push(html);
      return Promise.resolve(pdf);
    });
    const putObject = jest.fn().mockResolvedValue(undefined);
    const publishServicePremiumDocument = jest
      .fn()
      .mockResolvedValue({ outcome: 'CREATED', expedienteDocId: 'document-1' });
    const batch = {
      id: 'batch-1',
      anio: 2026,
      semestre: 1,
      version: 1,
      formulaVersion: 2,
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
          variableSalary: 10_000,
          transportAllowance: 200_000,
          serviceDays360: 180,
          amount: 1_105_000,
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
    const renderedHtml = renderedHtmlInputs.at(0) ?? '';
    expect(renderedHtml).toContain('Ana Demo');
    expect(renderedHtml).toContain('1001');
    expect(renderedHtml).toContain('2.000.000');
    expect(renderedHtml).toContain('10.000');
    expect(renderedHtml).toContain('200.000');
    expect(renderedHtml).toContain('180');
    expect(renderedHtml).toContain('1.105.000');
    expect(renderedHtml).toContain('PRIMA_SEMESTRAL_V2');
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

  it('recupera un lote expirado reutilizando el PDF guardado tras reiniciar la API', async () => {
    const batchFindFirst = jest.fn();
    const batchUpdates: Array<{ data: { status?: string } }> = [];
    const batchUpdateMany = jest.fn((args: { data: { status?: string } }) => {
      batchUpdates.push(args);
      return Promise.resolve({ count: 1 });
    });
    const lineTransitions: Array<{ where: unknown; data: unknown }> = [];
    const lineUpdateMany = jest.fn(
      (args: { where: unknown; data: unknown }) => {
        lineTransitions.push(args);
        return Promise.resolve({ count: 1 });
      },
    );
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
    const pdf = Buffer.from('previously-rendered-pdf');
    const renderPdf = jest.fn();
    const getObject = jest.fn().mockResolvedValue(pdf);
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
        objectExists: jest.fn().mockResolvedValue(true),
        getObject,
      } as never,
      { publishServicePremiumDocument } as never,
    );

    await service.processApprovedBatches();

    expect(batchFindFirst).toHaveBeenCalledTimes(2);
    expect(lineTransitions[0]).toEqual({
      where: {
        tenantId: 'tenant-1',
        batchId: 'batch-1',
        status: 'PROCESANDO',
      },
      data: { status: 'APROBADA' },
    });
    expect(getObject).toHaveBeenCalledWith(
      'tenant-1/nomina/prima/2026/S1/v1/line-1.pdf',
    );
    expect(renderPdf).not.toHaveBeenCalled();
    expect(publishServicePremiumDocument).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', lineId: 'line-1' }),
    );
    expect(batchUpdates.at(-1)?.data.status).toBe('COMPLETADO');
  });
});
