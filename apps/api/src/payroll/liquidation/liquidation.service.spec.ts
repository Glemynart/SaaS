import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LiquidationService } from './liquidation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEmpleadoFindFirst = jest.fn();
const mockLiquidationFindFirst = jest.fn();
const mockPayrollPeriodFindFirst = jest.fn();
const mockPayrollRunFindFirst = jest.fn();

const mockPrisma = {
  empleado: { findFirst: mockEmpleadoFindFirst },
  liquidation: { findFirst: mockLiquidationFindFirst, create: jest.fn() },
  payrollPeriod: { findFirst: mockPayrollPeriodFindFirst },
  payrollRun: { findFirst: mockPayrollRunFindFirst },
  $transaction: jest.fn(),
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

// ── Fixture de empleado ───────────────────────────────────────────────────────

function makeEmp(overrides: Record<string, unknown> = {}) {
  return {
    id: 'emp-001',
    estado: 'RETIRADO',
    salario: 3_000_000,
    salarioIntegral: false,
    fechaIngreso: new Date('2023-01-01'),
    fechaRetiro: new Date('2023-12-31'),
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('LiquidationService — validaciones de dominio', () => {
  let service: LiquidationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        LiquidationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get(LiquidationService);
  });

  it('lanza NotFoundException cuando el empleado no existe', async () => {
    mockEmpleadoFindFirst.mockResolvedValue(null);

    await expect(
      service.createLiquidacion('tenant-1', 'user-1', 'emp-001'),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanza BadRequestException cuando estado !== RETIRADO (ACTIVO)', async () => {
    mockEmpleadoFindFirst.mockResolvedValue(makeEmp({ estado: 'ACTIVO' }));

    await expect(
      service.createLiquidacion('tenant-1', 'user-1', 'emp-001'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanza BadRequestException cuando estado !== RETIRADO (INACTIVO)', async () => {
    mockEmpleadoFindFirst.mockResolvedValue(makeEmp({ estado: 'INACTIVO' }));

    await expect(
      service.createLiquidacion('tenant-1', 'user-1', 'emp-001'),
    ).rejects.toThrow(BadRequestException);
  });

  it('el mensaje indica que solo se pueden liquidar empleados retirados', async () => {
    mockEmpleadoFindFirst.mockResolvedValue(makeEmp({ estado: 'ACTIVO' }));

    await expect(
      service.createLiquidacion('tenant-1', 'user-1', 'emp-001'),
    ).rejects.toThrow(/solo se pueden liquidar empleados retirados/i);
  });

  it('lanza BadRequestException cuando estado === RETIRADO pero fechaRetiro es null', async () => {
    mockEmpleadoFindFirst.mockResolvedValue(makeEmp({ fechaRetiro: null }));

    await expect(
      service.createLiquidacion('tenant-1', 'user-1', 'emp-001'),
    ).rejects.toThrow(BadRequestException);
  });

  it('NO lanza por estado cuando empleado está RETIRADO con fechaRetiro', async () => {
    mockEmpleadoFindFirst.mockResolvedValue(makeEmp());
    // Anti-duplicado: no hay DRAFT existente
    mockLiquidationFindFirst.mockResolvedValue(null);
    // Sin período de retiro → resolución N2D.4 retorna 0
    mockPayrollPeriodFindFirst.mockResolvedValue(null);
    // La transacción devuelve una liquidación mínima
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma),
    );
    mockPrisma.liquidation.create.mockResolvedValue({
      id: 'liq-001',
      concepts: [],
    });

    await expect(
      service.createLiquidacion('tenant-1', 'user-1', 'emp-001'),
    ).resolves.toBeDefined();
  });
});

// ── N2D.4 — Resolución de salario pendiente ─────────────────────────────────────

describe('LiquidationService — salario pendiente (política N2D.4)', () => {
  let service: LiquidationService;

  // Retiro a mitad del período de diciembre: 15 días comerciales trabajados.
  const PERIODO_DIC = {
    id: 'per-dic',
    status: 'DRAFT' as const,
    fechaInicio: new Date('2023-12-01'),
    fechaFin: new Date('2023-12-31'),
  };

  /** Prepara el camino feliz y devuelve el payload pasado a liquidation.create. */
  async function runAndCaptureCreateData() {
    mockEmpleadoFindFirst.mockResolvedValue(
      makeEmp({ fechaRetiro: new Date('2023-12-15') }),
    );
    mockLiquidationFindFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma),
    );
    mockPrisma.liquidation.create.mockResolvedValue({
      id: 'liq-001',
      concepts: [],
    });

    await service.createLiquidacion('tenant-1', 'user-1', 'emp-001');

    return mockPrisma.liquidation.create.mock.calls[0][0].data as {
      concepts: { create: { codigo: string; factor: number }[] };
    };
  }

  function salarioPendienteConcept(data: {
    concepts: { create: { codigo: string; factor: number }[] };
  }) {
    return data.concepts.create.find(
      (c) => c.codigo === 'LIQ_SALARIO_PENDIENTE',
    );
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        LiquidationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get(LiquidationService);
  });

  it('período CLOSED con PayrollRun del empleado → NO emite salario pendiente', async () => {
    mockPayrollPeriodFindFirst.mockResolvedValue({
      ...PERIODO_DIC,
      status: 'CLOSED',
    });
    mockPayrollRunFindFirst.mockResolvedValue({ id: 'run-1' });

    const data = await runAndCaptureCreateData();

    expect(salarioPendienteConcept(data)).toBeUndefined();
    expect(mockPayrollRunFindFirst).toHaveBeenCalled();
  });

  it('período CLOSED pero SIN PayrollRun del empleado → emite días trabajados', async () => {
    mockPayrollPeriodFindFirst.mockResolvedValue({
      ...PERIODO_DIC,
      status: 'CLOSED',
    });
    mockPayrollRunFindFirst.mockResolvedValue(null);

    const data = await runAndCaptureCreateData();

    const concept = salarioPendienteConcept(data);
    expect(concept).toBeDefined();
    // 2023-12-01 → 2023-12-16 (excl) = 15 días comerciales → factor 15/30
    expect(concept!.factor).toBeCloseTo(15 / 30, 6);
  });

  it('período DRAFT (no CLOSED) → emite días trabajados sin consultar runs', async () => {
    mockPayrollPeriodFindFirst.mockResolvedValue(PERIODO_DIC);

    const data = await runAndCaptureCreateData();

    const concept = salarioPendienteConcept(data);
    expect(concept).toBeDefined();
    expect(concept!.factor).toBeCloseTo(15 / 30, 6);
    // En período DRAFT no se consulta PayrollRun.
    expect(mockPayrollRunFindFirst).not.toHaveBeenCalled();
  });

  it('sin período → fallback calendario: retiro el 15 → 15 días', async () => {
    mockPayrollPeriodFindFirst.mockResolvedValue(null);

    const data = await runAndCaptureCreateData();

    const concept = salarioPendienteConcept(data);
    expect(concept).toBeDefined();
    // Empleado ingresó 2023-01-01, retiro 2023-12-15.
    // Sin período → ventana = 2023-12-01 a 2023-12-16 (excl) = 15 días.
    expect(concept!.factor).toBeCloseTo(15 / 30, 6);
    expect(mockPayrollRunFindFirst).not.toHaveBeenCalled();
  });

  it('sin período + ingreso el 10 del mes → días desde el 10', async () => {
    mockPayrollPeriodFindFirst.mockResolvedValue(null);
    mockEmpleadoFindFirst.mockResolvedValue(
      makeEmp({
        fechaIngreso: new Date('2023-12-10'),
        fechaRetiro: new Date('2023-12-15'),
      }),
    );
    mockLiquidationFindFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma),
    );
    mockPrisma.liquidation.create.mockResolvedValue({
      id: 'liq-001',
      concepts: [],
    });

    await service.createLiquidacion('tenant-1', 'user-1', 'emp-001');

    const data = mockPrisma.liquidation.create.mock.calls[0][0].data as {
      concepts: { create: { codigo: string; factor: number }[] };
    };
    const concept = salarioPendienteConcept(data);
    expect(concept).toBeDefined();
    // inicioMes=dic-01 < ingreso=dic-10 → desde=dic-10. Hasta dic-16 (excl) = 6 días.
    expect(concept!.factor).toBeCloseTo(6 / 30, 6);
  });

  it('sin período + retiro último día del mes → 30 días comerciales', async () => {
    mockPayrollPeriodFindFirst.mockResolvedValue(null);
    mockEmpleadoFindFirst.mockResolvedValue(
      makeEmp({
        fechaIngreso: new Date('2023-01-01'),
        fechaRetiro: new Date('2023-12-31'),
      }),
    );
    mockLiquidationFindFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma),
    );
    mockPrisma.liquidation.create.mockResolvedValue({
      id: 'liq-001',
      concepts: [],
    });

    await service.createLiquidacion('tenant-1', 'user-1', 'emp-001');

    const data = mockPrisma.liquidation.create.mock.calls[0][0].data as {
      concepts: { create: { codigo: string; factor: number }[] };
    };
    const concept = salarioPendienteConcept(data);
    expect(concept).toBeDefined();
    // dic-01 → ene-01 (excl) = 30 días comerciales → factor 30/30 = 1
    expect(concept!.factor).toBeCloseTo(1, 6);
  });

  it('ingreso a mitad del período → acota los días trabajados al ingreso', async () => {
    mockPayrollPeriodFindFirst.mockResolvedValue(PERIODO_DIC);
    // Reemplaza el empleado por uno ingresado el 2023-12-06.
    mockEmpleadoFindFirst.mockResolvedValue(
      makeEmp({
        fechaIngreso: new Date('2023-12-06'),
        fechaRetiro: new Date('2023-12-15'),
      }),
    );
    mockLiquidationFindFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma),
    );
    mockPrisma.liquidation.create.mockResolvedValue({
      id: 'liq-001',
      concepts: [],
    });

    await service.createLiquidacion('tenant-1', 'user-1', 'emp-001');

    const data = mockPrisma.liquidation.create.mock.calls[0][0].data as {
      concepts: { create: { codigo: string; factor: number }[] };
    };
    const concept = salarioPendienteConcept(data);
    expect(concept).toBeDefined();
    // 2023-12-06 → 2023-12-16 (excl) = 10 días → factor 10/30
    expect(concept!.factor).toBeCloseTo(10 / 30, 6);
  });
});
