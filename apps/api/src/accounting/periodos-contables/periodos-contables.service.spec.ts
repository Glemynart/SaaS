import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EstadoPeriodo } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { TenantPrismaService } from '../../tenant-prisma/tenant-prisma.service';
import { PeriodosContablesService } from './periodos-contables.service';

describe('PeriodosContablesService tenant isolation', () => {
  const tx = {
    periodoContable: {
      create: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const auditLog = jest.fn();
  const audit = { log: auditLog } as unknown as AuditService;

  function build(contextTenantId = 'tenant-a') {
    const tenantPrisma = {
      execute: jest.fn((work: (client: unknown, context: unknown) => unknown) =>
        work(tx, { tenantId: contextTenantId }),
      ),
    } as unknown as TenantPrismaService;
    return {
      service: new PeriodosContablesService(tenantPrisma, audit),
      tenantPrisma: tenantPrisma as unknown as {
        execute: jest.Mock;
      },
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    tx.periodoContable.findFirst.mockResolvedValue(null);
    tx.periodoContable.findMany.mockResolvedValue([]);
    tx.periodoContable.create.mockResolvedValue({
      id: 'periodo-a',
      anio: 2028,
      mes: 2,
    });
    tx.periodoContable.createMany.mockResolvedValue({ count: 12 });
    auditLog.mockResolvedValue(undefined);
  });

  it('creates a period only after checking uniqueness within the tenant', async () => {
    const { service, tenantPrisma } = build();
    await service.create('tenant-a', 'user-a', {
      anio: 2028,
      mes: 2,
    });

    expect(tenantPrisma.execute).toHaveBeenCalledTimes(1);
    expect(tx.periodoContable.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', anio: 2028, mes: 2 },
      select: { id: true },
    });
    expect(tx.periodoContable.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-a',
        anio: 2028,
        mes: 2,
        fechaInicio: new Date('2028-02-01T00:00:00.000Z'),
        fechaFin: new Date('2028-02-29T00:00:00.000Z'),
      },
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PERIODO_CONTABLE_CREATE' }),
      tx,
    );
  });

  it('rejects period creation if its transactional audit fails', async () => {
    const { service } = build();
    auditLog.mockRejectedValueOnce(new Error('audit down'));

    await expect(
      service.create('tenant-a', 'user-a', { anio: 2028, mes: 2 }),
    ).rejects.toThrow('audit down');
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PERIODO_CONTABLE_CREATE' }),
      tx,
    );
  });

  it('rejects a duplicate period within the same tenant without creating another', async () => {
    const { service } = build();
    tx.periodoContable.findFirst.mockResolvedValueOnce({
      id: 'periodo-existente',
    });

    await expect(
      service.create('tenant-a', 'user-a', {
        anio: 2028,
        mes: 2,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.periodoContable.create).not.toHaveBeenCalled();
  });

  it('lists periods only for the authenticated tenant and requested filters', async () => {
    const { service } = build();
    await service.findAll('tenant-a', {
      anio: 2028,
      estado: EstadoPeriodo.ABIERTO,
    });

    expect(tx.periodoContable.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        anio: 2028,
        estado: EstadoPeriodo.ABIERTO,
      },
      orderBy: [{ anio: 'desc' }, { mes: 'asc' }],
    });
  });

  it('returns a period when it belongs to the authenticated tenant', async () => {
    const { service } = build();
    const ownedPeriod = { id: 'periodo-a', tenantId: 'tenant-a' };
    tx.periodoContable.findFirst.mockResolvedValueOnce(ownedPeriod);

    await expect(service.findOne('tenant-a', 'periodo-a')).resolves.toBe(
      ownedPeriod,
    );
    expect(tx.periodoContable.findFirst).toHaveBeenCalledWith({
      where: { id: 'periodo-a', tenantId: 'tenant-a' },
    });
  });

  it('does not return a period by ID when it belongs to another tenant', async () => {
    const { service } = build();
    await expect(
      service.findOne('tenant-a', 'periodo-b'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.periodoContable.findFirst).toHaveBeenCalledWith({
      where: { id: 'periodo-b', tenantId: 'tenant-a' },
    });
  });

  it('rejects a request whose tenant differs from the active transaction context', async () => {
    const { service } = build('tenant-b');

    await expect(service.findAll('tenant-a', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(tx.periodoContable.findMany).not.toHaveBeenCalled();
  });

  it('generates only missing months for the authenticated tenant', async () => {
    const { service } = build();
    tx.periodoContable.findMany
      .mockResolvedValueOnce([{ mes: 1 }, { mes: 12 }])
      .mockResolvedValueOnce([]);

    await service.generarAnio('tenant-a', 'user-a', {
      anio: 2028,
    });

    expect(tx.periodoContable.findMany).toHaveBeenNthCalledWith(1, {
      where: { tenantId: 'tenant-a', anio: 2028 },
      select: { mes: true },
    });
    const createManyCalls = tx.periodoContable.createMany.mock
      .calls as unknown as Array<
      [{ data: Array<{ tenantId: string; anio: number; mes: number }> }]
    >;
    const generated = createManyCalls[0]?.[0]?.data ?? [];
    expect(generated).toHaveLength(10);
    expect(generated.every((item) => item.tenantId === 'tenant-a')).toBe(true);
    expect(generated.every((item) => item.anio === 2028)).toBe(true);
    expect(generated.map((item) => item.mes)).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(tx.periodoContable.findMany).toHaveBeenNthCalledWith(2, {
      where: { tenantId: 'tenant-a', anio: 2028 },
      orderBy: { mes: 'asc' },
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', userId: 'user-a' }),
      tx,
    );
  });

  it('rejects year generation if its transactional audit fails', async () => {
    const { service } = build();
    tx.periodoContable.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    auditLog.mockRejectedValueOnce(new Error('audit down'));

    await expect(
      service.generarAnio('tenant-a', 'user-a', { anio: 2028 }),
    ).rejects.toThrow('audit down');
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PERIODO_CONTABLE_GENERAR_ANIO' }),
      tx,
    );
  });

  it('does not create or audit periods when the tenant already has all months', async () => {
    const { service } = build();
    tx.periodoContable.findMany
      .mockResolvedValueOnce(
        Array.from({ length: 12 }, (_, index) => ({ mes: index + 1 })),
      )
      .mockResolvedValueOnce([]);

    await service.generarAnio('tenant-a', 'user-a', {
      anio: 2028,
    });

    expect(tx.periodoContable.createMany).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });
});
