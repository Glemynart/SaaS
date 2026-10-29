import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { StorageService } from '../storage/storage.service';
import { GeneratedDocumentAccessService } from './generated-document-access.service';

describe('GeneratedDocumentAccessService', () => {
  const findFirst = jest.fn();
  const execute = jest.fn(
    (
      work: (prisma: {
        generatedDocument: { findFirst: typeof findFirst };
      }) => unknown,
    ) => work({ generatedDocument: { findFirst } }),
  );
  const getObject = jest.fn();
  const auditLog = jest.fn();
  const service = new GeneratedDocumentAccessService(
    { generatedDocument: { findFirst } } as unknown as PrismaService,
    { execute } as unknown as TenantPrismaService,
    { getObject } as unknown as StorageService,
    { log: auditLog } as unknown as AuditService,
  );
  const viewer = {
    userId: 'viewer-001',
    tenantId: 'tenant-001',
    rol: UserRole.VIEWER,
    email: 'viewer@example.com',
  };

  beforeEach(() => {
    findFirst.mockReset();
    getObject.mockReset();
    auditLog.mockReset();
    execute.mockClear();
  });

  it('aplica la política de lectura incluso fuera del controller', async () => {
    await expect(
      service.getMetadata(viewer, 'document-001'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.getDownload(viewer, 'document-001'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(findFirst).not.toHaveBeenCalled();
    expect(getObject).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('traduce la ausencia de metadata del tenant a not found', async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      service.getMetadata(
        { ...viewer, rol: UserRole.OPERADOR },
        'document-001',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('lee la relación employee dentro del contexto tenant', async () => {
    const scopedFindFirst = jest.fn().mockResolvedValue({
      id: 'document-001',
      employeeId: 'employee-001',
      templateId: 'template-001',
      nombre: 'Contrato de prueba',
      tipo: 'CONTRACT',
      estado: 'MATERIALIZADO',
      pdfStorageKey: 'pdfs/test.pdf',
      pdfUrl: null,
      pdfSizeBytes: 10,
      createdAt: new Date('2026-10-26T00:00:00Z'),
      employee: { id: 'employee-001' },
      template: { id: 'template-001' },
    });
    findFirst.mockRejectedValue(new Error('Lectura global sin empleado'));
    execute.mockImplementationOnce((work) =>
      work({ generatedDocument: { findFirst: scopedFindFirst } }),
    );

    const metadata = await service.getMetadata(
      { ...viewer, rol: UserRole.OPERADOR },
      'document-001',
    );

    expect(metadata.pdfAvailable).toBe(true);
    expect(scopedFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'document-001', tenantId: 'tenant-001' },
      }),
    );
    expect(findFirst).not.toHaveBeenCalled();
  });
});
