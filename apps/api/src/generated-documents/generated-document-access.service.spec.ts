import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GeneratedDocumentAccessService } from './generated-document-access.service';

describe('GeneratedDocumentAccessService', () => {
  const findFirst = jest.fn();
  const getObject = jest.fn();
  const auditLog = jest.fn();
  const service = new GeneratedDocumentAccessService(
    { generatedDocument: { findFirst } } as unknown as PrismaService,
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
  });
});
