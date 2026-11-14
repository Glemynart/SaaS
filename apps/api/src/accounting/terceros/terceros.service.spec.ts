import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TipoDocIdentidad, TipoPersona } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { TenantPrismaService } from '../../tenant-prisma/tenant-prisma.service';
import { CreateTerceroDto } from './dto/create-tercero.dto';
import { TerceroQueryDto } from './dto/tercero-query.dto';
import { TercerosService } from './terceros.service';

describe('TercerosService tenant isolation', () => {
  const tx = {
    tercero: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    municipioDane: {
      findUnique: jest.fn(),
    },
  };
  const tenantPrisma = { execute: jest.fn() };
  const audit = { log: jest.fn() };
  const service = new TercerosService(
    tenantPrisma as unknown as TenantPrismaService,
    audit as unknown as AuditService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tenantPrisma.execute.mockImplementation((work: unknown) =>
      (work as (client: typeof tx, context: { tenantId: string }) => unknown)(
        tx,
        { tenantId: 'tenant-a' },
      ),
    );
    tx.tercero.findFirst.mockResolvedValue(null);
    tx.tercero.findMany.mockResolvedValue([]);
    tx.tercero.create.mockResolvedValue({
      id: 'tercero-nuevo',
      tenantId: 'tenant-a',
    });
    tx.tercero.update.mockResolvedValue({
      id: 'tercero-a',
      tenantId: 'tenant-a',
    });
    tx.municipioDane.findUnique.mockResolvedValue({ id: 'municipio-a' });
    audit.log.mockResolvedValue(undefined);
  });

  it('scopes list queries to the active tenant transaction', async () => {
    const query = { esCliente: true } as TerceroQueryDto;

    await service.findAll('tenant-a', query);

    expect(tenantPrisma.execute).toHaveBeenCalledTimes(1);
    expect(tx.tercero.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        deletedAt: null,
        esCliente: true,
      },
      orderBy: [{ razonSocial: 'asc' }, { primerApellido: 'asc' }],
    });
  });

  it('does not return a third party by ID when it belongs to another tenant', async () => {
    await expect(
      service.findOne('tenant-a', 'tercero-b'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.tercero.findFirst).toHaveBeenCalledWith({
      where: { id: 'tercero-b', tenantId: 'tenant-a' },
    });
  });

  it('does not update a third party outside the authenticated tenant', async () => {
    await expect(
      service.update('tenant-a', 'user-a', 'tercero-b', {
        razonSocial: 'Intento de cambio',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.tercero.findFirst).toHaveBeenCalledWith({
      where: { id: 'tercero-b', tenantId: 'tenant-a' },
    });
    expect(tx.tercero.update).not.toHaveBeenCalled();
  });

  it('does not soft-delete a third party outside the authenticated tenant', async () => {
    await expect(
      service.remove('tenant-a', 'user-a', 'tercero-b'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.tercero.findFirst).toHaveBeenCalledWith({
      where: { id: 'tercero-b', tenantId: 'tenant-a' },
    });
    expect(tx.tercero.update).not.toHaveBeenCalled();
  });

  it('does not repeat the update or audit when a third party is already deleted', async () => {
    const deleted = {
      id: 'tercero-a',
      tenantId: 'tenant-a',
      deletedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    tx.tercero.findFirst.mockResolvedValueOnce(deleted);

    await expect(
      service.remove('tenant-a', 'user-a', 'tercero-a'),
    ).resolves.toEqual(deleted);

    expect(tx.tercero.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('creates the canonical third party inside the active tenant transaction', async () => {
    const dto = {
      tipoDocumento: TipoDocIdentidad.NIT,
      numeroDocumento: '900000001',
      tipoPersona: TipoPersona.JURIDICA,
      razonSocial: 'Proveedor de prueba',
    } as CreateTerceroDto;

    await service.create('tenant-a', 'user-a', dto);

    expect(tx.tercero.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        tipoDocumento: TipoDocIdentidad.NIT,
        numeroDocumento: '900000001',
      },
      select: { id: true },
    });
    const createCall = (
      tx.tercero.create.mock.calls as unknown as unknown[][]
    )[0]?.[0] as {
      data: {
        tenantId: string;
        tipoDocumento: TipoDocIdentidad;
        numeroDocumento: string;
      };
    };
    expect(createCall.data).toMatchObject({
      tenantId: 'tenant-a',
      tipoDocumento: TipoDocIdentidad.NIT,
      numeroDocumento: '900000001',
    });
  });

  it('keeps duplicate document detection scoped to the same tenant', async () => {
    tx.tercero.findFirst.mockResolvedValueOnce({ id: 'tercero-existente' });
    const dto = {
      tipoDocumento: TipoDocIdentidad.NIT,
      numeroDocumento: '900000001',
      tipoPersona: TipoPersona.JURIDICA,
      razonSocial: 'Proveedor de prueba',
    } as CreateTerceroDto;

    await expect(
      service.create('tenant-a', 'user-a', dto),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.tercero.create).not.toHaveBeenCalled();
  });

  it('fails closed when the service tenant differs from the active context', async () => {
    await expect(service.findAll('tenant-b', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(tx.tercero.findMany).not.toHaveBeenCalled();
  });
});
