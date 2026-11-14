import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CuentaSistemaMapService } from './cuenta-sistema-map.service';

describe('CuentaSistemaMapService tenant isolation', () => {
  const prisma = {
    cuentaSistemaMap: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    cuentaContable: {
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;
  const auditLog = jest.fn();
  const audit = { log: auditLog } as unknown as AuditService;
  const service = new CuentaSistemaMapService(prisma, audit);
  const maps = prisma.cuentaSistemaMap as unknown as {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  const accounts = prisma.cuentaContable as unknown as {
    findFirst: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    maps.findFirst.mockResolvedValue(null);
    maps.findMany.mockResolvedValue([]);
    maps.create.mockResolvedValue({
      id: 'map-a',
      tenantId: 'tenant-a',
      rol: 'IVA_GENERADO',
      cuentaId: 'cuenta-a',
    });
    maps.update.mockResolvedValue({
      id: 'map-a',
      tenantId: 'tenant-a',
      rol: 'IVA_GENERADO',
      cuentaId: 'cuenta-a',
    });
    accounts.findFirst.mockResolvedValue({ id: 'cuenta-a', imputable: true });
    auditLog.mockResolvedValue(undefined);
  });

  it('scopes list queries and included accounts to the authenticated tenant', async () => {
    await service.findAll('tenant-a');

    expect(maps.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
      orderBy: { rol: 'asc' },
      include: {
        cuenta: { select: { id: true, codigo: true, nombre: true } },
      },
    });
  });

  it('does not return a mapping by ID when it belongs to another tenant', async () => {
    await expect(service.findOne('tenant-a', 'map-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(maps.findFirst).toHaveBeenCalledWith({
      where: { id: 'map-b', tenantId: 'tenant-a' },
      include: {
        cuenta: { select: { id: true, codigo: true, nombre: true } },
      },
    });
  });

  it('creates a mapping only after checking the role and account within the tenant', async () => {
    const dto = {
      rol: 'IVA_GENERADO',
      cuentaId: 'cuenta-a',
      descripcion: 'IVA generado',
    };

    await service.create('tenant-a', 'user-a', dto);

    expect(maps.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', rol: 'IVA_GENERADO' },
      select: { id: true },
    });
    expect(accounts.findFirst).toHaveBeenCalledWith({
      where: { id: 'cuenta-a', tenantId: 'tenant-a', deletedAt: null },
      select: { id: true, imputable: true },
    });
    expect(maps.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-a',
        rol: 'IVA_GENERADO',
        cuentaId: 'cuenta-a',
        descripcion: 'IVA generado',
      },
      include: {
        cuenta: { select: { id: true, codigo: true, nombre: true } },
      },
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', userId: 'user-a' }),
    );
  });

  it('rejects a duplicate role in the same tenant without creating a mapping', async () => {
    maps.findFirst.mockResolvedValueOnce({ id: 'map-existing' });

    await expect(
      service.create('tenant-a', 'user-a', {
        rol: 'IVA_GENERADO',
        cuentaId: 'cuenta-a',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(accounts.findFirst).not.toHaveBeenCalled();
    expect(maps.create).not.toHaveBeenCalled();
  });

  it('rejects a missing, deleted, or foreign-tenant account without writing', async () => {
    accounts.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.create('tenant-a', 'user-a', {
        rol: 'IVA_GENERADO',
        cuentaId: 'cuenta-b',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(accounts.findFirst).toHaveBeenCalledWith({
      where: { id: 'cuenta-b', tenantId: 'tenant-a', deletedAt: null },
      select: { id: true, imputable: true },
    });
    expect(maps.create).not.toHaveBeenCalled();
  });

  it('rejects a non-imputable account without creating a system mapping', async () => {
    accounts.findFirst.mockResolvedValueOnce({
      id: 'cuenta-grupo',
      imputable: false,
    });

    await expect(
      service.create('tenant-a', 'user-a', {
        rol: 'IVA_GENERADO',
        cuentaId: 'cuenta-grupo',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(maps.create).not.toHaveBeenCalled();
  });

  it('does not update a mapping outside the authenticated tenant', async () => {
    await expect(
      service.update('tenant-a', 'user-a', 'map-b', { descripcion: 'Cambio' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(maps.findFirst).toHaveBeenCalledWith({
      where: { id: 'map-b', tenantId: 'tenant-a' },
      include: {
        cuenta: { select: { id: true, codigo: true, nombre: true } },
      },
    });
    expect(maps.update).not.toHaveBeenCalled();
  });

  it('does not reassign a tenant mapping to another tenant account', async () => {
    maps.findFirst.mockResolvedValueOnce({
      id: 'map-a',
      tenantId: 'tenant-a',
    });
    accounts.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.update('tenant-a', 'user-a', 'map-a', {
        cuentaId: 'cuenta-b',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(accounts.findFirst).toHaveBeenCalledWith({
      where: { id: 'cuenta-b', tenantId: 'tenant-a', deletedAt: null },
      select: { id: true, imputable: true },
    });
    expect(maps.update).not.toHaveBeenCalled();
  });
});
