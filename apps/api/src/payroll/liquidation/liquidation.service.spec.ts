import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { LiquidationService } from './liquidation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEmpleadoFindFirst = jest.fn();
const mockLiquidationFindFirst = jest.fn();
const mockLiquidationUpdateMany = jest.fn();
const mockLiquidationFindMany = jest.fn();
const mockLiquidationCount = jest.fn();
const mockPayrollPeriodFindFirst = jest.fn();
const mockPayrollRunFindFirst = jest.fn();

const mockPrisma = {
  empleado: { findFirst: mockEmpleadoFindFirst },
  liquidation: {
    findFirst: mockLiquidationFindFirst,
    findMany: mockLiquidationFindMany,
    count: mockLiquidationCount,
    create: jest.fn(),
    update: jest.fn(),
    updateMany: mockLiquidationUpdateMany,
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
  // status base = BORRADOR: no procesado bajo la máquina de estados P1/U1
  // (ver PERIODOS_PROCESADOS en liquidation.service.ts).
  const PERIODO_DIC = {
    id: 'per-dic',
    status: 'BORRADOR' as const,
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

  it('período APROBADA con PayrollRun del empleado → NO emite salario pendiente', async () => {
    mockPayrollPeriodFindFirst.mockResolvedValue({
      ...PERIODO_DIC,
      status: 'APROBADA',
    });
    mockPayrollRunFindFirst.mockResolvedValue({ id: 'run-1' });

    const data = await runAndCaptureCreateData();

    expect(salarioPendienteConcept(data)).toBeUndefined();
    expect(mockPayrollRunFindFirst).toHaveBeenCalled();
  });

  it('período APROBADA pero SIN PayrollRun del empleado → emite días trabajados', async () => {
    mockPayrollPeriodFindFirst.mockResolvedValue({
      ...PERIODO_DIC,
      status: 'APROBADA',
    });
    mockPayrollRunFindFirst.mockResolvedValue(null);

    const data = await runAndCaptureCreateData();

    const concept = salarioPendienteConcept(data);
    expect(concept).toBeDefined();
    // 2023-12-01 → 2023-12-16 (excl) = 15 días comerciales → factor 15/30
    expect(concept!.factor).toBeCloseTo(15 / 30, 6);
  });

  it('período CERRADA (legado, backfill de CLOSED) con PayrollRun → NO emite salario pendiente', async () => {
    // Regresión H1: antes de la corrección, esta rama nunca se ejecutaba
    // porque ningún PayrollPeriod vuelve a estar en CLOSED tras el backfill
    // de U1 — los períodos legados quedan en CERRADA, no en APROBADA.
    mockPayrollPeriodFindFirst.mockResolvedValue({
      ...PERIODO_DIC,
      status: 'CERRADA',
    });
    mockPayrollRunFindFirst.mockResolvedValue({ id: 'run-1' });

    const data = await runAndCaptureCreateData();

    expect(salarioPendienteConcept(data)).toBeUndefined();
    expect(mockPayrollRunFindFirst).toHaveBeenCalled();
  });

  it('período BORRADOR (no procesado) → emite días trabajados sin consultar runs', async () => {
    mockPayrollPeriodFindFirst.mockResolvedValue(PERIODO_DIC);

    const data = await runAndCaptureCreateData();

    const concept = salarioPendienteConcept(data);
    expect(concept).toBeDefined();
    expect(concept!.factor).toBeCloseTo(15 / 30, 6);
    // En período no procesado no se consulta PayrollRun.
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

  it('DRAFT → APPROVED: transición válida (updateMany condicional por estado)', async () => {
    mockLiquidationFindFirst
      .mockResolvedValueOnce(makeLiq('DRAFT')) // carga
      .mockResolvedValueOnce(makeLiq('APPROVED')); // re-fetch
    mockLiquidationUpdateMany.mockResolvedValue({ count: 1 });

    const result = await service.approveLiquidation(TENANT, USER, LIQ_ID);

    expect(result!.status).toBe('APPROVED');
    // El WHERE incluye el estado leído → cierra la ventana TOCTOU.
    expect(mockLiquidationUpdateMany).toHaveBeenCalledWith({
      where: { id: LIQ_ID, tenantId: TENANT, status: 'DRAFT' },
      data: { status: 'APPROVED' },
    });
  });

  it('DRAFT → APPROVED: registra auditoría LIQUIDATION_APPROVED', async () => {
    mockLiquidationFindFirst
      .mockResolvedValueOnce(makeLiq('DRAFT'))
      .mockResolvedValueOnce(makeLiq('APPROVED'));
    mockLiquidationUpdateMany.mockResolvedValue({ count: 1 });

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

  it('approveLiquidation: findFirst filtra por tenantId en where', async () => {
    mockLiquidationFindFirst
      .mockResolvedValueOnce(makeLiq('DRAFT'))
      .mockResolvedValueOnce(makeLiq('APPROVED'));
    mockLiquidationUpdateMany.mockResolvedValue({ count: 1 });

    await service.approveLiquidation(TENANT, USER, LIQ_ID);

    expect(mockLiquidationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT }),
      }),
    );
  });

  // ── markLiquidationPaid ─────────────────────────────────────────────────────

  it('APPROVED → PAID: transición válida (updateMany condicional por estado)', async () => {
    mockLiquidationFindFirst
      .mockResolvedValueOnce(makeLiq('APPROVED'))
      .mockResolvedValueOnce(makeLiq('PAID'));
    mockLiquidationUpdateMany.mockResolvedValue({ count: 1 });

    const result = await service.markLiquidationPaid(TENANT, USER, LIQ_ID);

    expect(result!.status).toBe('PAID');
    expect(mockLiquidationUpdateMany).toHaveBeenCalledWith({
      where: { id: LIQ_ID, tenantId: TENANT, status: 'APPROVED' },
      data: { status: 'PAID' },
    });
  });

  it('APPROVED → PAID: registra auditoría LIQUIDATION_PAID', async () => {
    mockLiquidationFindFirst
      .mockResolvedValueOnce(makeLiq('APPROVED'))
      .mockResolvedValueOnce(makeLiq('PAID'));
    mockLiquidationUpdateMany.mockResolvedValue({ count: 1 });

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

  it('markLiquidationPaid: findFirst filtra por tenantId en where', async () => {
    mockLiquidationFindFirst
      .mockResolvedValueOnce(makeLiq('APPROVED'))
      .mockResolvedValueOnce(makeLiq('PAID'));
    mockLiquidationUpdateMany.mockResolvedValue({ count: 1 });

    await service.markLiquidationPaid(TENANT, USER, LIQ_ID);

    expect(mockLiquidationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT }),
      }),
    );
  });

  // ── voidLiquidation ─────────────────────────────────────────────────────────

  it('DRAFT → VOIDED: transición válida (updateMany condicional por estado)', async () => {
    mockLiquidationFindFirst
      .mockResolvedValueOnce(makeLiq('DRAFT'))
      .mockResolvedValueOnce(makeLiq('VOIDED'));
    mockLiquidationUpdateMany.mockResolvedValue({ count: 1 });

    const result = await service.voidLiquidation(TENANT, USER, LIQ_ID);

    expect(result!.status).toBe('VOIDED');
    expect(mockLiquidationUpdateMany).toHaveBeenCalledWith({
      where: { id: LIQ_ID, tenantId: TENANT, status: 'DRAFT' },
      data: { status: 'VOIDED' },
    });
  });

  it('APPROVED → VOIDED: transición válida', async () => {
    mockLiquidationFindFirst
      .mockResolvedValueOnce(makeLiq('APPROVED'))
      .mockResolvedValueOnce(makeLiq('VOIDED'));
    mockLiquidationUpdateMany.mockResolvedValue({ count: 1 });

    const result = await service.voidLiquidation(TENANT, USER, LIQ_ID);

    expect(result!.status).toBe('VOIDED');
  });

  it('DRAFT → VOIDED: registra auditoría LIQUIDATION_VOIDED', async () => {
    mockLiquidationFindFirst
      .mockResolvedValueOnce(makeLiq('DRAFT'))
      .mockResolvedValueOnce(makeLiq('VOIDED'));
    mockLiquidationUpdateMany.mockResolvedValue({ count: 1 });

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

  it('voidLiquidation: findFirst filtra por tenantId en where', async () => {
    mockLiquidationFindFirst
      .mockResolvedValueOnce(makeLiq('DRAFT'))
      .mockResolvedValueOnce(makeLiq('VOIDED'));
    mockLiquidationUpdateMany.mockResolvedValue({ count: 1 });

    await service.voidLiquidation(TENANT, USER, LIQ_ID);

    expect(mockLiquidationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT }),
      }),
    );
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

// ── N2D.6 — Concurrencia, conflicto DRAFT y lectura ─────────────────────────

describe('LiquidationService — concurrencia y lectura (N2D.6)', () => {
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

  // ── Concurrencia: carrera perdida en transición ──────────────────────────────

  it('transición válida pero count === 0 → ConflictException (carrera perdida)', async () => {
    // findFirst carga DRAFT, assertTransition pasa, pero otro request ya
    // cambió el estado → updateMany matchea 0 filas.
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('DRAFT'));
    mockLiquidationUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.approveLiquidation(TENANT, USER, LIQ_ID),
    ).rejects.toThrow(ConflictException);
  });

  it('carrera perdida: NO registra auditoría', async () => {
    // APPROVED → PAID es transición válida; la carrera la pierde el updateMany.
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('APPROVED'));
    mockLiquidationUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.markLiquidationPaid(TENANT, USER, LIQ_ID),
    ).rejects.toThrow(ConflictException);
    expect(mockAudit.log).not.toHaveBeenCalled();
  });

  it('approve + void simultáneos: solo uno gana, el otro recibe Conflict', async () => {
    // Request A: lee DRAFT, gana el updateMany.
    mockLiquidationFindFirst
      .mockResolvedValueOnce(makeLiq('DRAFT'))
      .mockResolvedValueOnce(makeLiq('APPROVED'));
    mockLiquidationUpdateMany.mockResolvedValueOnce({ count: 1 });
    await expect(
      service.approveLiquidation(TENANT, USER, LIQ_ID),
    ).resolves.toBeDefined();

    // Request B: también leyó DRAFT, pero el estado ya cambió → count 0.
    mockLiquidationFindFirst.mockResolvedValueOnce(makeLiq('DRAFT'));
    mockLiquidationUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.voidLiquidation(TENANT, USER, LIQ_ID)).rejects.toThrow(
      ConflictException,
    );
  });

  // ── Conflicto índice único DRAFT (doble click) ───────────────────────────────

  it('createLiquidacion: P2002 del índice DRAFT → ConflictException', async () => {
    mockEmpleadoFindFirst.mockResolvedValue({
      id: 'emp-001',
      estado: 'RETIRADO',
      salario: 3_000_000,
      salarioIntegral: false,
      fechaIngreso: new Date('2023-01-01'),
      fechaRetiro: new Date('2023-12-31'),
    });
    mockLiquidationFindFirst.mockResolvedValue(null);
    mockPayrollPeriodFindFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
        meta: { target: ['liquidations_tenantId_empleadoId_draft_key'] },
      }),
    );

    await expect(
      service.createLiquidacion(TENANT, USER, 'emp-001'),
    ).rejects.toThrow(ConflictException);
  });

  it('createLiquidacion: P2002 de otra constraint → re-lanza el error original', async () => {
    mockEmpleadoFindFirst.mockResolvedValue({
      id: 'emp-001',
      estado: 'RETIRADO',
      salario: 3_000_000,
      salarioIntegral: false,
      fechaIngreso: new Date('2023-01-01'),
      fechaRetiro: new Date('2023-12-31'),
    });
    mockLiquidationFindFirst.mockResolvedValue(null);
    mockPayrollPeriodFindFirst.mockResolvedValue(null);
    const otherP2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '6.19.3',
        meta: { target: ['some_other_index'] },
      },
    );
    mockPrisma.$transaction.mockRejectedValue(otherP2002);

    await expect(
      service.createLiquidacion(TENANT, USER, 'emp-001'),
    ).rejects.toThrow(otherP2002);
  });

  // ── findAll ──────────────────────────────────────────────────────────────────

  it('findAll: pagina y filtra por tenant; devuelve meta', async () => {
    mockLiquidationFindMany.mockResolvedValue([makeLiq('DRAFT')]);
    mockLiquidationCount.mockResolvedValue(1);

    const res = await service.findAll(TENANT, { page: 1, limit: 10 });

    expect(res.data).toHaveLength(1);
    expect(res.meta).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
    expect(mockLiquidationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT },
        skip: 0,
        take: 10,
      }),
    );
  });

  it('findAll: aplica filtros de status y empleadoId', async () => {
    mockLiquidationFindMany.mockResolvedValue([]);
    mockLiquidationCount.mockResolvedValue(0);

    await service.findAll(TENANT, {
      page: 2,
      limit: 5,
      status: 'PAID',
      empleadoId: 'emp-999',
    });

    expect(mockLiquidationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT, status: 'PAID', empleadoId: 'emp-999' },
        skip: 5,
        take: 5,
      }),
    );
  });

  // ── findOne ──────────────────────────────────────────────────────────────────

  it('findOne: devuelve la liquidación con conceptos', async () => {
    mockLiquidationFindFirst.mockResolvedValue(makeLiq('APPROVED'));

    const res = await service.findOne(TENANT, LIQ_ID);

    expect(res.status).toBe('APPROVED');
    expect(mockLiquidationFindFirst).toHaveBeenCalledWith({
      where: { id: LIQ_ID, tenantId: TENANT },
      include: { concepts: true },
    });
  });

  it('findOne: inexistente o de otro tenant → NotFoundException', async () => {
    mockLiquidationFindFirst.mockResolvedValue(null);

    await expect(service.findOne('otro-tenant', LIQ_ID)).rejects.toThrow(
      NotFoundException,
    );
  });
});
