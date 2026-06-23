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
  liquidation: {
    findFirst: mockLiquidationFindFirst,
    create: jest.fn(),
    update: jest.fn(),
  },
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

// ── N2D.5 — Estados e inmutabilidad ─────────────────────────────────────────

describe('LiquidationService — estados e inmutabilidad (N2D.5)', () => {
  let service: LiquidationService;

  const TENANT = 'tenant-1';
  const USER = 'user-1';
  const LIQ_ID = 'liq-001';

  function makeLiq(status: string) {
    return { id: LIQ_ID, status, empleadoId: 'emp-001', concepts: [] };
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

  // ── approveLiquidation ──────────────────────────────────────────────────────

  it('DRAFT → APPROVED: transición válida', async () => {
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('DRAFT'));
    mockPrisma.liquidation.update.mockResolvedValue(makeLiq('APPROVED'));

    const result = await service.approveLiquidation(TENANT, USER, LIQ_ID);

    expect(result.status).toBe('APPROVED');
    expect(mockPrisma.liquidation.update).toHaveBeenCalledWith({
      where: { id: LIQ_ID },
      data: { status: 'APPROVED' },
      include: { concepts: true },
    });
  });

  it('DRAFT → APPROVED: registra auditoría LIQUIDATION_APPROVED', async () => {
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('DRAFT'));
    mockPrisma.liquidation.update.mockResolvedValue(makeLiq('APPROVED'));

    await service.approveLiquidation(TENANT, USER, LIQ_ID);

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LIQUIDATION_APPROVED',
        entityType: 'Liquidation',
        entityId: LIQ_ID,
      }),
    );
  });

  it('APPROVED → APPROVED: transición inválida (no idempotente)', async () => {
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('APPROVED'));

    await expect(
      service.approveLiquidation(TENANT, USER, LIQ_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('PAID → APPROVED: transición inválida (reversa)', async () => {
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('PAID'));

    await expect(
      service.approveLiquidation(TENANT, USER, LIQ_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('approveLiquidation: liquidación inexistente → NotFoundException', async () => {
    mockLiquidationFindFirst.mockResolvedValue(null);

    await expect(
      service.approveLiquidation(TENANT, USER, LIQ_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it('approveLiquidation: tenant incorrecto → NotFoundException', async () => {
    mockLiquidationFindFirst.mockResolvedValue(null);

    await expect(
      service.approveLiquidation('otro-tenant', USER, LIQ_ID),
    ).rejects.toThrow(NotFoundException);
  });

  // ── markLiquidationPaid ─────────────────────────────────────────────────────

  it('APPROVED → PAID: transición válida', async () => {
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('APPROVED'));
    mockPrisma.liquidation.update.mockResolvedValue(makeLiq('PAID'));

    const result = await service.markLiquidationPaid(TENANT, USER, LIQ_ID);

    expect(result.status).toBe('PAID');
    expect(mockPrisma.liquidation.update).toHaveBeenCalledWith({
      where: { id: LIQ_ID },
      data: { status: 'PAID' },
      include: { concepts: true },
    });
  });

  it('APPROVED → PAID: registra auditoría LIQUIDATION_PAID', async () => {
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('APPROVED'));
    mockPrisma.liquidation.update.mockResolvedValue(makeLiq('PAID'));

    await service.markLiquidationPaid(TENANT, USER, LIQ_ID);

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LIQUIDATION_PAID',
        entityType: 'Liquidation',
        entityId: LIQ_ID,
      }),
    );
  });

  it('DRAFT → PAID: transición inválida (salto directo)', async () => {
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('DRAFT'));

    await expect(
      service.markLiquidationPaid(TENANT, USER, LIQ_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('PAID → PAID: transición inválida (no idempotente)', async () => {
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('PAID'));

    await expect(
      service.markLiquidationPaid(TENANT, USER, LIQ_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('markLiquidationPaid: liquidación inexistente → NotFoundException', async () => {
    mockLiquidationFindFirst.mockResolvedValue(null);

    await expect(
      service.markLiquidationPaid(TENANT, USER, LIQ_ID),
    ).rejects.toThrow(NotFoundException);
  });

  // ── voidLiquidation ─────────────────────────────────────────────────────────

  it('DRAFT → VOIDED: transición válida', async () => {
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('DRAFT'));
    mockPrisma.liquidation.update.mockResolvedValue(makeLiq('VOIDED'));

    const result = await service.voidLiquidation(TENANT, USER, LIQ_ID);

    expect(result.status).toBe('VOIDED');
    expect(mockPrisma.liquidation.update).toHaveBeenCalledWith({
      where: { id: LIQ_ID },
      data: { status: 'VOIDED' },
      include: { concepts: true },
    });
  });

  it('APPROVED → VOIDED: transición válida', async () => {
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('APPROVED'));
    mockPrisma.liquidation.update.mockResolvedValue(makeLiq('VOIDED'));

    const result = await service.voidLiquidation(TENANT, USER, LIQ_ID);

    expect(result.status).toBe('VOIDED');
  });

  it('DRAFT → VOIDED: registra auditoría LIQUIDATION_VOIDED', async () => {
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('DRAFT'));
    mockPrisma.liquidation.update.mockResolvedValue(makeLiq('VOIDED'));

    await service.voidLiquidation(TENANT, USER, LIQ_ID);

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LIQUIDATION_VOIDED',
        entityType: 'Liquidation',
        entityId: LIQ_ID,
      }),
    );
  });

  it('PAID → VOIDED: transición inválida (PAID terminal)', async () => {
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('PAID'));

    await expect(service.voidLiquidation(TENANT, USER, LIQ_ID)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('VOIDED → VOIDED: transición inválida (VOIDED terminal, no idempotente)', async () => {
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('VOIDED'));

    await expect(service.voidLiquidation(TENANT, USER, LIQ_ID)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('voidLiquidation: liquidación inexistente → NotFoundException', async () => {
    mockLiquidationFindFirst.mockResolvedValue(null);

    await expect(service.voidLiquidation(TENANT, USER, LIQ_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('voidLiquidation: tenant incorrecto → NotFoundException', async () => {
    mockLiquidationFindFirst.mockResolvedValue(null);

    await expect(
      service.voidLiquidation('otro-tenant', USER, LIQ_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it('VOIDED es terminal: no puede aprobarse ni pagarse', async () => {
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('VOIDED'));

    await expect(
      service.approveLiquidation(TENANT, USER, LIQ_ID),
    ).rejects.toThrow(BadRequestException);

    mockLiquidationFindFirst.mockResolvedValue(makeLiq('VOIDED'));
    await expect(
      service.markLiquidationPaid(TENANT, USER, LIQ_ID),
    ).rejects.toThrow(BadRequestException);
  });

  // ── assertEditable ──────────────────────────────────────────────────────────

  it('assertEditable: DRAFT no lanza', () => {
    expect(() => service.assertEditable('DRAFT')).not.toThrow();
  });

  it('assertEditable: APPROVED lanza BadRequestException', () => {
    expect(() => service.assertEditable('APPROVED')).toThrow(
      BadRequestException,
    );
  });

  it('assertEditable: PAID lanza BadRequestException', () => {
    expect(() => service.assertEditable('PAID')).toThrow(BadRequestException);
  });

  it('assertEditable: VOIDED lanza BadRequestException', () => {
    expect(() => service.assertEditable('VOIDED')).toThrow(BadRequestException);
  });

  // ── assertTransition (exhaustivo) ───────────────────────────────────────────

  it('assertTransition: DRAFT → APPROVED no lanza', () => {
    expect(() => service.assertTransition('DRAFT', 'APPROVED')).not.toThrow();
  });

  it('assertTransition: DRAFT → VOIDED no lanza', () => {
    expect(() => service.assertTransition('DRAFT', 'VOIDED')).not.toThrow();
  });

  it('assertTransition: APPROVED → PAID no lanza', () => {
    expect(() => service.assertTransition('APPROVED', 'PAID')).not.toThrow();
  });

  it('assertTransition: APPROVED → VOIDED no lanza', () => {
    expect(() => service.assertTransition('APPROVED', 'VOIDED')).not.toThrow();
  });

  it('assertTransition: APPROVED → DRAFT lanza', () => {
    expect(() => service.assertTransition('APPROVED', 'DRAFT')).toThrow(
      BadRequestException,
    );
  });

  it('assertTransition: PAID → APPROVED lanza', () => {
    expect(() => service.assertTransition('PAID', 'APPROVED')).toThrow(
      BadRequestException,
    );
  });

  it('assertTransition: PAID → DRAFT lanza', () => {
    expect(() => service.assertTransition('PAID', 'DRAFT')).toThrow(
      BadRequestException,
    );
  });

  it('assertTransition: PAID → VOIDED lanza (PAID terminal)', () => {
    expect(() => service.assertTransition('PAID', 'VOIDED')).toThrow(
      BadRequestException,
    );
  });

  it('assertTransition: DRAFT → PAID lanza (salto directo)', () => {
    expect(() => service.assertTransition('DRAFT', 'PAID')).toThrow(
      BadRequestException,
    );
  });

  it('assertTransition: VOIDED → APPROVED lanza (VOIDED terminal)', () => {
    expect(() => service.assertTransition('VOIDED', 'APPROVED')).toThrow(
      BadRequestException,
    );
  });

  it('assertTransition: VOIDED → DRAFT lanza (VOIDED terminal)', () => {
    expect(() => service.assertTransition('VOIDED', 'DRAFT')).toThrow(
      BadRequestException,
    );
  });

  it('assertTransition: VOIDED → PAID lanza (VOIDED terminal)', () => {
    expect(() => service.assertTransition('VOIDED', 'PAID')).toThrow(
      BadRequestException,
    );
  });
});
