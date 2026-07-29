import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { ExpedienteDocsService } from './expediente-docs.service';

describe('ExpedienteDocsService.publishGeneratedDocument', () => {
  let service: ExpedienteDocsService;

  const mockGeneratedDocumentFindFirst = jest.fn();
  const mockGeneratedDocumentUpdate = jest.fn();
  const mockExpedienteDocFindFirst = jest.fn();
  const mockExpedienteDocCreate = jest.fn();
  const mockExpedienteDocDelete = jest.fn();
  const mockTransaction = jest.fn();
  const mockAuditLog = jest.fn();
  const mockTenantPrismaExecute = jest.fn();

  const tenantId = 'tenant-001';
  const userId = 'user-001';
  const generatedDocumentId = 'generated-document-001';

  function makeGeneratedDocument(overrides: Record<string, unknown> = {}) {
    return {
      id: generatedDocumentId,
      tenantId,
      employeeId: 'employee-001',
      contratoId: 'contract-001',
      nombre: 'Contrato — María García',
      tipo: 'CONTRACT',
      pdfStorageKey: 'pdfs/tenant-001-generated-document-001.pdf',
      pdfSizeBytes: 1234,
      pdfUrl: '/uploads/pdfs/tenant-001-generated-document-001.pdf',
      ...overrides,
    };
  }

  function makeMaterialization(overrides: Record<string, unknown> = {}) {
    return {
      id: generatedDocumentId,
      pdfStorageKey: 'pdfs/tenant-001-generated-document-001.pdf',
      pdfSizeBytes: 1234,
      pdfUrl: '/uploads/pdfs/tenant-001-generated-document-001.pdf',
      materialized: false,
      ...overrides,
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGeneratedDocumentFindFirst.mockResolvedValue(makeGeneratedDocument());
    mockGeneratedDocumentUpdate.mockResolvedValue({ id: generatedDocumentId });
    mockExpedienteDocFindFirst.mockResolvedValue(null);
    mockExpedienteDocCreate.mockResolvedValue({ id: 'expediente-001' });
    mockExpedienteDocDelete.mockReset();
    mockTenantPrismaExecute.mockImplementation((work) =>
      work({
        expedienteDoc: { findFirst: mockExpedienteDocFindFirst },
      }),
    );
    mockAuditLog.mockResolvedValue(undefined);
    mockTransaction.mockImplementation((work) =>
      work({
        generatedDocument: { update: mockGeneratedDocumentUpdate },
        expedienteDoc: {
          findFirst: mockExpedienteDocFindFirst,
          create: mockExpedienteDocCreate,
        },
      }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExpedienteDocsService,
        {
          provide: PrismaService,
          useValue: {
            generatedDocument: {
              findFirst: mockGeneratedDocumentFindFirst,
              update: mockGeneratedDocumentUpdate,
            },
            expedienteDoc: {
              findFirst: mockExpedienteDocFindFirst,
              delete: mockExpedienteDocDelete,
            },
            $transaction: mockTransaction,
          },
        },
        {
          provide: TenantPrismaService,
          useValue: { execute: mockTenantPrismaExecute },
        },
        { provide: AuditService, useValue: { log: mockAuditLog } },
      ],
    }).compile();

    service = moduleRef.get(ExpedienteDocsService);
  });

  it('impide eliminar un ExpedienteDoc asociado a CONTRACT publicado', async () => {
    mockExpedienteDocFindFirst.mockResolvedValue({
      id: 'expediente-001',
      generatedDocument: { id: generatedDocumentId, tipo: 'CONTRACT' },
    });

    await expect(service.remove(tenantId, 'expediente-001')).rejects.toThrow(
      'Los documentos CONTRACT publicados son inmutables',
    );

    expect(mockExpedienteDocDelete).not.toHaveBeenCalled();
  });

  it('impide eliminar un ExpedienteDoc asociado a CERTIFICATION publicado', async () => {
    mockExpedienteDocFindFirst.mockResolvedValue({
      id: 'expediente-001',
      generatedDocument: { id: generatedDocumentId, tipo: 'CERTIFICATION' },
    });

    await expect(service.remove(tenantId, 'expediente-001')).rejects.toThrow(
      'Los documentos CERTIFICATION publicados son inmutables',
    );

    expect(mockExpedienteDocDelete).not.toHaveBeenCalled();
  });

  it('mantiene la eliminación para ExpedienteDoc no publicado', async () => {
    mockExpedienteDocFindFirst.mockResolvedValue({
      id: 'expediente-001',
      generatedDocument: { id: generatedDocumentId, tipo: 'LETTER' },
    });
    mockExpedienteDocDelete.mockResolvedValue({ id: 'expediente-001' });

    await expect(service.remove(tenantId, 'expediente-001')).resolves.toEqual({
      id: 'expediente-001',
    });

    expect(mockExpedienteDocDelete).toHaveBeenCalledWith({
      where: { id: 'expediente-001' },
    });
  });

  it('crea el índice con la clave y tamaño canónicos dentro de la transacción', async () => {
    const result = await service.publishGeneratedDocument(
      tenantId,
      userId,
      generatedDocumentId,
      makeMaterialization(),
    );

    expect(mockExpedienteDocCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId,
        empleadoId: 'employee-001',
        contratoId: 'contract-001',
        generatedDocumentId,
        categoria: 'CONTRATO',
        storageKey: 'pdfs/tenant-001-generated-document-001.pdf',
        tamanoBytes: 1234,
      }),
      select: { id: true },
    });
    expect(mockGeneratedDocumentUpdate).toHaveBeenCalledWith({
      where: { id: generatedDocumentId },
      data: {
        pdfStorageKey: 'pdfs/tenant-001-generated-document-001.pdf',
        pdfSizeBytes: 1234,
        pdfUrl: '/uploads/pdfs/tenant-001-generated-document-001.pdf',
        estado: 'MATERIALIZADO',
      },
    });
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CONTRACT_DOCUMENT_PUBLISHED',
        entityId: 'expediente-001',
      }),
      expect.anything(),
    );
    expect(result).toEqual({
      outcome: 'CREATED',
      expedienteDocId: 'expediente-001',
      generatedDocumentId,
    });
  });

  it('publica CERTIFICATION con categoría CERTIFICADO sin requerir contrato', async () => {
    mockGeneratedDocumentFindFirst.mockResolvedValue(
      makeGeneratedDocument({
        contratoId: null,
        nombre: 'Certificación — María García',
        tipo: 'CERTIFICATION',
      }),
    );

    await expect(
      service.publishGeneratedDocument(
        tenantId,
        userId,
        generatedDocumentId,
        makeMaterialization(),
      ),
    ).resolves.toEqual({
      outcome: 'CREATED',
      expedienteDocId: 'expediente-001',
      generatedDocumentId,
    });

    expect(mockExpedienteDocCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contratoId: null,
        categoria: 'CERTIFICADO',
        generatedDocumentId,
        storageKey: 'pdfs/tenant-001-generated-document-001.pdf',
      }),
      select: { id: true },
    });
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CERTIFICATION_DOCUMENT_PUBLISHED',
        entityId: 'expediente-001',
      }),
      expect.anything(),
    );
  });

  it('mantiene el requisito de contrato para publicar CONTRACT', async () => {
    mockGeneratedDocumentFindFirst.mockResolvedValue(
      makeGeneratedDocument({ contratoId: null }),
    );

    await expect(
      service.publishGeneratedDocument(
        tenantId,
        userId,
        generatedDocumentId,
        makeMaterialization(),
      ),
    ).rejects.toThrow('Los documentos CONTRACT requieren un contrato');

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('mantiene fuera de publicación los tipos no aprobados', async () => {
    mockGeneratedDocumentFindFirst.mockResolvedValue(
      makeGeneratedDocument({ contratoId: null, tipo: 'LETTER' }),
    );

    await expect(
      service.publishGeneratedDocument(
        tenantId,
        userId,
        generatedDocumentId,
        makeMaterialization(),
      ),
    ).rejects.toThrow(
      'Solo se pueden publicar documentos CONTRACT o CERTIFICATION',
    );

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('devuelve el índice existente sin crear ni auditar otra publicación', async () => {
    mockExpedienteDocFindFirst.mockResolvedValue({ id: 'expediente-existing' });

    await expect(
      service.publishGeneratedDocument(
        tenantId,
        userId,
        generatedDocumentId,
        makeMaterialization(),
      ),
    ).resolves.toEqual({
      outcome: 'EXISTING',
      expedienteDocId: 'expediente-existing',
      generatedDocumentId,
    });

    expect(mockExpedienteDocCreate).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('bloquea la publicación con metadata de otra materialización', async () => {
    await expect(
      service.publishGeneratedDocument(
        tenantId,
        userId,
        generatedDocumentId,
        makeMaterialization({ id: 'otro-documento' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('mantiene el aislamiento tenant al buscar el documento a publicar', async () => {
    mockGeneratedDocumentFindFirst.mockResolvedValue(null);

    await expect(
      service.publishGeneratedDocument(
        'tenant-otro',
        userId,
        generatedDocumentId,
        makeMaterialization(),
      ),
    ).rejects.toThrow('Documento generado no encontrado');

    expect(mockGeneratedDocumentFindFirst).toHaveBeenCalledWith({
      where: { id: generatedDocumentId, tenantId: 'tenant-otro' },
      select: expect.any(Object),
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('converge al índice ganador si una creación concurrente viola la unicidad', async () => {
    mockExpedienteDocCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['generatedDocumentId'] },
      }),
    );
    mockExpedienteDocFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'expediente-concurrent' });

    await expect(
      service.publishGeneratedDocument(
        tenantId,
        userId,
        generatedDocumentId,
        makeMaterialization(),
      ),
    ).resolves.toEqual({
      outcome: 'EXISTING',
      expedienteDocId: 'expediente-concurrent',
      generatedDocumentId,
    });

    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('revierte metadata e índice si falla la auditoría y publica el mismo PDF al reintentar', async () => {
    const materialization = makeMaterialization();
    type PersistedMetadata = {
      pdfStorageKey: string;
      pdfSizeBytes: number;
      pdfUrl: string;
    };
    let persistedMetadata: PersistedMetadata | null = null;
    let persistedExpediente: { id: string } | null = null;

    mockGeneratedDocumentFindFirst.mockImplementation(async () =>
      makeGeneratedDocument(
        persistedMetadata ?? {
          pdfStorageKey: null,
          pdfSizeBytes: null,
          pdfUrl: null,
        },
      ),
    );
    mockTransaction.mockImplementation(
      async (work: (tx: unknown) => Promise<unknown>) => {
        let stagedMetadata = persistedMetadata;
        let stagedExpediente = persistedExpediente;
        const result = await work({
          generatedDocument: {
            update: async ({ data }: { data: PersistedMetadata }) => {
              stagedMetadata = data;
              return { id: generatedDocumentId };
            },
          },
          expedienteDoc: {
            findFirst: async () => stagedExpediente,
            create: async () => {
              stagedExpediente = { id: 'expediente-001' };
              return stagedExpediente;
            },
          },
        });
        persistedMetadata = stagedMetadata;
        persistedExpediente = stagedExpediente;
        return result;
      },
    );
    mockAuditLog.mockRejectedValueOnce(new Error('Fallo de auditoría'));

    await expect(
      service.publishGeneratedDocument(
        tenantId,
        userId,
        generatedDocumentId,
        materialization,
      ),
    ).rejects.toThrow('Fallo de auditoría');

    expect(persistedMetadata).toBeNull();
    expect(persistedExpediente).toBeNull();

    await expect(
      service.publishGeneratedDocument(
        tenantId,
        userId,
        generatedDocumentId,
        materialization,
      ),
    ).resolves.toEqual({
      outcome: 'CREATED',
      expedienteDocId: 'expediente-001',
      generatedDocumentId,
    });
    await expect(
      service.publishGeneratedDocument(
        tenantId,
        userId,
        generatedDocumentId,
        materialization,
      ),
    ).resolves.toEqual({
      outcome: 'EXISTING',
      expedienteDocId: 'expediente-001',
      generatedDocumentId,
    });

    expect(persistedMetadata).toEqual({
      pdfStorageKey: materialization.pdfStorageKey,
      pdfSizeBytes: materialization.pdfSizeBytes,
      pdfUrl: materialization.pdfUrl,
      estado: 'MATERIALIZADO',
    });
    expect(persistedExpediente).toEqual({ id: 'expediente-001' });
  });
});
