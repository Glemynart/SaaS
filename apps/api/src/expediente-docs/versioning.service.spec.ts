import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { ExpedienteDocsService } from './expediente-docs.service';

describe('ExpedienteDocsService document history and download', () => {
  const documentFindFirst = jest.fn();
  const familyFindFirst = jest.fn();
  const documentFindMany = jest.fn();
  const getObject = jest.fn();
  const auditLog = jest.fn();

  let service: ExpedienteDocsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    auditLog.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExpedienteDocsService,
        {
          provide: PrismaService,
          useValue: {
            expedienteDoc: {
              findFirst: documentFindFirst,
              findMany: documentFindMany,
            },
            expedienteDocFamily: { findFirst: familyFindFirst },
          },
        },
        { provide: TenantPrismaService, useValue: {} },
        { provide: AuditService, useValue: { log: auditLog } },
        { provide: StorageService, useValue: { getObject } },
      ],
    }).compile();

    service = moduleRef.get(ExpedienteDocsService);
  });

  it('returns every revision for the tenant-scoped document family', async () => {
    documentFindFirst.mockResolvedValue({
      familiaId: 'family-001',
      empleadoId: 'employee-001',
    });
    familyFindFirst.mockResolvedValue({
      id: 'family-001',
      tenantId: 'tenant-001',
      empleadoId: 'employee-001',
      categoria: 'DOCUMENTO_PERSONAL',
      nombre: 'cedula.pdf',
      descripcion: null,
    });
    documentFindMany.mockResolvedValue([
      { id: 'doc-002', version: 2, vigente: true },
      { id: 'doc-001', version: 1, vigente: false },
    ]);

    await expect(service.findHistory('tenant-001', 'doc-002')).resolves.toEqual(
      {
        family: {
          id: 'family-001',
          tenantId: 'tenant-001',
          empleadoId: 'employee-001',
          categoria: 'DOCUMENTO_PERSONAL',
          nombre: 'cedula.pdf',
          descripcion: null,
        },
        revisions: [
          { id: 'doc-002', version: 2, vigente: true },
          { id: 'doc-001', version: 1, vigente: false },
        ],
      },
    );

    expect(documentFindFirst).toHaveBeenCalledWith({
      where: { id: 'doc-002', tenantId: 'tenant-001' },
      select: { familiaId: true, empleadoId: true },
    });
    expect(familyFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'family-001',
        tenantId: 'tenant-001',
        empleadoId: 'employee-001',
      },
      select: {
        id: true,
        tenantId: true,
        empleadoId: true,
        categoria: true,
        nombre: true,
        descripcion: true,
      },
    });
    expect(documentFindMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-001', familiaId: 'family-001' },
      orderBy: { version: 'desc' },
      include: {
        generatedDocument: {
          select: { id: true, nombre: true, tipo: true },
        },
      },
    });
  });

  it('does not expose a family from another tenant', async () => {
    documentFindFirst.mockResolvedValue(null);

    await expect(
      service.findHistory('tenant-otro', 'doc-002'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(familyFindFirst).not.toHaveBeenCalled();
    expect(documentFindMany).not.toHaveBeenCalled();
  });

  it('downloads the stored revision using the tenant-scoped document key', async () => {
    documentFindFirst.mockResolvedValue({
      id: 'doc-002',
      nombre: 'cedula-actualizada.pdf',
      mimeType: 'application/pdf',
      storageKey: 'tenant-001/expediente/employee-001/family-001_v2.pdf',
      familiaId: 'family-001',
      version: 2,
      categoria: 'DOCUMENTO_PERSONAL',
      generatedDocumentId: null,
      contratoId: null,
    });
    getObject.mockResolvedValue(Buffer.from('%PDF-1.7'));

    await expect(
      service.download('tenant-001', 'user-001', 'doc-002'),
    ).resolves.toEqual({
      nombre: 'cedula-actualizada.pdf',
      mimeType: 'application/pdf',
      body: Buffer.from('%PDF-1.7'),
    });
    expect(getObject).toHaveBeenCalledWith(
      'tenant-001/expediente/employee-001/family-001_v2.pdf',
    );
    expect(auditLog).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      userId: 'user-001',
      action: 'EXPEDIENTE_DOCUMENT_ACCESS_GRANTED',
      entityType: 'ExpedienteDoc',
      entityId: 'doc-002',
      metadata: {
        delivery: 'DOWNLOAD',
        familiaId: 'family-001',
        version: 2,
        categoria: 'DOCUMENTO_PERSONAL',
        generatedDocumentId: null,
        contratoId: null,
      },
    });
  });
});
