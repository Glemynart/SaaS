import { ForbiddenException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { SedesService } from './sedes.service';

const TENANT_ID = 'tenant-from-context';

describe('SedesService tenant context integration', () => {
  const findMany = jest.fn();
  const execute = jest.fn();
  const auditLog = jest.fn();
  const service = new SedesService(
    { execute } as unknown as TenantPrismaService,
    { log: auditLog } as unknown as AuditService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
    auditLog.mockResolvedValue(undefined);
    execute.mockImplementation(
      (work: (client: unknown, context: { tenantId: string }) => unknown) =>
        work({ sede: { findMany } }, { tenantId: TENANT_ID }),
    );
  });

  it('uses TenantContext as the only tenant source when listing sedes', async () => {
    await service.findAll({});
    const tenantWhere: unknown = expect.objectContaining({
      tenantId: TENANT_ID,
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: tenantWhere,
      }),
    );
  });

  it('does not query when TenantContext is unavailable', async () => {
    execute.mockImplementation(() => {
      throw new ForbiddenException();
    });

    await expect(service.findAll({})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findMany).not.toHaveBeenCalled();
  });

  it('audits sede creation through the tenant transaction', async () => {
    const transaction = {
      sede: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'sede-a',
          nombre: 'Norte',
        }),
      },
      municipioDane: { findUnique: jest.fn().mockResolvedValue({ id: 'm1' }) },
    };
    execute.mockImplementation(
      (
        work: (
          client: typeof transaction,
          context: { tenantId: string },
        ) => unknown,
      ) => work(transaction, { tenantId: TENANT_ID }),
    );

    await service.create('user-a', {
      nombre: 'Norte',
      direccion: 'Calle 1',
      municipioId: 'm1',
    });

    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        userId: 'user-a',
        action: 'SEDE_CREATE',
      }),
      transaction,
    );
  });

  it('rejects sede creation when its transactional audit fails', async () => {
    const transaction = {
      sede: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'sede-a',
          nombre: 'Norte',
        }),
      },
      municipioDane: { findUnique: jest.fn().mockResolvedValue({ id: 'm1' }) },
    };
    execute.mockImplementation(
      (
        work: (
          client: typeof transaction,
          context: { tenantId: string },
        ) => unknown,
      ) => work(transaction, { tenantId: TENANT_ID }),
    );
    auditLog.mockRejectedValueOnce(new Error('audit down'));

    await expect(
      service.create('user-a', {
        nombre: 'Norte',
        direccion: 'Calle 1',
        municipioId: 'm1',
      }),
    ).rejects.toThrow('audit down');
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SEDE_CREATE' }),
      transaction,
    );
  });

  it('records the authenticated actor when a sede is updated', async () => {
    const transaction = {
      sede: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'sede-a', nombre: 'Norte' }),
        update: jest.fn().mockResolvedValue({ id: 'sede-a', nombre: 'Norte' }),
      },
    };
    execute.mockImplementation(
      (
        work: (
          client: typeof transaction,
          context: { tenantId: string },
        ) => unknown,
      ) => work(transaction, { tenantId: TENANT_ID }),
    );

    await service.update('user-a', 'sede-a', { direccion: 'Calle 2' });

    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        userId: 'user-a',
        action: 'SEDE_UPDATE',
        metadata: { fields: ['direccion'] },
      }),
      transaction,
    );
  });

  it('rejects sede updates when their transactional audit fails', async () => {
    const transaction = {
      sede: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'sede-a', nombre: 'Norte' }),
        update: jest.fn().mockResolvedValue({ id: 'sede-a', nombre: 'Norte' }),
      },
    };
    execute.mockImplementation(
      (
        work: (
          client: typeof transaction,
          context: { tenantId: string },
        ) => unknown,
      ) => work(transaction, { tenantId: TENANT_ID }),
    );
    auditLog.mockRejectedValueOnce(new Error('audit down'));

    await expect(
      service.update('user-a', 'sede-a', { direccion: 'Calle 2' }),
    ).rejects.toThrow('audit down');
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SEDE_UPDATE', userId: 'user-a' }),
      transaction,
    );
  });
});
