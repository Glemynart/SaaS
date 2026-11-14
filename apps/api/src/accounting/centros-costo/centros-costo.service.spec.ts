import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CentrosCostoService } from './centros-costo.service';

describe('CentrosCostoService tenant isolation', () => {
  const prisma = {
    centroCosto: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    sede: {
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;
  const auditLog = jest.fn();
  const audit = { log: auditLog } as unknown as AuditService;
  const service = new CentrosCostoService(prisma, audit);
  const centers = prisma.centroCosto as unknown as {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  const sites = prisma.sede as unknown as {
    findFirst: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    centers.findFirst.mockResolvedValue(null);
    centers.findMany.mockResolvedValue([]);
    centers.create.mockResolvedValue({
      id: 'centro-a',
      tenantId: 'tenant-a',
      codigo: 'ADM',
      nombre: 'Administración',
      sedeId: 'sede-a',
    });
    centers.update.mockResolvedValue({
      id: 'centro-a',
      tenantId: 'tenant-a',
      codigo: 'ADM',
      nombre: 'Administración',
      sedeId: 'sede-a',
    });
    sites.findFirst.mockResolvedValue({ id: 'sede-a' });
    auditLog.mockResolvedValue(undefined);
  });

  it('lists only the tenant records and applies active, deletion, and search filters', async () => {
    await service.findAll('tenant-a', {
      activo: true,
      includeDeleted: false,
      search: 'norte',
    });

    expect(centers.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        deletedAt: null,
        activo: true,
        OR: [
          { codigo: { contains: 'norte', mode: 'insensitive' } },
          { nombre: { contains: 'norte', mode: 'insensitive' } },
        ],
      },
      orderBy: { codigo: 'asc' },
    });
  });

  it('does not return a cost center by ID when it belongs to another tenant', async () => {
    await expect(
      service.findOne('tenant-a', 'centro-b'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(centers.findFirst).toHaveBeenCalledWith({
      where: { id: 'centro-b', tenantId: 'tenant-a' },
    });
  });

  it('creates a cost center under the authenticated tenant after validating its site', async () => {
    await service.create('tenant-a', 'user-a', {
      codigo: 'ADM',
      nombre: 'Administración',
      sedeId: 'sede-a',
      activo: true,
    });

    expect(centers.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', codigo: 'ADM' },
      select: { id: true },
    });
    expect(sites.findFirst).toHaveBeenCalledWith({
      where: { id: 'sede-a', tenantId: 'tenant-a' },
      select: { id: true },
    });
    expect(centers.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-a',
        codigo: 'ADM',
        nombre: 'Administración',
        sedeId: 'sede-a',
        activo: true,
      },
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', userId: 'user-a' }),
    );
  });

  it('rejects duplicate cost-center codes in the tenant without writing', async () => {
    centers.findFirst.mockResolvedValueOnce({ id: 'centro-existente' });

    await expect(
      service.create('tenant-a', 'user-a', {
        codigo: 'ADM',
        nombre: 'Duplicado',
        sedeId: 'sede-a',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(sites.findFirst).not.toHaveBeenCalled();
    expect(centers.create).not.toHaveBeenCalled();
  });

  it('rejects a site from another tenant without creating a cost center', async () => {
    sites.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.create('tenant-a', 'user-a', {
        codigo: 'ADM',
        nombre: 'Administración',
        sedeId: 'sede-b',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(sites.findFirst).toHaveBeenCalledWith({
      where: { id: 'sede-b', tenantId: 'tenant-a' },
      select: { id: true },
    });
    expect(centers.create).not.toHaveBeenCalled();
  });

  it('does not update a cost center outside the authenticated tenant', async () => {
    await expect(
      service.update('tenant-a', 'user-a', 'centro-b', {
        nombre: 'Cambio ajeno',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(centers.findFirst).toHaveBeenCalledWith({
      where: { id: 'centro-b', tenantId: 'tenant-a' },
    });
    expect(centers.update).not.toHaveBeenCalled();
  });

  it('does not reassign a tenant cost center to a site from another tenant', async () => {
    centers.findFirst.mockResolvedValueOnce({
      id: 'centro-a',
      tenantId: 'tenant-a',
      deletedAt: null,
    });
    sites.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.update('tenant-a', 'user-a', 'centro-a', { sedeId: 'sede-b' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(sites.findFirst).toHaveBeenCalledWith({
      where: { id: 'sede-b', tenantId: 'tenant-a' },
      select: { id: true },
    });
    expect(centers.update).not.toHaveBeenCalled();
  });

  it('does not soft-delete a cost center outside the authenticated tenant', async () => {
    await expect(
      service.remove('tenant-a', 'user-a', 'centro-b'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(centers.findFirst).toHaveBeenCalledWith({
      where: { id: 'centro-b', tenantId: 'tenant-a' },
    });
    expect(centers.update).not.toHaveBeenCalled();
  });

  it('soft-deletes an owned cost center and records an audit event', async () => {
    centers.findFirst.mockResolvedValueOnce({
      id: 'centro-a',
      tenantId: 'tenant-a',
      deletedAt: null,
    });

    await service.remove('tenant-a', 'user-a', 'centro-a');

    const updateCall = (
      centers.update.mock.calls as unknown as Array<
        [
          {
            where: { id: string };
            data: {
              deletedAt: Date;
              activo: boolean;
              nombre?: string;
              sedeId?: string;
            };
          },
        ]
      >
    )[0]?.[0];
    expect(updateCall.where).toEqual({ id: 'centro-a' });
    expect(updateCall.data.activo).toBe(false);
    expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        userId: 'user-a',
        action: 'CENTRO_COSTO_DELETE',
      }),
    );
  });

  it('keeps deletion idempotent for a cost center already deleted', async () => {
    const deleted = {
      id: 'centro-a',
      tenantId: 'tenant-a',
      deletedAt: new Date('2026-11-14T00:00:00.000Z'),
    };
    centers.findFirst.mockResolvedValueOnce(deleted);

    await expect(
      service.remove('tenant-a', 'user-a', 'centro-a'),
    ).resolves.toBe(deleted);

    expect(centers.update).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });
});
