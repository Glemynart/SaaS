import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_SYSTEM_ACCOUNT_MAPPINGS } from './system-account-mappings';
import { AccountingProvisioningService } from './accounting-provisioning.service';

describe('AccountingProvisioningService tenant isolation', () => {
  const tx = {
    cuentaContable: {
      count: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    cuentaSistemaMap: {
      count: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const templateSelect = {
    id: true,
    codigo: true,
    nombre: true,
    claseContable: true,
    naturaleza: true,
    nivel: true,
    cuentaPadreId: true,
    imputable: true,
    esCuentaSistema: true,
    requiereTercero: true,
    requiereCentroCosto: true,
    requiereBase: true,
  };
  const prismaMock = {
    tenant: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const prisma = prismaMock as unknown as PrismaService;
  const auditLog = jest.fn();
  const audit = { log: auditLog } as unknown as AuditService;
  const service = new AccountingProvisioningService(prisma, audit);

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-a' });
    prismaMock.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    tx.cuentaContable.count.mockResolvedValue(0);
    tx.cuentaContable.findMany.mockResolvedValue([]);
    tx.cuentaContable.create.mockImplementation(
      (args: { data: { codigo: string } }) => ({
        id: `tenant-account-${args.data.codigo}`,
      }),
    );
    tx.cuentaContable.deleteMany.mockResolvedValue({ count: 2 });
    tx.cuentaSistemaMap.count.mockResolvedValue(0);
    tx.cuentaSistemaMap.create.mockResolvedValue({});
    tx.cuentaSistemaMap.deleteMany.mockResolvedValue({ count: 1 });
    auditLog.mockResolvedValue(undefined);
  });

  it('rejects an unknown tenant before opening a transaction', async () => {
    prismaMock.tenant.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.clonarPlanDeCuentas('tenant-missing', 'user-a'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: 'tenant-missing' },
      select: { id: true },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('is idempotent when the tenant already has a chart of accounts', async () => {
    tx.cuentaContable.count.mockResolvedValueOnce(4);
    tx.cuentaSistemaMap.count.mockResolvedValueOnce(3);

    await expect(
      service.clonarPlanDeCuentas('tenant-a', 'user-a'),
    ).resolves.toEqual({
      status: 'already_provisioned',
      cuentas: 4,
      mapeos: 3,
    });

    expect(tx.cuentaContable.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
    });
    expect(tx.cuentaSistemaMap.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
    });
    expect(tx.cuentaContable.findMany).not.toHaveBeenCalled();
    expect(tx.cuentaContable.create).not.toHaveBeenCalled();
    expect(tx.cuentaSistemaMap.create).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('rejects provisioning without the global chart template and performs no writes', async () => {
    await expect(
      service.clonarPlanDeCuentas('tenant-a', 'user-a'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.cuentaContable.findMany).toHaveBeenCalledWith({
      where: { tenantId: null },
      select: templateSelect,
    });
    expect(tx.cuentaContable.create).not.toHaveBeenCalled();
    expect(tx.cuentaSistemaMap.create).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('clones only the global template, resolves parent IDs, and creates tenant-owned mappings', async () => {
    const codes = [
      ...new Set([
        ...DEFAULT_SYSTEM_ACCOUNT_MAPPINGS.map(({ codigo }) => codigo),
        '1105',
      ]),
    ];
    const template = codes.map((codigo) => ({
      id: `template-${codigo}`,
      codigo,
      nombre: `Cuenta ${codigo}`,
      claseContable: 'ACTIVO',
      naturaleza: 'DEBITO',
      nivel: codigo.length,
      cuentaPadreId: codigo === '110505' ? 'template-1105' : null,
      imputable: true,
      esCuentaSistema: true,
      requiereTercero: false,
      requiereCentroCosto: false,
      requiereBase: false,
    }));
    tx.cuentaContable.findMany.mockResolvedValueOnce(template.reverse());

    await expect(
      service.clonarPlanDeCuentas('tenant-a', 'user-a'),
    ).resolves.toEqual({
      status: 'provisioned',
      cuentas: codes.length,
      mapeos: DEFAULT_SYSTEM_ACCOUNT_MAPPINGS.length,
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.cuentaContable.findMany).toHaveBeenCalledWith({
      where: { tenantId: null },
      select: templateSelect,
    });
    const createCalls = tx.cuentaContable.create.mock.calls as Array<
      [
        {
          data: {
            tenantId: string;
            codigo: string;
            cuentaPadreId: string | null;
          };
        },
      ]
    >;
    expect(createCalls).toHaveLength(codes.length);
    expect(
      createCalls.every(([{ data }]) => data.tenantId === 'tenant-a'),
    ).toBe(true);
    const parentIndex = createCalls.findIndex(
      ([{ data }]) => data.codigo === '1105',
    );
    const childIndex = createCalls.findIndex(
      ([{ data }]) => data.codigo === '110505',
    );
    expect(parentIndex).toBeGreaterThanOrEqual(0);
    expect(childIndex).toBeGreaterThan(parentIndex);
    expect(createCalls[childIndex]?.[0].data.cuentaPadreId).toBe(
      'tenant-account-1105',
    );

    const mapCalls = tx.cuentaSistemaMap.create.mock.calls as Array<
      [
        {
          data: {
            tenantId: string;
            rol: string;
            cuentaId: string;
            descripcion: string;
          };
        },
      ]
    >;
    expect(mapCalls).toHaveLength(DEFAULT_SYSTEM_ACCOUNT_MAPPINGS.length);
    for (const mapping of DEFAULT_SYSTEM_ACCOUNT_MAPPINGS) {
      expect(mapCalls).toContainEqual([
        {
          data: {
            tenantId: 'tenant-a',
            rol: mapping.rol,
            cuentaId: `tenant-account-${mapping.codigo}`,
            descripcion: mapping.descripcion,
          },
        },
      ]);
    }
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        userId: 'user-a',
        action: 'ACCOUNTING_PROVISIONED',
        metadata: {
          cuentas: codes.length,
          mapeos: DEFAULT_SYSTEM_ACCOUNT_MAPPINGS.length,
        },
      }),
    );
  });

  it('does not audit a provisioning transaction that cannot resolve a required system account', async () => {
    const missingCode = DEFAULT_SYSTEM_ACCOUNT_MAPPINGS.at(-1)?.codigo;
    const requiredCodes = new Set(
      DEFAULT_SYSTEM_ACCOUNT_MAPPINGS.map(({ codigo }) => codigo),
    );
    requiredCodes.delete(missingCode ?? '');
    tx.cuentaContable.findMany.mockResolvedValueOnce(
      [...requiredCodes].map((codigo) => ({
        id: `template-${codigo}`,
        codigo,
        nombre: `Cuenta ${codigo}`,
        claseContable: 'ACTIVO',
        naturaleza: 'DEBITO',
        nivel: codigo.length,
        cuentaPadreId: null,
        imputable: true,
        esCuentaSistema: true,
        requiereTercero: false,
        requiereCentroCosto: false,
        requiereBase: false,
      })),
    );

    await expect(
      service.clonarPlanDeCuentas('tenant-a', 'user-a'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(auditLog).not.toHaveBeenCalled();
  });

  it('blocks deprovisioning when tenant accounts have ledger movements', async () => {
    tx.cuentaContable.count.mockResolvedValueOnce(1);

    await expect(
      service.desaprovisionar('tenant-a', 'user-a'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.cuentaContable.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', movimientos: { some: {} } },
    });
    expect(tx.cuentaSistemaMap.deleteMany).not.toHaveBeenCalled();
    expect(tx.cuentaContable.deleteMany).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('restricts internal deprovisioning deletes and audit data to the requested tenant', async () => {
    await expect(
      service.desaprovisionar('tenant-a', 'user-a'),
    ).resolves.toEqual({ cuentas: 2 });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.cuentaContable.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', movimientos: { some: {} } },
    });
    expect(tx.cuentaSistemaMap.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
    });
    expect(tx.cuentaContable.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        userId: 'user-a',
        action: 'ACCOUNTING_DEPROVISIONED',
        metadata: { cuentas: 2 },
      }),
    );
  });
});
