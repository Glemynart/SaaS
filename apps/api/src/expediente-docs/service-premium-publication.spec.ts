import { ExpedienteDocsService } from './expediente-docs.service';
import { SYSTEM_AUDIT_ACTORS } from '../audit/audit-actor';

describe('ExpedienteDocsService prima de servicios publication', () => {
  const lineFindFirst = jest.fn();
  const lineUpdateMany = jest.fn();
  const lineUpdate = jest.fn();
  const documentFindFirst = jest.fn();
  const documentCreate = jest.fn();
  const documentCreateInputs: Array<{ data: Record<string, unknown> }> = [];
  const lineUpdateInputs: Array<{ data: Record<string, unknown> }> = [];
  const familyCreate = jest.fn();
  const auditLog = jest.fn();
  const transaction = {
    servicePremiumLine: {
      findFirst: lineFindFirst,
      updateMany: lineUpdateMany,
      update: lineUpdate,
    },
    expedienteDoc: { findFirst: documentFindFirst, create: documentCreate },
    expedienteDocFamily: { create: familyCreate },
  };
  const tenantExecute = jest.fn((work: (tx: typeof transaction) => unknown) =>
    work(transaction),
  );
  const service = new ExpedienteDocsService(
    { execute: tenantExecute } as never,
    { log: auditLog } as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    documentCreateInputs.length = 0;
    lineUpdateInputs.length = 0;
    tenantExecute.mockImplementation((work) => work(transaction));
    lineFindFirst.mockResolvedValue({
      id: 'line-a',
      employeeId: 'employee-a',
      batchId: 'batch-a',
      amount: 1_100_000,
      serviceDays360: 180,
      sourceFingerprint: 'abc123',
      status: 'PROCESANDO',
      documentStorageKey: null,
      documentSizeBytes: null,
      documentSha256: null,
      batch: { anio: 2026, semestre: 1, version: 1, status: 'PROCESANDO' },
    });
    documentFindFirst.mockResolvedValue(null);
    familyCreate.mockResolvedValue({ id: 'family-a' });
    documentCreate.mockImplementation(
      (args: { data: Record<string, unknown> }) => {
        documentCreateInputs.push(args);
        return Promise.resolve({ id: 'document-a' });
      },
    );
    lineUpdate.mockImplementation((args: { data: Record<string, unknown> }) => {
      lineUpdateInputs.push(args);
      return Promise.resolve({ id: 'line-a', status: 'DOCUMENTADA' });
    });
    lineUpdateMany.mockResolvedValue({ count: 1 });
    auditLog.mockResolvedValue(undefined);
  });

  it('publica el PDF en la categoría de prima con hash y tenant filtrado', async () => {
    const result = await service.publishServicePremiumDocument({
      tenantId: 'tenant-a',
      actor: {
        kind: 'SYSTEM',
        id: SYSTEM_AUDIT_ACTORS.SERVICE_PREMIUM_WORKER,
      },
      lineId: 'line-a',
      storageKey: 'tenant-a/nomina/prima/2026/S1/v1/line-a.pdf',
      sizeBytes: 1024,
      sha256: 'pdf-sha256',
    });

    expect(result).toEqual({
      outcome: 'CREATED',
      expedienteDocId: 'document-a',
    });
    expect(lineFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'line-a', tenantId: 'tenant-a' },
      }),
    );
    expect(documentCreateInputs[0]?.data).toMatchObject({
      tenantId: 'tenant-a',
      empleadoId: 'employee-a',
      servicePremiumLineId: 'line-a',
      categoria: 'PRIMA_SERVICIOS',
      subidoPorId: SYSTEM_AUDIT_ACTORS.SERVICE_PREMIUM_WORKER,
    });
    expect(lineUpdateInputs[0]?.data).toMatchObject({
      status: 'DOCUMENTADA',
      documentSha256: 'pdf-sha256',
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        actor: {
          kind: 'SYSTEM',
          id: SYSTEM_AUDIT_ACTORS.SERVICE_PREMIUM_WORKER,
        },
        action: 'SERVICE_PREMIUM_DOCUMENT_PUBLISHED',
      }),
      transaction,
    );
  });

  it('devuelve el documento existente al reintentar y no duplica la publicación', async () => {
    documentFindFirst.mockResolvedValue({
      id: 'document-existing',
      storageKey: 'tenant-a/nomina/prima/2026/S1/v1/line-a.pdf',
      tamanoBytes: 1024,
    });
    const result = await service.publishServicePremiumDocument({
      tenantId: 'tenant-a',
      actor: {
        kind: 'SYSTEM',
        id: SYSTEM_AUDIT_ACTORS.SERVICE_PREMIUM_WORKER,
      },
      lineId: 'line-a',
      storageKey: 'tenant-a/nomina/prima/2026/S1/v1/line-a.pdf',
      sizeBytes: 1024,
      sha256: 'pdf-sha256',
    });
    expect(result).toEqual({
      outcome: 'EXISTING',
      expedienteDocId: 'document-existing',
    });
    expect(documentCreate).not.toHaveBeenCalled();
    expect(familyCreate).not.toHaveBeenCalled();
  });

  it('rechaza claves de almacenamiento de otra empresa antes de publicar', async () => {
    await expect(
      service.publishServicePremiumDocument({
        tenantId: 'tenant-a',
        actor: {
          kind: 'SYSTEM',
          id: SYSTEM_AUDIT_ACTORS.SERVICE_PREMIUM_WORKER,
        },
        lineId: 'line-a',
        storageKey: 'tenant-b/nomina/prima/2026/S1/v1/line-b.pdf',
        sizeBytes: 1024,
        sha256: 'pdf-sha256',
      }),
    ).rejects.toThrow('La clave del PDF no corresponde');

    expect(documentFindFirst).not.toHaveBeenCalled();
    expect(documentCreate).not.toHaveBeenCalled();
    expect(familyCreate).not.toHaveBeenCalled();
    expect(lineUpdate).not.toHaveBeenCalled();
  });
});
