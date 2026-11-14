import { ConflictException, NotFoundException } from '@nestjs/common';
import { TipoDocIdentidad, TipoPersona } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTerceroDto } from './dto/create-tercero.dto';
import { TerceroQueryDto } from './dto/tercero-query.dto';
import { TercerosService } from './terceros.service';

describe('TercerosService tenant isolation', () => {
  const prisma = {
    tercero: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    municipioDane: {
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;
  const audit = {
    log: jest.fn(),
  } as unknown as AuditService;
  const service = new TercerosService(prisma, audit);
  const prismaTercero = prisma.tercero as unknown as {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  const prismaMunicipio = prisma.municipioDane as unknown as {
    findUnique: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaTercero.findFirst.mockResolvedValue(null);
    prismaTercero.findMany.mockResolvedValue([]);
    prismaTercero.create.mockResolvedValue({
      id: 'tercero-nuevo',
      tenantId: 'tenant-a',
    });
    prismaTercero.update.mockResolvedValue({
      id: 'tercero-a',
      tenantId: 'tenant-a',
    });
    prismaMunicipio.findUnique.mockResolvedValue({ id: 'municipio-a' });
    (audit.log as jest.Mock).mockResolvedValue(undefined);
  });

  it('scopes list queries to the authenticated tenant', async () => {
    const query = { esCliente: true } as TerceroQueryDto;

    await service.findAll('tenant-a', query);

    expect(prismaTercero.findMany).toHaveBeenCalledWith({
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

    expect(prismaTercero.findFirst).toHaveBeenCalledWith({
      where: { id: 'tercero-b', tenantId: 'tenant-a' },
    });
  });

  it('does not update a third party outside the authenticated tenant', async () => {
    await expect(
      service.update('tenant-a', 'user-a', 'tercero-b', {
        razonSocial: 'Intento de cambio',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaTercero.findFirst).toHaveBeenCalledWith({
      where: { id: 'tercero-b', tenantId: 'tenant-a' },
    });
    expect(prismaTercero.update).not.toHaveBeenCalled();
  });

  it('does not soft-delete a third party outside the authenticated tenant', async () => {
    await expect(
      service.remove('tenant-a', 'user-a', 'tercero-b'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaTercero.findFirst).toHaveBeenCalledWith({
      where: { id: 'tercero-b', tenantId: 'tenant-a' },
    });
    expect(prismaTercero.update).not.toHaveBeenCalled();
  });

  it('creates the canonical third party under the authenticated tenant', async () => {
    const dto = {
      tipoDocumento: TipoDocIdentidad.NIT,
      numeroDocumento: '900000001',
      tipoPersona: TipoPersona.JURIDICA,
      razonSocial: 'Proveedor de prueba',
    } as CreateTerceroDto;

    await service.create('tenant-a', 'user-a', dto);

    expect(prismaTercero.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        tipoDocumento: TipoDocIdentidad.NIT,
        numeroDocumento: '900000001',
      },
      select: { id: true },
    });
    const createCall = (
      prismaTercero.create.mock.calls as unknown as unknown[][]
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
    prismaTercero.findFirst.mockResolvedValueOnce({ id: 'tercero-existente' });
    const dto = {
      tipoDocumento: TipoDocIdentidad.NIT,
      numeroDocumento: '900000001',
      tipoPersona: TipoPersona.JURIDICA,
      razonSocial: 'Proveedor de prueba',
    } as CreateTerceroDto;

    await expect(
      service.create('tenant-a', 'user-a', dto),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaTercero.create).not.toHaveBeenCalled();
  });
});
