import { ConflictException, NotFoundException } from '@nestjs/common';
import { EstadoPeriodo } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PeriodosContablesService } from './periodos-contables.service';

describe('PeriodosContablesService tenant isolation', () => {
  const prisma = {
    periodoContable: {
      create: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;
  const auditLog = jest.fn();
  const audit = { log: auditLog } as unknown as AuditService;
  const service = new PeriodosContablesService(prisma, audit);
  const periodo = prisma.periodoContable as unknown as {
    create: jest.Mock;
    createMany: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    periodo.findFirst.mockResolvedValue(null);
    periodo.findMany.mockResolvedValue([]);
    periodo.create.mockResolvedValue({ id: 'periodo-a', anio: 2028, mes: 2 });
    periodo.createMany.mockResolvedValue({ count: 12 });
    auditLog.mockResolvedValue(undefined);
  });

  it('creates a period only after checking uniqueness within the tenant', async () => {
    await service.create('tenant-a', 'user-a', {
      anio: 2028,
      mes: 2,
    });

    expect(periodo.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', anio: 2028, mes: 2 },
      select: { id: true },
    });
    expect(periodo.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-a',
        anio: 2028,
        mes: 2,
        fechaInicio: new Date('2028-02-01T00:00:00.000Z'),
        fechaFin: new Date('2028-02-29T00:00:00.000Z'),
      },
    });
  });

  it('rejects a duplicate period within the same tenant without creating another', async () => {
    periodo.findFirst.mockResolvedValueOnce({ id: 'periodo-existente' });

    await expect(
      service.create('tenant-a', 'user-a', {
        anio: 2028,
        mes: 2,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(periodo.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', anio: 2028, mes: 2 },
      select: { id: true },
    });
    expect(periodo.create).not.toHaveBeenCalled();
  });

  it('lists periods only for the authenticated tenant and requested filters', async () => {
    await service.findAll('tenant-a', {
      anio: 2028,
      estado: EstadoPeriodo.ABIERTO,
    });

    expect(periodo.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        anio: 2028,
        estado: EstadoPeriodo.ABIERTO,
      },
      orderBy: [{ anio: 'desc' }, { mes: 'asc' }],
    });
  });

  it('returns a period when it belongs to the authenticated tenant', async () => {
    const ownedPeriod = { id: 'periodo-a', tenantId: 'tenant-a' };
    periodo.findFirst.mockResolvedValueOnce(ownedPeriod);

    await expect(service.findOne('tenant-a', 'periodo-a')).resolves.toBe(
      ownedPeriod,
    );
    expect(periodo.findFirst).toHaveBeenCalledWith({
      where: { id: 'periodo-a', tenantId: 'tenant-a' },
    });
  });
  it('does not return a period by ID when it belongs to another tenant', async () => {
    await expect(
      service.findOne('tenant-a', 'periodo-b'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(periodo.findFirst).toHaveBeenCalledWith({
      where: { id: 'periodo-b', tenantId: 'tenant-a' },
    });
  });

  it('generates only missing months for the authenticated tenant', async () => {
    periodo.findMany
      .mockResolvedValueOnce([{ mes: 1 }, { mes: 12 }])
      .mockResolvedValueOnce([]);

    await service.generarAnio('tenant-a', 'user-a', {
      anio: 2028,
    });

    expect(periodo.findMany).toHaveBeenNthCalledWith(1, {
      where: { tenantId: 'tenant-a', anio: 2028 },
      select: { mes: true },
    });
    const createManyCalls = periodo.createMany.mock.calls as unknown as Array<
      [{ data: Array<{ tenantId: string; anio: number; mes: number }> }]
    >;
    const generated = createManyCalls[0]?.[0]?.data ?? [];
    expect(generated).toHaveLength(10);
    expect(generated.every((item) => item.tenantId === 'tenant-a')).toBe(true);
    expect(generated.every((item) => item.anio === 2028)).toBe(true);
    expect(generated.map((item) => item.mes)).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(periodo.findMany).toHaveBeenNthCalledWith(2, {
      where: { tenantId: 'tenant-a', anio: 2028 },
      orderBy: { mes: 'asc' },
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', userId: 'user-a' }),
    );
  });

  it('does not create or audit periods when the tenant already has all months', async () => {
    periodo.findMany
      .mockResolvedValueOnce(
        Array.from({ length: 12 }, (_, index) => ({ mes: index + 1 })),
      )
      .mockResolvedValueOnce([]);

    await service.generarAnio('tenant-a', 'user-a', {
      anio: 2028,
    });

    expect(periodo.createMany).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });
});
