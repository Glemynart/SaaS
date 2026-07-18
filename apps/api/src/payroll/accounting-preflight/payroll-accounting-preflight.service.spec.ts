import { PrismaService } from '../../prisma/prisma.service';
import {
  PAYROLL_ACCOUNTING_REQUIRED_ROLES,
  PayrollAccountingPreflightService,
} from './payroll-accounting-preflight.service';

const TENANT_ID = 'tenant-1';
const FECHA_CAUSACION = new Date('2026-01-31T00:00:00.000Z');

const tenantFindFirst = jest.fn();
const cuentaContableCount = jest.fn();
const cuentaSistemaMapFindMany = jest.fn();
const periodoContableFindFirst = jest.fn();

const client = {
  tenant: { findFirst: tenantFindFirst },
  cuentaContable: { count: cuentaContableCount },
  cuentaSistemaMap: { findMany: cuentaSistemaMapFindMany },
  periodoContable: { findFirst: periodoContableFindFirst },
};

function makeMap(
  rol: string,
  overrides: {
    activo?: boolean;
    cuenta?: {
      codigo: string;
      activa: boolean;
      imputable: boolean;
      deletedAt: Date | null;
    } | null;
  } = {},
) {
  return {
    rol,
    activo: true,
    cuenta: {
      codigo: `CUENTA_${rol}`,
      activa: true,
      imputable: true,
      deletedAt: null,
    },
    ...overrides,
  };
}

function configureValidReadModel() {
  tenantFindFirst.mockResolvedValue({ id: TENANT_ID });
  cuentaContableCount.mockResolvedValue(24);
  cuentaSistemaMapFindMany.mockResolvedValue(
    PAYROLL_ACCOUNTING_REQUIRED_ROLES.map((rol) => makeMap(rol)),
  );
  periodoContableFindFirst.mockResolvedValue({ estado: 'ABIERTO' });
}

describe('PayrollAccountingPreflightService', () => {
  let service: PayrollAccountingPreflightService;

  beforeEach(() => {
    jest.clearAllMocks();
    configureValidReadModel();
    service = new PayrollAccountingPreflightService(
      client as unknown as PrismaService,
    );
  });

  it('reports a valid accounting configuration without writing data', async () => {
    const result = await service.validate(TENANT_ID, {
      fechaCausacion: FECHA_CAUSACION,
    });

    expect(result.status).toBe('OK');
    expect(result.validations).toHaveLength(
      PAYROLL_ACCOUNTING_REQUIRED_ROLES.length + 3,
    );
    expect(result.validations.every((item) => item.severity === 'OK')).toBe(
      true,
    );
  });

  it('reports each required CuentaSistemaMap that is absent', async () => {
    cuentaSistemaMapFindMany.mockResolvedValue(
      PAYROLL_ACCOUNTING_REQUIRED_ROLES.filter(
        (role) => role !== 'GASTO_SUELDOS',
      ).map((role) => makeMap(role)),
    );

    const result = await service.validate(TENANT_ID, {
      fechaCausacion: FECHA_CAUSACION,
    });

    expect(result.status).toBe('ERROR');
    const missingMap = result.validations.find(
      (item) => item.code === 'SYSTEM_ACCOUNT_MAP_MISSING',
    );
    expect(missingMap?.message).toContain('GASTO_SUELDOS');
    expect(missingMap?.severity).toBe('ERROR');
    expect(missingMap?.component).toBe('CUENTA_SISTEMA_MAP');
  });

  it('reports a mapped account that no longer exists', async () => {
    cuentaSistemaMapFindMany.mockResolvedValue(
      PAYROLL_ACCOUNTING_REQUIRED_ROLES.map((role) =>
        role === 'SALARIOS_POR_PAGAR'
          ? makeMap(role, { cuenta: null })
          : makeMap(role),
      ),
    );

    const result = await service.validate(TENANT_ID, {
      fechaCausacion: FECHA_CAUSACION,
    });

    expect(result.status).toBe('ERROR');
    expect(result.validations).toContainEqual(
      expect.objectContaining({
        code: 'SYSTEM_ACCOUNT_MISSING',
        severity: 'ERROR',
      }),
    );
  });

  it('reports an inactive mapped account', async () => {
    cuentaSistemaMapFindMany.mockResolvedValue(
      PAYROLL_ACCOUNTING_REQUIRED_ROLES.map((role) =>
        role === 'GASTO_SUELDOS'
          ? makeMap(role, {
              cuenta: {
                codigo: '510506',
                activa: false,
                imputable: true,
                deletedAt: null,
              },
            })
          : makeMap(role),
      ),
    );

    const result = await service.validate(TENANT_ID, {
      fechaCausacion: FECHA_CAUSACION,
    });

    expect(result.validations).toContainEqual(
      expect.objectContaining({
        code: 'SYSTEM_ACCOUNT_INACTIVE',
        severity: 'ERROR',
      }),
    );
  });

  it('reports the accounting period when it is closed', async () => {
    periodoContableFindFirst.mockResolvedValue({ estado: 'CERRADO' });

    const result = await service.validate(TENANT_ID, {
      fechaCausacion: FECHA_CAUSACION,
    });

    expect(result.status).toBe('ERROR');
    expect(result.validations).toContainEqual(
      expect.objectContaining({
        code: 'ACCOUNTING_PERIOD_CLOSED',
        severity: 'ERROR',
      }),
    );
  });

  it('reports incomplete company accounting configuration', async () => {
    cuentaContableCount.mockResolvedValue(0);

    const result = await service.validate(TENANT_ID, {
      fechaCausacion: FECHA_CAUSACION,
    });

    expect(result.validations).toContainEqual(
      expect.objectContaining({
        code: 'ACCOUNTING_CONFIGURATION_MISSING',
        component: 'ACCOUNTING_CONFIGURATION',
        severity: 'ERROR',
      }),
    );
  });

  it('collects multiple independent configuration errors in one result', async () => {
    cuentaContableCount.mockResolvedValue(0);
    cuentaSistemaMapFindMany.mockResolvedValue([]);
    periodoContableFindFirst.mockResolvedValue(null);

    const result = await service.validate(TENANT_ID, {
      fechaCausacion: FECHA_CAUSACION,
    });

    expect(result.status).toBe('ERROR');
    expect(
      result.validations.filter((item) => item.severity === 'ERROR'),
    ).toHaveLength(PAYROLL_ACCOUNTING_REQUIRED_ROLES.length + 2);
    expect(result.validations).toContainEqual(
      expect.objectContaining({ code: 'ACCOUNTING_PERIOD_MISSING' }),
    );
  });

  it('returns a completely successful structured result', async () => {
    const result = await service.validate(TENANT_ID, {
      fechaCausacion: FECHA_CAUSACION,
    });

    expect(result.status).toBe('OK');
    expect(
      result.validations.find(
        (item) => item.code === 'COMPANY_CONFIGURATION_READY',
      )?.component,
    ).toBe('EMPRESA');
    expect(
      result.validations.find((item) => item.code === 'ACCOUNTING_PERIOD_READY')
        ?.severity,
    ).toBe('OK');
  });
});
