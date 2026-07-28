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
  const mockExpedienteDocFindFirst = jest.fn();
  const mockExpedienteDocCreate = jest.fn();
  const mockTransaction = jest.fn();
  const mockAuditLog = jest.fn();

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

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGeneratedDocumentFindFirst.mockResolvedValue(makeGeneratedDocument());
    mockExpedienteDocFindFirst.mockResolvedValue(null);
    mockExpedienteDocCreate.mockResolvedValue({ id: 'expediente-001' });
    mockAuditLog.mockResolvedValue(undefined);
    mockTransaction.mockImplementation((work) =>
      work({
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
            generatedDocument: { findFirst: mockGeneratedDocumentFindFirst },
            expedienteDoc: { findFirst: mockExpedienteDocFindFirst },
            $transaction: mockTransaction,
          },
        },
        { provide: TenantPrismaService, useValue: { execute: jest.fn() } },
        { provide: AuditService, useValue: { log: mockAuditLog } },
      ],
    }).compile();

    service = moduleRef.get(ExpedienteDocsService);
  });

  it('crea el índice con la clave y tamaño canónicos dentro de la transacción', async () => {
    const result = await service.publishGeneratedDocument(
      tenantId,
      userId,
      generatedDocumentId,
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

  it('devuelve el índice existente sin crear ni auditar otra publicación', async () => {
    mockExpedienteDocFindFirst.mockResolvedValue({ id: 'expediente-existing' });

    await expect(
      service.publishGeneratedDocument(tenantId, userId, generatedDocumentId),
    ).resolves.toEqual({
      outcome: 'EXISTING',
      expedienteDocId: 'expediente-existing',
      generatedDocumentId,
    });

    expect(mockExpedienteDocCreate).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('bloquea la publicación si el PDF aún no está materializado', async () => {
    mockGeneratedDocumentFindFirst.mockResolvedValue(
      makeGeneratedDocument({ pdfStorageKey: null }),
    );

    await expect(
      service.publishGeneratedDocument(tenantId, userId, generatedDocumentId),
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
      service.publishGeneratedDocument(tenantId, userId, generatedDocumentId),
    ).resolves.toEqual({
      outcome: 'EXISTING',
      expedienteDocId: 'expediente-concurrent',
      generatedDocumentId,
    });

    expect(mockAuditLog).not.toHaveBeenCalled();
  });
});
