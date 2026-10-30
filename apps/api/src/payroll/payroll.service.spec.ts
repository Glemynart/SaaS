/**
 * PayrollService — máquina de estados del ProcesoNómina (ADR-002 §6, U1).
 *
 * Cubre exclusivamente lo que U1 introdujo: transiciones de estado,
 * concurrencia optimista, auditoría transaccional fail-secure, el alias
 * legado `close` y las guardas de estado de generate/recalculate. La
 * corrección aritmética del motor de cálculo ya está cubierta por
 * payroll-calculator.spec.ts y payroll-mapper.spec.ts — no se repite aquí.
 */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PayrollCorrectionStatus } from '@prisma/client';
import {
  PayrollCorrectionCalculationInput,
  PayrollCorrectionIntentKind,
} from './corrections/payroll-correction.types';
import { PayrollService } from './payroll.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../accounting/ledger/ledger.service';
import { PayrollAccountingPreflightService } from './accounting-preflight/payroll-accounting-preflight.service';
import { PAYROLL_ACCOUNTING_REQUIRED_ROLES } from './accounting-preflight/payroll-accounting-preflight.service';
import { Test } from '@nestjs/testing';
import { calculate } from './calculator/payroll-calculator';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPayrollPeriodFindFirst = jest.fn();
const mockPayrollPeriodUpdateMany = jest.fn();
const mockPayrollPeriodFindFirstOrThrow = jest.fn();
const mockPayrollRunFindMany = jest.fn();
const mockPayrollRunFindFirst = jest.fn();
const mockPayrollRunCreate = jest.fn();
const mockPayrollRunDeleteMany = jest.fn();
const mockPayrollConceptDeleteMany = jest.fn();
const mockParametroLegalFindFirst = jest.fn();
const mockTenantFindUnique = jest.fn();
const mockEmpleadoFindMany = jest.fn();
const mockPayrollNoveltyFindMany = jest.fn();
const mockContratoFindMany = jest.fn();
const mockCentroCostoFindMany = jest.fn();
const mockPayrollSnapshotCreate = jest.fn();
const mockPayrollSnapshotFindMany = jest.fn();
const mockPayrollCorrectionCreate = jest.fn();
const mockPayrollCorrectionFindMany = jest.fn();
const mockPayrollCorrectionFindFirst = jest.fn();
const mockPayrollCorrectionFindFirstOrThrow = jest.fn();
const mockPayrollCorrectionUpdateMany = jest.fn();
const mockPayrollBlockFindMany = jest.fn();
const mockPayrollBlockFindFirst = jest.fn();
const mockPayrollBlockCreate = jest.fn();
const mockPayrollBlockUpdate = jest.fn();
const mockComprobanteFindFirst = jest.fn();
const mockComprobanteFindMany = jest.fn();
const mockCuentaSistemaMapFindMany = jest.fn();
const mockPeriodoContableFindFirst = jest.fn();
const mockTipoComprobanteFindFirst = jest.fn();

const mockPrisma = {
  payrollPeriod: {
    findFirst: mockPayrollPeriodFindFirst,
    updateMany: mockPayrollPeriodUpdateMany,
    findFirstOrThrow: mockPayrollPeriodFindFirstOrThrow,
  },
  payrollRun: {
    findMany: mockPayrollRunFindMany,
    findFirst: mockPayrollRunFindFirst,
    create: mockPayrollRunCreate,
    deleteMany: mockPayrollRunDeleteMany,
  },
  payrollConcept: { deleteMany: mockPayrollConceptDeleteMany },
  parametroLegalNomina: { findFirst: mockParametroLegalFindFirst },
  tenant: { findUnique: mockTenantFindUnique },
  empleado: { findMany: mockEmpleadoFindMany },
  payrollNovelty: { findMany: mockPayrollNoveltyFindMany },
  contrato: { findMany: mockContratoFindMany },
  centroCosto: { findMany: mockCentroCostoFindMany },
  payrollSnapshot: {
    create: mockPayrollSnapshotCreate,
    findMany: mockPayrollSnapshotFindMany,
  },
  payrollCorrection: {
    create: mockPayrollCorrectionCreate,
    findMany: mockPayrollCorrectionFindMany,
    findFirst: mockPayrollCorrectionFindFirst,
    findFirstOrThrow: mockPayrollCorrectionFindFirstOrThrow,
    updateMany: mockPayrollCorrectionUpdateMany,
  },
  payrollBlock: {
    findMany: mockPayrollBlockFindMany,
    findFirst: mockPayrollBlockFindFirst,
    create: mockPayrollBlockCreate,
    update: mockPayrollBlockUpdate,
  },
  comprobanteContable: {
    findFirst: mockComprobanteFindFirst,
    findMany: mockComprobanteFindMany,
  },
  cuentaSistemaMap: { findMany: mockCuentaSistemaMapFindMany },
  periodoContable: { findFirst: mockPeriodoContableFindFirst },
  tipoComprobante: { findFirst: mockTipoComprobanteFindFirst },
  $transaction: jest.fn(),
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };
const mockTenantPrisma = {
  execute: jest.fn((work: (client: typeof mockPrisma) => unknown) =>
    work(mockPrisma),
  ),
};
const mockLedger = { registrarComprobante: jest.fn() };
const mockPreflight = { validate: jest.fn() };

const TENANT = 'tenant-1';
const USER = 'user-1';
const PERIOD_ID = 'period-1';

function makePeriod(status: string, overrides: Record<string, unknown> = {}) {
  const approvalMetadata =
    status === 'APROBADA'
      ? {
          aprobadoPorId: 'approver-1',
          aprobadoEn: new Date('2026-02-01T10:00:00.000Z'),
        }
      : {
          aprobadoPorId: null,
          aprobadoEn: null,
        };

  return {
    id: PERIOD_ID,
    tenantId: TENANT,
    nombre: 'Enero 2026',
    fechaInicio: new Date('2026-01-01'),
    fechaFin: new Date('2026-01-31'),
    status,
    ...approvalMetadata,
    ...overrides,
  };
}

function correctionIntents() {
  return [
    {
      kind: PayrollCorrectionIntentKind.SET_CALCULATION_INPUT,
      snapshotId: 'snapshot-1',
      input: PayrollCorrectionCalculationInput.BONUS,
      targetAmount: 50_000,
    },
  ];
}

function makeCorrectionSnapshot() {
  const legal = makeLegalParam();
  const result = calculate({
    salarioBase: 2_000_000,
    salarioIntegral: false,
    claseRiesgoArl: 1,
    aportesExonerados: false,
    legalParams: {
      smmlv: legal.smmlv,
      auxilioTransporte: legal.auxilioTransporte,
      topeIbcMinSmmlv: legal.topeIbcMinSmmlv,
      topeIbcMaxSmmlv: legal.topeIbcMaxSmmlv,
      umbralAuxilioSmmlv: legal.umbralAuxilioSmmlv,
      umbralExoneracionSmmlv: legal.umbralExoneracionSmmlv,
      pctSaludEmpleado: legal.pctSaludEmpleado,
      pctPensionEmpleado: legal.pctPensionEmpleado,
      pctSaludEmpleador: legal.pctSaludEmpleador,
      pctPensionEmpleador: legal.pctPensionEmpleador,
      pctCaja: legal.pctCaja,
      pctIcbf: legal.pctIcbf,
      pctSena: legal.pctSena,
      arlPorClase: {
        1: legal.arlClaseI,
        2: legal.arlClaseII,
        3: legal.arlClaseIII,
        4: legal.arlClaseIV,
        5: legal.arlClaseV,
      },
      factorProvPrima: legal.factorProvPrima,
      factorProvCesantias: legal.factorProvCesantias,
      factorProvIntCesantias: legal.factorProvIntCesantias,
      factorProvVacaciones: legal.factorProvVacaciones,
      fspTramos: legal.fspTramos,
    },
    novelties: [],
  });
  return {
    id: 'snapshot-1',
    tenantId: TENANT,
    payrollPeriodId: PERIOD_ID,
    employeeId: 'emp-1',
    centroCostoId: 'cc-1',
    payload: {
      employee: { salarioBaseUsado: 2_000_000, salarioIntegralUsado: false },
      contract: { claseRiesgoArlUsada: 1 },
      companyPolicy: { aportesExonerados: false },
      legalParameters: makeCalculationTrace().legalParameters,
      concepts: result.concepts,
    },
  };
}

/** Fila mínima de ParametroLegalNomina para que toSnapshot() no falle. */
function makeLegalParam() {
  return {
    id: 'param-1',
    tenantId: null,
    vigenciaDesde: new Date('2026-01-01'),
    vigenciaHasta: null,
    anio: 2026,
    smmlv: 1_423_500,
    auxilioTransporte: 202_897,
    uvt: 49_799,
    topeIbcMinSmmlv: 1,
    topeIbcMaxSmmlv: 25,
    umbralAuxilioSmmlv: 2,
    umbralExoneracionSmmlv: 10,
    pctSaludEmpleado: 0.04,
    pctPensionEmpleado: 0.04,
    pctSaludEmpleador: 0.085,
    pctPensionEmpleador: 0.12,
    pctCaja: 0.04,
    pctIcbf: 0.03,
    pctSena: 0.02,
    arlClaseI: 0.00522,
    arlClaseII: 0.01044,
    arlClaseIII: 0.02436,
    arlClaseIV: 0.0435,
    arlClaseV: 0.0696,
    factorProvPrima: 0.0833,
    factorProvCesantias: 0.0833,
    factorProvIntCesantias: 0.01,
    factorProvVacaciones: 0.0417,
    fspTramos: [],
    fuente: 'Decreto test',
    notas: null,
  };
}

function makeCalculationTrace(overrides: Record<string, unknown> = {}) {
  return {
    traceVersion: 1,
    period: {
      nombre: 'Enero 2026',
      fechaInicio: new Date('2026-01-01').toISOString(),
      fechaFin: new Date('2026-01-31').toISOString(),
    },
    employee: {
      salarioIntegralUsado: false,
    },
    contract: {
      contratoId: 'contrato-1',
      estado: 'VIGENTE',
      fechaInicio: new Date('2025-01-01').toISOString(),
      fechaFin: null,
      salarioContrato: 2_000_000,
      sedeId: 'sede-1',
      claseRiesgoArlOriginal: 1,
      claseRiesgoArlUsada: 1,
      fallbackUsado: false,
    },
    costCenter: {
      codigo: 'SEDE-1',
      nombre: 'Sede norte',
      sedeId: 'sede-1',
    },
    companyPolicy: { aportesExonerados: false },
    legalParameters: {
      tenantId: null,
      vigenciaDesde: new Date('2026-01-01').toISOString(),
      vigenciaHasta: null,
      anio: 2026,
      smmlv: 1_423_500,
      auxilioTransporte: 202_897,
      uvt: 49_799,
      topes: {
        topeIbcMinSmmlv: 1,
        topeIbcMaxSmmlv: 25,
        umbralAuxilioSmmlv: 2,
        umbralExoneracionSmmlv: 10,
      },
      tarifasEmpleado: {
        pctSaludEmpleado: 0.04,
        pctPensionEmpleado: 0.04,
      },
      tarifasEmpleador: {
        pctSaludEmpleador: 0.085,
        pctPensionEmpleador: 0.12,
        pctCaja: 0.04,
        pctIcbf: 0.03,
        pctSena: 0.02,
      },
      tarifasArl: {
        arlClaseI: 0.00522,
        arlClaseII: 0.01044,
        arlClaseIII: 0.02436,
        arlClaseIV: 0.0435,
        arlClaseV: 0.0696,
      },
      factoresProvision: {
        factorProvPrima: 0.0833,
        factorProvCesantias: 0.0833,
        factorProvIntCesantias: 0.01,
        factorProvVacaciones: 0.0417,
      },
      fspTramos: [],
      fuente: 'Decreto test',
      notas: null,
    },
    novelties: [],
    calculationEvidence: { politicaRedondeoAplicada: 'PESO_ENTERO' },
    ...overrides,
  };
}

function makeRunForSnapshot() {
  return {
    id: 'run-1',
    tenantId: TENANT,
    payrollPeriodId: PERIOD_ID,
    employeeId: 'emp-1',
    centroCostoId: 'cc-1',
    parametroLegalId: 'param-1',
    totalDevengos: 2_202_897,
    totalDeducciones: 160_000,
    netoPagar: 2_042_897,
    salarioBaseSnapshot: 2_000_000,
    ibc: 2_000_000,
    auxilioTransporte: 202_897,
    totalAportesPatronales: 589_440,
    totalProvisiones: 436_640,
    costoTotalEmpleador: 2_792_337,
    calculationTrace: makeCalculationTrace(),
    concepts: [
      {
        id: 'concept-1',
        createdAt: new Date('2026-01-01'),
        payrollRunId: 'run-1',
        tipo: 'EARNING',
        nombre: 'Salario base',
        valor: 2_000_000,
        codigo: 'SALARIO_BASE',
        base: null,
        factor: null,
      },
      {
        id: 'concept-2',
        createdAt: new Date('2026-01-01'),
        payrollRunId: 'run-1',
        tipo: 'DEDUCTION',
        nombre: 'Salud (4%)',
        valor: 80_000,
        codigo: 'SALUD_EMP',
        base: 2_000_000,
        factor: 0.04,
      },
    ],
  };
}

function setupPayrollGeneration(
  overrides: {
    contratoSedeId?: string | null;
    centrosCosto?: Array<{
      id: string;
      codigo: string;
      nombre: string;
      sedeId: string | null;
    }>;
  } = {},
) {
  mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('BORRADOR'));
  mockParametroLegalFindFirst.mockResolvedValue(makeLegalParam());
  mockTenantFindUnique.mockResolvedValue({ aportesExonerados: false });
  mockEmpleadoFindMany.mockResolvedValue([
    {
      id: 'emp-1',
      salario: 2_000_000,
      salarioIntegral: false,
    },
  ]);
  mockPayrollNoveltyFindMany.mockResolvedValue([]);
  mockContratoFindMany.mockResolvedValue([
    {
      id: 'contrato-1',
      empleadoId: 'emp-1',
      estado: 'VIGENTE',
      fechaInicio: new Date('2025-01-01'),
      fechaFin: null,
      sedeId: overrides.contratoSedeId ?? 'sede-1',
      salario: 2_000_000,
      claseRiesgoArl: 1,
    },
  ]);
  mockCentroCostoFindMany.mockResolvedValue(
    overrides.centrosCosto ?? [
      {
        id: 'cc-1',
        codigo: 'SEDE-1',
        nombre: 'Sede norte',
        sedeId: 'sede-1',
      },
    ],
  );
  mockPayrollRunFindFirst.mockResolvedValue(null);
  mockPayrollRunCreate.mockImplementation(async ({ data }) => ({
    id: 'run-1',
    ...data,
  }));
  mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });
}

describe('PayrollService — máquina de estados del ProcesoNómina (U1)', () => {
  let service: PayrollService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAudit.log.mockResolvedValue(undefined);
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma),
    );
    mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('APROBADA'));
    mockPayrollPeriodFindFirstOrThrow.mockImplementation(async () =>
      makePeriod('APROBADA'),
    );
    mockPayrollRunFindMany.mockResolvedValue([]);
    mockPayrollNoveltyFindMany.mockResolvedValue([]);
    mockContratoFindMany.mockResolvedValue([]);
    mockEmpleadoFindMany.mockResolvedValue([]);
    mockParametroLegalFindFirst.mockResolvedValue(makeLegalParam());
    mockTenantFindUnique.mockResolvedValue({ aportesExonerados: false });
    mockPayrollSnapshotCreate.mockResolvedValue({});
    mockPayrollSnapshotFindMany.mockResolvedValue([makeCorrectionSnapshot()]);
    mockPayrollCorrectionCreate.mockResolvedValue({});
    mockPayrollCorrectionFindMany.mockResolvedValue([]);
    mockPayrollCorrectionFindFirst.mockResolvedValue(null);
    mockPayrollCorrectionFindFirstOrThrow.mockResolvedValue({});
    mockPayrollCorrectionUpdateMany.mockResolvedValue({ count: 1 });
    mockPayrollBlockFindMany.mockResolvedValue([]);
    mockPayrollBlockFindFirst.mockResolvedValue(null);
    mockPayrollBlockCreate.mockResolvedValue({});
    mockPayrollBlockUpdate.mockResolvedValue({});
    mockComprobanteFindFirst.mockResolvedValue(null);
    mockComprobanteFindMany.mockResolvedValue([]);
    mockCuentaSistemaMapFindMany.mockResolvedValue([]);
    mockPeriodoContableFindFirst.mockResolvedValue({ id: 'accounting-period' });
    mockTipoComprobanteFindFirst.mockResolvedValue({ id: 'nom-type' });
    mockLedger.registrarComprobante.mockResolvedValue({ id: 'voucher-1' });
    mockPreflight.validate.mockResolvedValue({ status: 'OK', validations: [] });
    mockTenantPrisma.execute.mockImplementation((work) => work(mockPrisma));

    const module = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TenantPrismaService, useValue: mockTenantPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LedgerService, useValue: mockLedger },
        { provide: PayrollAccountingPreflightService, useValue: mockPreflight },
      ],
    }).compile();

    service = module.get(PayrollService);
  });

  describe('bloqueos persistidos', () => {
    it('lista los bloqueos de un período con estado y trazabilidad de exclusión', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CALCULADA'));
      mockPayrollBlockFindMany.mockResolvedValue([
        {
          id: 'block-1',
          status: 'ACTIVE',
          code: 'UNSUPPORTED_INTEGRAL_SALARY',
          employeeId: 'emp-1',
        },
      ]);

      const result = await service.findPeriodBlocks(TENANT, PERIOD_ID);

      expect(result).toEqual([
        {
          id: 'block-1',
          status: 'ACTIVE',
          code: 'UNSUPPORTED_INTEGRAL_SALARY',
          employeeId: 'emp-1',
        },
      ]);
      expect(mockPayrollBlockFindMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT, payrollPeriodId: PERIOD_ID },
        include: {
          employee: {
            select: {
              id: true,
              primerNombre: true,
              segundoNombre: true,
              primerApellido: true,
              segundoApellido: true,
              cedula: true,
              cargo: true,
            },
          },
          excludedBy: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
            },
          },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      });
    });

    it('rechaza listar bloqueos de un período inexistente', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(null);

      await expect(service.findPeriodBlocks(TENANT, PERIOD_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPayrollBlockFindMany).not.toHaveBeenCalled();
    });

    it('excluye un bloqueo activo con actor, fecha y motivo', async () => {
      const block = {
        id: 'block-1',
        tenantId: TENANT,
        payrollPeriodId: PERIOD_ID,
        employeeId: 'emp-1',
        code: 'UNSUPPORTED_INTEGRAL_SALARY',
        message: 'Salario integral fuera de v1',
        status: 'ACTIVE',
      };
      mockPayrollBlockFindFirst.mockResolvedValue(block);
      mockPayrollBlockUpdate.mockResolvedValue({
        ...block,
        status: 'EXCLUDED',
        excludedById: USER,
      });

      const result = await service.excludeBlock(
        TENANT,
        USER,
        'block-1',
        'Revisado manualmente',
      );

      expect(result).toMatchObject({
        id: 'block-1',
        status: 'EXCLUDED',
        excludedById: USER,
      });
      expect(mockPayrollBlockUpdate).toHaveBeenCalledWith({
        where: { id: 'block-1' },
        data: {
          status: 'EXCLUDED',
          excludedAt: expect.any(Date),
          excludedById: USER,
          exclusionReason: 'Revisado manualmente',
        },
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYROLL_BLOCK_EXCLUDED',
          entityType: 'PayrollBlock',
          entityId: 'block-1',
          metadata: expect.objectContaining({
            payrollPeriodId: PERIOD_ID,
            employeeId: 'emp-1',
            code: 'UNSUPPORTED_INTEGRAL_SALARY',
            motivo: 'Revisado manualmente',
          }),
        }),
        mockPrisma,
      );
    });

    it('no excluye un bloqueo ya resuelto', async () => {
      mockPayrollBlockFindFirst.mockResolvedValue({
        id: 'block-1',
        tenantId: TENANT,
        payrollPeriodId: PERIOD_ID,
        employeeId: 'emp-1',
        code: 'UNSUPPORTED_INTEGRAL_SALARY',
        message: 'Salario integral fuera de v1',
        status: 'RESOLVED',
      });

      await expect(
        service.excludeBlock(TENANT, USER, 'block-1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockPayrollBlockUpdate).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('mantiene idempotente la exclusión cuando el bloqueo ya estaba excluido', async () => {
      const block = {
        id: 'block-1',
        tenantId: TENANT,
        payrollPeriodId: PERIOD_ID,
        employeeId: 'emp-1',
        code: 'UNSUPPORTED_INTEGRAL_SALARY',
        message: 'Salario integral fuera de v1',
        status: 'EXCLUDED',
      };
      mockPayrollBlockFindFirst.mockResolvedValue(block);

      await expect(
        service.excludeBlock(TENANT, USER, 'block-1'),
      ).resolves.toEqual(block);
      expect(mockPayrollBlockUpdate).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });
  });

  describe('correcciones post-aprobacion — Unidad A', () => {
    it('crea una correccion BORRADOR sobre un periodo APROBADA', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('APROBADA'));
      mockPayrollCorrectionCreate.mockResolvedValue({
        id: 'corr-1',
        tenantId: TENANT,
        payrollPeriodId: PERIOD_ID,
        status: PayrollCorrectionStatus.BORRADOR,
        descripcion: 'Falta novedad del periodo',
      });

      const result = await service.createCorrection(TENANT, USER, PERIOD_ID, {
        descripcion: '  Falta novedad del periodo  ',
        intents: correctionIntents(),
      });

      expect(result).toMatchObject({
        id: 'corr-1',
        payrollPeriodId: PERIOD_ID,
        status: PayrollCorrectionStatus.BORRADOR,
        descripcion: 'Falta novedad del periodo',
      });
      expect(mockPayrollCorrectionCreate).toHaveBeenCalledWith({
        data: {
          tenantId: TENANT,
          payrollPeriodId: PERIOD_ID,
          status: PayrollCorrectionStatus.BORRADOR,
          descripcion: 'Falta novedad del periodo',
          intentVersion: 1,
          intent: expect.objectContaining({
            version: 1,
            intents: expect.any(Array),
          }),
        },
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          userId: USER,
          action: 'PAYROLL_CORRECTION_CREATED',
          entityType: 'PayrollCorrection',
          entityId: 'corr-1',
          metadata: expect.objectContaining({
            payrollPeriodId: PERIOD_ID,
            periodName: 'Enero 2026',
            status: PayrollCorrectionStatus.BORRADOR,
          }),
        }),
        mockPrisma,
      );
    });

    it('rechaza crear correcciones sobre un periodo no aprobado', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CALCULADA'));

      await expect(
        service.createCorrection(TENANT, USER, PERIOD_ID, {
          descripcion: 'Ajuste solicitado',
          intents: correctionIntents(),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPayrollCorrectionCreate).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('rechaza crear correcciones si falta la aprobacion original auditable', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(
        makePeriod('APROBADA', {
          aprobadoPorId: null,
          aprobadoEn: null,
        }),
      );

      await expect(
        service.createCorrection(TENANT, USER, PERIOD_ID, {
          descripcion: 'Ajuste solicitado',
          intents: correctionIntents(),
        }),
      ).rejects.toThrow(ConflictException);
      expect(mockPayrollCorrectionCreate).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('rechaza descripcion vacia tras trim', async () => {
      await expect(
        service.createCorrection(TENANT, USER, PERIOD_ID, {
          descripcion: '   ',
          intents: correctionIntents(),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPayrollPeriodFindFirst).not.toHaveBeenCalled();
    });

    it('valida el centro de costo destino de una intención de movimiento', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('APROBADA'));
      mockCentroCostoFindMany.mockResolvedValueOnce([]);

      await expect(
        service.createCorrection(TENANT, USER, PERIOD_ID, {
          descripcion: 'Reasignar centro de costo',
          intents: [
            {
              kind: PayrollCorrectionIntentKind.MOVE_COST_CENTER,
              snapshotId: 'snapshot-1',
              targetCostCenterId: 'cc-inactivo',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPayrollCorrectionCreate).not.toHaveBeenCalled();
    });

    it('lista correcciones de un periodo existente sin tocar runs ni snapshots', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('APROBADA'));
      mockPayrollCorrectionFindMany.mockResolvedValue([
        {
          id: 'corr-1',
          payrollPeriodId: PERIOD_ID,
          status: PayrollCorrectionStatus.BORRADOR,
          descripcion: 'Falta novedad del periodo',
        },
      ]);

      const result = await service.findPeriodCorrections(TENANT, PERIOD_ID);

      expect(result).toEqual([
        {
          id: 'corr-1',
          payrollPeriodId: PERIOD_ID,
          status: PayrollCorrectionStatus.BORRADOR,
          descripcion: 'Falta novedad del periodo',
          accountingVoucher: null,
        },
      ]);
      expect(mockPayrollCorrectionFindMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT, payrollPeriodId: PERIOD_ID },
        orderBy: [{ createdAt: 'desc' }],
      });
      expect(mockPayrollRunFindMany).not.toHaveBeenCalled();
      expect(mockPayrollSnapshotCreate).not.toHaveBeenCalled();
    });

    it('adjunta el ajuste contable de la misma corrección y tenant', async () => {
      const fecha = new Date('2026-03-10T00:00:00.000Z');
      mockPayrollPeriodFindFirst.mockResolvedValue(
        makePeriod('CAUSADA', {
          aprobadoPorId: 'approver-1',
          aprobadoEn: new Date('2026-02-01T10:00:00.000Z'),
        }),
      );
      mockPayrollCorrectionFindMany.mockResolvedValue([
        {
          id: 'corr-1',
          payrollPeriodId: PERIOD_ID,
          status: PayrollCorrectionStatus.APROBADA,
          descripcion: 'Ajuste de salario',
        },
      ]);
      mockComprobanteFindMany.mockResolvedValue([
        {
          id: 'voucher-adjustment',
          tenantId: TENANT,
          origenId: 'corr-1',
          numero: 43,
          fecha,
          concepto: 'Ajuste nómina: Ajuste de salario',
          estado: 'CONTABILIZADO',
          totalDebito: 100_000,
          totalCredito: 100_000,
          reversos: [],
          movimientos: [],
        },
      ]);

      const result = await service.findPeriodCorrections(TENANT, PERIOD_ID);

      expect(mockComprobanteFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: TENANT,
            origenTipo: 'PAYROLL_CORRECTION',
            origenId: { in: ['corr-1'] },
            origenEvento: 'AJUSTE',
          },
        }),
      );
      expect(result[0].accountingVoucher).toEqual({
        id: 'voucher-adjustment',
        numero: 43,
        fecha,
        concepto: 'Ajuste nómina: Ajuste de salario',
        estado: 'CONTABILIZADO',
        reversado: false,
        vigente: true,
        totalDebito: 100_000,
        totalCredito: 100_000,
        movimientos: [],
      });
    });

    it('marca como revertido el comprobante de una corrección contabilizada', async () => {
      const fecha = new Date('2026-03-10T00:00:00.000Z');
      mockPayrollPeriodFindFirst.mockResolvedValue(
        makePeriod('CAUSADA', {
          aprobadoPorId: 'approver-1',
          aprobadoEn: new Date('2026-02-01T10:00:00.000Z'),
        }),
      );
      mockPayrollCorrectionFindMany.mockResolvedValue([
        {
          id: 'corr-1',
          payrollPeriodId: PERIOD_ID,
          status: PayrollCorrectionStatus.APROBADA,
          descripcion: 'Ajuste de salario',
        },
      ]);
      mockComprobanteFindMany.mockResolvedValue([
        {
          id: 'voucher-adjustment',
          tenantId: TENANT,
          origenId: 'corr-1',
          numero: 43,
          fecha,
          concepto: 'Ajuste nómina: Ajuste de salario',
          estado: 'CONTABILIZADO',
          totalDebito: 100_000,
          totalCredito: 100_000,
          reversos: [
            {
              id: 'voucher-reversal',
              tenantId: TENANT,
              estado: 'CONTABILIZADO',
            },
          ],
          movimientos: [],
        },
      ]);

      const result = await service.findPeriodCorrections(TENANT, PERIOD_ID);

      expect(result[0].accountingVoucher).toEqual({
        id: 'voucher-adjustment',
        numero: 43,
        fecha,
        concepto: 'Ajuste nómina: Ajuste de salario',
        estado: 'CONTABILIZADO',
        reversado: true,
        vigente: false,
        totalDebito: 100_000,
        totalCredito: 100_000,
        movimientos: [],
      });
    });

    it('rechaza listar correcciones de un periodo inexistente', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(null);

      await expect(
        service.findPeriodCorrections(TENANT, PERIOD_ID),
      ).rejects.toThrow(NotFoundException);
      expect(mockPayrollCorrectionFindMany).not.toHaveBeenCalled();
    });

    it('rechaza listar correcciones si el periodo no conserva una aprobacion auditable', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(
        makePeriod('APROBADA', {
          aprobadoPorId: null,
          aprobadoEn: null,
        }),
      );

      await expect(
        service.findPeriodCorrections(TENANT, PERIOD_ID),
      ).rejects.toThrow(ConflictException);
      expect(mockPayrollCorrectionFindMany).not.toHaveBeenCalled();
    });
  });

  describe('correcciones post-aprobacion — Unidad B', () => {
    function makeCorrection(
      status: PayrollCorrectionStatus,
      overrides: Record<string, unknown> = {},
    ) {
      return {
        id: 'corr-1',
        tenantId: TENANT,
        payrollPeriodId: PERIOD_ID,
        status,
        descripcion: 'Falta novedad del periodo',
        intentVersion: 1,
        intent: {
          version: 1,
          intents: [
            {
              id: 'intent-1',
              kind: PayrollCorrectionIntentKind.SET_CALCULATION_INPUT,
              snapshotId: 'snapshot-1',
              input: PayrollCorrectionCalculationInput.BONUS,
              targetAmount: 50_000,
            },
          ],
        },
        materialization: null,
        ...overrides,
      };
    }

    it('BORRADOR → EN_REVISION: transición válida y auditada', async () => {
      mockPayrollCorrectionFindFirst.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.BORRADOR),
      );
      mockPayrollCorrectionFindFirstOrThrow.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.EN_REVISION),
      );

      const result = await service.enviarCorrectionARevision(
        TENANT,
        USER,
        'corr-1',
      );

      expect(result).toMatchObject({
        status: PayrollCorrectionStatus.EN_REVISION,
      });
      expect(mockPayrollCorrectionUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'corr-1',
          tenantId: TENANT,
          payrollPeriodId: PERIOD_ID,
          status: PayrollCorrectionStatus.BORRADOR,
        },
        data: { status: PayrollCorrectionStatus.EN_REVISION },
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYROLL_CORRECTION_SENT_TO_REVIEW',
          entityType: 'PayrollCorrection',
          entityId: 'corr-1',
          metadata: expect.objectContaining({
            payrollPeriodId: PERIOD_ID,
            from: PayrollCorrectionStatus.BORRADOR,
            to: PayrollCorrectionStatus.EN_REVISION,
          }),
        }),
        mockPrisma,
      );
    });

    it('EN_REVISION → APROBADA: transición válida y no toca runs ni snapshots', async () => {
      mockPayrollCorrectionFindFirst.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.EN_REVISION),
      );
      mockPayrollCorrectionFindFirstOrThrow.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.APROBADA),
      );

      const result = await service.aprobarCorrection(TENANT, USER, 'corr-1');

      expect(result).toMatchObject({
        status: PayrollCorrectionStatus.APROBADA,
      });
      expect(mockPayrollRunCreate).not.toHaveBeenCalled();
      expect(mockPayrollSnapshotCreate).not.toHaveBeenCalled();
      expect(mockPayrollPeriodUpdateMany).not.toHaveBeenCalled();
    });

    it('materializa únicamente deltas normalizados y referencias al aprobar', async () => {
      mockPayrollCorrectionFindFirst.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.EN_REVISION),
      );
      mockPayrollCorrectionFindMany.mockResolvedValueOnce([]);
      mockPayrollCorrectionFindFirstOrThrow.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.APROBADA),
      );

      await service.aprobarCorrection(TENANT, USER, 'corr-1');

      const update = mockPayrollCorrectionUpdateMany.mock.calls.at(-1)?.[0];
      const materialization = update.data.materialization;
      expect(update).toMatchObject({
        where: expect.objectContaining({
          id: 'corr-1',
          status: PayrollCorrectionStatus.EN_REVISION,
        }),
        data: expect.objectContaining({
          status: PayrollCorrectionStatus.APROBADA,
          materializationVersion: 1,
        }),
      });
      expect(materialization).toMatchObject({
        version: 1,
        snapshotIds: ['snapshot-1'],
        approvedCorrectionIds: [],
        entries: expect.arrayContaining([
          expect.objectContaining({
            snapshotId: 'snapshot-1',
            employeeId: 'emp-1',
            concept: expect.objectContaining({ codigo: 'BONUS' }),
            delta: 50_000,
          }),
        ]),
      });
      expect(JSON.stringify(materialization)).not.toContain('before');
      expect(JSON.stringify(materialization)).not.toContain('after');
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'Serializable' }),
      );
    });

    it('reconstruye una corrección encadenada desde materializaciones aprobadas', async () => {
      mockPayrollCorrectionFindFirst.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.EN_REVISION, { id: 'corr-1' }),
      );
      mockPayrollCorrectionFindMany.mockResolvedValueOnce([]);
      mockPayrollCorrectionFindFirstOrThrow.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.APROBADA, { id: 'corr-1' }),
      );
      await service.aprobarCorrection(TENANT, USER, 'corr-1');
      const firstMaterialization =
        mockPayrollCorrectionUpdateMany.mock.calls.at(-1)?.[0].data
          .materialization;

      mockPayrollCorrectionFindFirst.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.EN_REVISION, {
          id: 'corr-2',
          intent: {
            version: 1,
            intents: [
              {
                id: 'intent-2',
                kind: PayrollCorrectionIntentKind.SET_CALCULATION_INPUT,
                snapshotId: 'snapshot-1',
                input: PayrollCorrectionCalculationInput.BONUS,
                targetAmount: 75_000,
              },
            ],
          },
        }),
      );
      mockPayrollCorrectionFindMany.mockResolvedValueOnce([
        {
          id: 'corr-1',
          materializationVersion: 1,
          materialization: firstMaterialization,
          materializedAt: new Date('2026-02-01T10:00:00.000Z'),
          createdAt: new Date('2026-02-01T09:00:00.000Z'),
        },
      ]);
      mockPayrollCorrectionFindFirstOrThrow.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.APROBADA, { id: 'corr-2' }),
      );

      await service.aprobarCorrection(TENANT, USER, 'corr-2');

      const materialization =
        mockPayrollCorrectionUpdateMany.mock.calls.at(-1)?.[0].data
          .materialization;
      expect(materialization).toMatchObject({
        approvedCorrectionIds: ['corr-1'],
        entries: expect.arrayContaining([
          expect.objectContaining({
            concept: expect.objectContaining({ codigo: 'BONUS' }),
            delta: 25_000,
          }),
        ]),
      });
    });

    it('rechaza snapshots inexistentes o de otro tenant al aprobar', async () => {
      mockPayrollCorrectionFindFirst.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.EN_REVISION),
      );
      mockPayrollSnapshotFindMany.mockResolvedValueOnce([]);

      await expect(
        service.aprobarCorrection(TENANT, USER, 'corr-1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockPayrollCorrectionUpdateMany).not.toHaveBeenCalled();
    });

    it('rechaza una corrección que ya tiene materialización', async () => {
      mockPayrollCorrectionFindFirst.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.EN_REVISION, {
          materialization: { version: 1 },
        }),
      );

      await expect(
        service.aprobarCorrection(TENANT, USER, 'corr-1'),
      ).rejects.toThrow(ConflictException);
      expect(mockPayrollCorrectionUpdateMany).not.toHaveBeenCalled();
    });

    it('materializa una reasignación de centro de costo como débitos y créditos de delta', async () => {
      mockPayrollCorrectionFindFirst.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.EN_REVISION, {
          intent: {
            version: 1,
            intents: [
              {
                id: 'intent-move',
                kind: PayrollCorrectionIntentKind.MOVE_COST_CENTER,
                snapshotId: 'snapshot-1',
                targetCostCenterId: 'cc-2',
              },
            ],
          },
        }),
      );
      mockCentroCostoFindMany.mockResolvedValueOnce([{ id: 'cc-2' }]);
      mockPayrollCorrectionFindMany.mockResolvedValueOnce([]);
      mockPayrollCorrectionFindFirstOrThrow.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.APROBADA),
      );

      await service.aprobarCorrection(TENANT, USER, 'corr-1');

      const entries =
        mockPayrollCorrectionUpdateMany.mock.calls.at(-1)?.[0].data
          .materialization.entries;
      const salaryEntries = entries.filter(
        (entry: { concept: { codigo: string } }) =>
          entry.concept.codigo === 'SALARIO_BASE',
      );
      expect(salaryEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ centroCostoId: 'cc-1', delta: -2_000_000 }),
          expect.objectContaining({ centroCostoId: 'cc-2', delta: 2_000_000 }),
        ]),
      );
    });

    it('EN_REVISION → RECHAZADA: transición válida con motivo opcional', async () => {
      mockPayrollCorrectionFindFirst.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.EN_REVISION),
      );
      mockPayrollCorrectionFindFirstOrThrow.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.RECHAZADA),
      );

      await service.rechazarCorrection(
        TENANT,
        USER,
        'corr-1',
        'No procede la solicitud',
      );

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYROLL_CORRECTION_REJECTED',
          metadata: expect.objectContaining({
            from: PayrollCorrectionStatus.EN_REVISION,
            to: PayrollCorrectionStatus.RECHAZADA,
            motivo: 'No procede la solicitud',
          }),
        }),
        mockPrisma,
      );
    });

    it('BORRADOR → CANCELADA: transición válida', async () => {
      mockPayrollCorrectionFindFirst
        .mockResolvedValueOnce(makeCorrection(PayrollCorrectionStatus.BORRADOR))
        .mockResolvedValueOnce(
          makeCorrection(PayrollCorrectionStatus.BORRADOR),
        );
      mockPayrollCorrectionFindFirstOrThrow.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.CANCELADA),
      );

      const result = await service.cancelarCorrection(TENANT, USER, 'corr-1');

      expect(result).toMatchObject({
        status: PayrollCorrectionStatus.CANCELADA,
      });
      expect(mockPayrollCorrectionUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'corr-1',
          tenantId: TENANT,
          payrollPeriodId: PERIOD_ID,
          status: PayrollCorrectionStatus.BORRADOR,
        },
        data: { status: PayrollCorrectionStatus.CANCELADA },
      });
    });

    it('EN_REVISION → CANCELADA: transición válida', async () => {
      mockPayrollCorrectionFindFirst
        .mockResolvedValueOnce(
          makeCorrection(PayrollCorrectionStatus.EN_REVISION),
        )
        .mockResolvedValueOnce(
          makeCorrection(PayrollCorrectionStatus.EN_REVISION),
        );
      mockPayrollCorrectionFindFirstOrThrow.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.CANCELADA),
      );

      const result = await service.cancelarCorrection(TENANT, USER, 'corr-1');

      expect(result).toMatchObject({
        status: PayrollCorrectionStatus.CANCELADA,
      });
      expect(mockPayrollCorrectionUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'corr-1',
          tenantId: TENANT,
          payrollPeriodId: PERIOD_ID,
          status: PayrollCorrectionStatus.EN_REVISION,
        },
        data: { status: PayrollCorrectionStatus.CANCELADA },
      });
    });

    it('BORRADOR → APROBADA: transición inválida', async () => {
      mockPayrollCorrectionFindFirst.mockResolvedValue(
        makeCorrection(PayrollCorrectionStatus.BORRADOR),
      );

      await expect(
        service.aprobarCorrection(TENANT, USER, 'corr-1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockPayrollCorrectionUpdateMany).not.toHaveBeenCalled();
    });

    it('APROBADA es terminal: no puede cancelarse', async () => {
      mockPayrollCorrectionFindFirst.mockResolvedValue(
        makeCorrection(PayrollCorrectionStatus.APROBADA),
      );

      await expect(
        service.cancelarCorrection(TENANT, USER, 'corr-1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockPayrollCorrectionUpdateMany).not.toHaveBeenCalled();
    });

    it('corrección inexistente → NotFoundException', async () => {
      mockPayrollCorrectionFindFirst.mockResolvedValue(null);

      await expect(
        service.enviarCorrectionARevision(TENANT, USER, 'corr-1'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPayrollCorrectionUpdateMany).not.toHaveBeenCalled();
    });

    it('count === 0 en updateMany → ConflictException', async () => {
      mockPayrollCorrectionFindFirst.mockResolvedValue(
        makeCorrection(PayrollCorrectionStatus.EN_REVISION),
      );
      mockPayrollCorrectionUpdateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.aprobarCorrection(TENANT, USER, 'corr-1'),
      ).rejects.toThrow(ConflictException);
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('rechaza transiciones si el periodo vinculado pierde la aprobacion original auditable', async () => {
      mockPayrollCorrectionFindFirst.mockResolvedValue(
        makeCorrection(PayrollCorrectionStatus.EN_REVISION),
      );
      mockPayrollPeriodFindFirst.mockResolvedValue(
        makePeriod('APROBADA', {
          aprobadoPorId: null,
          aprobadoEn: null,
        }),
      );

      await expect(
        service.aprobarCorrection(TENANT, USER, 'corr-1'),
      ).rejects.toThrow(ConflictException);
      expect(mockPayrollCorrectionUpdateMany).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('fail-secure: si la auditoría falla, la transición no se considera exitosa', async () => {
      mockPayrollCorrectionFindFirst.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.EN_REVISION),
      );
      mockPayrollCorrectionFindFirstOrThrow.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.APROBADA),
      );
      mockAudit.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.aprobarCorrection(TENANT, USER, 'corr-1'),
      ).rejects.toThrow('audit down');
    });
  });

  // ── enviarARevision: CALCULADA → EN_REVISION ────────────────────────────────

  describe('enviarARevision', () => {
    it('CALCULADA → EN_REVISION: lee el estado real y lo usa en el WHERE del updateMany', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue({ status: 'CALCULADA' });
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });

      await service.enviarARevision(TENANT, USER, PERIOD_ID);

      expect(mockPayrollPeriodUpdateMany).toHaveBeenCalledWith({
        where: { id: PERIOD_ID, tenantId: TENANT, status: 'CALCULADA' },
        data: { status: 'EN_REVISION' },
      });
    });

    it('registra auditoría PAYROLL_PERIOD_SENT_TO_REVIEW dentro de la transacción', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue({ status: 'CALCULADA' });
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });

      await service.enviarARevision(TENANT, USER, PERIOD_ID);

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          userId: USER,
          action: 'PAYROLL_PERIOD_SENT_TO_REVIEW',
          entityType: 'PayrollPeriod',
          entityId: PERIOD_ID,
          metadata: expect.objectContaining({
            from: 'CALCULADA',
            to: 'EN_REVISION',
          }),
        }),
        mockPrisma,
      );
    });

    it('BORRADOR → EN_REVISION: transición inválida (salta CALCULADA), 400 antes de tocar la DB de escritura', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue({ status: 'BORRADOR' });

      await expect(
        service.enviarARevision(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow(BadRequestException);
      expect(mockPayrollPeriodUpdateMany).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('período inexistente → NotFoundException', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(null);

      await expect(
        service.enviarARevision(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('count === 0 (cambió entre la lectura y el commit) → ConflictException', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue({ status: 'CALCULADA' });
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.enviarARevision(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow(ConflictException);
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('fail-secure: si la auditoría falla, la transición no se considera exitosa', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue({ status: 'CALCULADA' });
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });
      mockAudit.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.enviarARevision(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow('audit down');
    });
  });

  // ── aprobar: EN_REVISION → APROBADA ──────────────────────────────────────────

  describe('aprobar', () => {
    it('EN_REVISION → APROBADA: fija aprobadoPorId/aprobadoEn', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('EN_REVISION'));
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });

      await service.aprobar(TENANT, USER, PERIOD_ID);

      expect(mockPayrollPeriodUpdateMany).toHaveBeenCalledWith({
        where: { id: PERIOD_ID, tenantId: TENANT, status: 'EN_REVISION' },
        data: {
          status: 'APROBADA',
          aprobadoPorId: USER,
          aprobadoEn: expect.any(Date),
        },
      });
    });

    it('registra auditoría PAYROLL_PERIOD_APPROVED', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('EN_REVISION'));
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });

      await service.aprobar(TENANT, USER, PERIOD_ID);

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYROLL_PERIOD_APPROVED' }),
        mockPrisma,
      );
    });

    it('APROBADA → APROBADA: no idempotente, transición inválida', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue({ status: 'APROBADA' });

      await expect(service.aprobar(TENANT, USER, PERIOD_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPayrollPeriodUpdateMany).not.toHaveBeenCalled();
    });

    it('BORRADOR → APROBADA: transición inválida (salta CALCULADA/EN_REVISION)', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue({ status: 'BORRADOR' });

      await expect(service.aprobar(TENANT, USER, PERIOD_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('bloqueos funcionales activos impiden aprobar antes de cambiar estado', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('EN_REVISION'));
      mockPayrollBlockFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ employeeId: 'emp-1' }]);
      mockEmpleadoFindMany.mockResolvedValue([
        { id: 'emp-1', salario: 15_000_000, salarioIntegral: true },
      ]);
      mockContratoFindMany.mockResolvedValue([
        {
          id: 'contrato-1',
          empleadoId: 'emp-1',
          estado: 'VIGENTE',
          fechaInicio: new Date('2025-01-01'),
          fechaFin: null,
          sedeId: 'sede-1',
          salario: 15_000_000,
          claseRiesgoArl: 1,
        },
      ]);

      await expect(service.aprobar(TENANT, USER, PERIOD_ID)).rejects.toThrow(
        'bloqueos funcionales activos',
      );
      expect(mockPayrollBlockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT,
          payrollPeriodId: PERIOD_ID,
          employeeId: 'emp-1',
          code: 'UNSUPPORTED_INTEGRAL_SALARY',
          status: 'ACTIVE',
        }),
      });
      expect(mockPayrollPeriodUpdateMany).not.toHaveBeenCalled();
      expect(mockPayrollSnapshotCreate).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('bloqueos excluidos no se reactivan durante la validación de aprobación', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('EN_REVISION'));
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });
      mockPayrollBlockFindMany
        .mockResolvedValueOnce([
          {
            id: 'block-1',
            employeeId: 'emp-1',
            code: 'UNSUPPORTED_INTEGRAL_SALARY',
            status: 'EXCLUDED',
          },
        ])
        .mockResolvedValueOnce([]);
      mockEmpleadoFindMany.mockResolvedValue([
        { id: 'emp-1', salario: 15_000_000, salarioIntegral: true },
      ]);
      mockContratoFindMany.mockResolvedValue([
        {
          id: 'contrato-1',
          empleadoId: 'emp-1',
          estado: 'VIGENTE',
          fechaInicio: new Date('2025-01-01'),
          fechaFin: null,
          sedeId: 'sede-1',
          salario: 15_000_000,
          claseRiesgoArl: 1,
        },
      ]);

      await service.aprobar(TENANT, USER, PERIOD_ID);

      expect(mockPayrollBlockUpdate).toHaveBeenCalledWith({
        where: { id: 'block-1' },
        data: {
          message: expect.stringContaining('Salario integral fuera de v1'),
        },
      });
      expect(mockPayrollPeriodUpdateMany).toHaveBeenCalledWith({
        where: { id: PERIOD_ID, tenantId: TENANT, status: 'EN_REVISION' },
        data: {
          status: 'APROBADA',
          aprobadoPorId: USER,
          aprobadoEn: expect.any(Date),
        },
      });
    });
  });

  // ── rechazar: EN_REVISION → CALCULADA ────────────────────────────────────────

  describe('snapshot inmutable U3', () => {
    it('crea snapshot inmutable al pasar a APROBADA', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('EN_REVISION'));
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });
      mockPayrollRunFindMany.mockResolvedValue([makeRunForSnapshot()]);
      mockPayrollNoveltyFindMany.mockResolvedValue([
        {
          id: 'novelty-1',
          tenantId: TENANT,
          payrollPeriodId: PERIOD_ID,
          employeeId: 'emp-1',
          tipo: 'BONUS',
          descripcion: 'Bono',
          fecha: new Date('2026-01-15'),
          valor: 100_000,
        },
      ]);
      mockContratoFindMany.mockResolvedValue([
        {
          id: 'contrato-1',
          empleadoId: 'emp-1',
          estado: 'VIGENTE',
          fechaInicio: new Date('2025-01-01'),
          fechaFin: null,
          sedeId: 'sede-1',
          salario: 2_000_000,
          claseRiesgoArl: 1,
        },
      ]);

      await service.aprobar(TENANT, USER, PERIOD_ID);

      expect(mockPayrollSnapshotCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT,
          payrollRunId: 'run-1',
          payrollPeriodId: PERIOD_ID,
          employeeId: 'emp-1',
          contratoId: 'contrato-1',
          parametroLegalId: 'param-1',
          centroCostoId: 'cc-1',
          aprobadoPorId: USER,
          estadoPeriodo: 'APROBADA',
          origen: 'APPROVE',
          payloadVersion: 1,
        }),
      });
    });

    it('congela parametros, insumos, conceptos y totales en el payload', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('EN_REVISION'));
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });
      mockPayrollRunFindMany.mockResolvedValue([makeRunForSnapshot()]);
      mockPayrollNoveltyFindMany.mockResolvedValue([]);
      mockContratoFindMany.mockResolvedValue([
        {
          id: 'contrato-1',
          empleadoId: 'emp-1',
          estado: 'VIGENTE',
          fechaInicio: new Date('2025-01-01'),
          fechaFin: null,
          sedeId: 'sede-1',
          salario: 2_000_000,
          claseRiesgoArl: 1,
        },
      ]);

      await service.aprobar(TENANT, USER, PERIOD_ID);

      const payload = mockPayrollSnapshotCreate.mock.calls[0][0].data.payload;
      expect(payload.employee).toMatchObject({
        employeeId: 'emp-1',
        salarioBaseUsado: 2_000_000,
        salarioIntegralUsado: false,
      });
      expect(payload.contract).toMatchObject({
        contratoId: 'contrato-1',
        sedeId: 'sede-1',
        claseRiesgoArlUsada: 1,
      });
      expect(payload.legalParameters).toMatchObject({
        parametroLegalId: 'param-1',
        smmlv: 1_423_500,
        factoresProvision: expect.objectContaining({
          factorProvPrima: 0.0833,
        }),
      });
      expect(payload.concepts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            codigo: 'SALUD_EMP',
            base: 2_000_000,
            factor: 0.04,
            valor: 80_000,
          }),
        ]),
      );
      expect(payload.totals).toMatchObject({
        totalDevengos: 2_202_897,
        totalDeducciones: 160_000,
        netoPagar: 2_042_897,
      });
    });

    it('usa la huella calculada aunque cambien datos mutables antes de aprobar', async () => {
      setupPayrollGeneration();
      mockPayrollNoveltyFindMany.mockResolvedValue([
        {
          id: 'novelty-calculated',
          tenantId: TENANT,
          payrollPeriodId: PERIOD_ID,
          employeeId: 'emp-1',
          tipo: 'BONUS',
          descripcion: 'Bono calculado',
          fecha: new Date('2026-01-10'),
          valor: 100_000,
        },
      ]);

      await service.generatePayroll(TENANT, USER, PERIOD_ID);

      const createdData = mockPayrollRunCreate.mock.calls[0][0].data;
      const { concepts, ...runData } = createdData;
      mockPayrollRunFindMany.mockResolvedValue([
        {
          id: 'run-1',
          ...runData,
          concepts: concepts.create.map((concept: Record<string, unknown>) => ({
            id: `concept-${String(concept.codigo)}`,
            createdAt: new Date('2026-01-01'),
            payrollRunId: 'run-1',
            ...concept,
          })),
        },
      ]);

      mockTenantFindUnique.mockClear();
      mockEmpleadoFindMany.mockClear();
      mockContratoFindMany.mockClear();
      mockPayrollNoveltyFindMany.mockClear();
      mockParametroLegalFindFirst.mockClear();

      mockTenantFindUnique.mockResolvedValue({ aportesExonerados: true });
      mockEmpleadoFindMany.mockResolvedValue([
        { id: 'emp-1', salario: 2_000_000, salarioIntegral: false },
      ]);
      mockContratoFindMany.mockResolvedValue([
        {
          id: 'contrato-mutado',
          empleadoId: 'emp-1',
          estado: 'VIGENTE',
          fechaInicio: new Date('2026-01-01'),
          fechaFin: null,
          sedeId: 'sede-mutada',
          salario: 2_000_000,
          claseRiesgoArl: 5,
        },
      ]);
      mockPayrollNoveltyFindMany.mockResolvedValue([
        {
          id: 'novelty-mutated',
          tenantId: TENANT,
          payrollPeriodId: PERIOD_ID,
          employeeId: 'emp-1',
          tipo: 'OVERTIME',
          descripcion: 'Novedad mutada',
          fecha: new Date('2026-01-20'),
          valor: 900_000,
        },
      ]);
      mockParametroLegalFindFirst.mockResolvedValue({
        ...makeLegalParam(),
        id: 'param-mutado',
        smmlv: 9_999_999,
      });

      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('EN_REVISION'));
      mockPayrollPeriodFindFirstOrThrow.mockResolvedValue(
        makePeriod('APROBADA', {
          nombre: 'Periodo mutado',
          fechaInicio: new Date('2026-02-01'),
          fechaFin: new Date('2026-02-28'),
        }),
      );
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });

      await service.aprobar(TENANT, USER, PERIOD_ID);

      const payload = mockPayrollSnapshotCreate.mock.calls[0][0].data.payload;
      expect(payload.period).toMatchObject({
        nombre: 'Enero 2026',
        fechaInicio: new Date('2026-01-01').toISOString(),
        fechaFin: new Date('2026-01-31').toISOString(),
      });
      expect(payload.employee).toMatchObject({
        salarioBaseUsado: 2_000_000,
        salarioIntegralUsado: false,
      });
      expect(payload.contract).toMatchObject({
        contratoId: 'contrato-1',
        salarioContrato: 2_000_000,
        sedeId: 'sede-1',
        claseRiesgoArlUsada: 1,
      });
      expect(payload.companyPolicy).toEqual({ aportesExonerados: false });
      expect(payload.legalParameters).toMatchObject({
        parametroLegalId: 'param-1',
        smmlv: 1_423_500,
      });
      expect(payload.novelties).toEqual([
        {
          noveltyId: 'novelty-calculated',
          tipo: 'BONUS',
          descripcion: 'Bono calculado',
          fecha: new Date('2026-01-10').toISOString(),
          valor: 100_000,
        },
      ]);
    });

    it('no crea snapshot antes de aprobar', async () => {
      setupPayrollGeneration();

      await service.generatePayroll(TENANT, USER, PERIOD_ID);

      expect(mockPayrollSnapshotCreate).not.toHaveBeenCalled();
    });

    it('si falla la creacion del snapshot, no registra auditoria de aprobacion', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('EN_REVISION'));
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });
      mockPayrollRunFindMany.mockResolvedValue([makeRunForSnapshot()]);
      mockPayrollSnapshotCreate.mockRejectedValueOnce(
        new Error('snapshot down'),
      );

      await expect(service.aprobar(TENANT, USER, PERIOD_ID)).rejects.toThrow(
        'snapshot down',
      );
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('closePeriod produce snapshot con el mismo flujo compartido', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CALCULADA'));
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });
      mockPayrollRunFindMany.mockResolvedValue([makeRunForSnapshot()]);
      mockContratoFindMany.mockResolvedValue([
        {
          id: 'contrato-1',
          empleadoId: 'emp-1',
          estado: 'VIGENTE',
          fechaInicio: new Date('2025-01-01'),
          fechaFin: null,
          sedeId: 'sede-1',
          salario: 2_000_000,
          claseRiesgoArl: 1,
        },
      ]);

      await service.closePeriod(TENANT, USER, PERIOD_ID);

      expect(mockPayrollSnapshotCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payrollRunId: 'run-1',
          origen: 'LEGACY_CLOSE',
          estadoPeriodo: 'APROBADA',
        }),
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYROLL_PERIOD_APPROVED_LEGACY_CLOSE',
        }),
        mockPrisma,
      );
    });
  });

  describe('rechazar', () => {
    it('EN_REVISION → CALCULADA: transición válida', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue({ status: 'EN_REVISION' });
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });

      await service.rechazar(TENANT, USER, PERIOD_ID);

      expect(mockPayrollPeriodUpdateMany).toHaveBeenCalledWith({
        where: { id: PERIOD_ID, tenantId: TENANT, status: 'EN_REVISION' },
        data: { status: 'CALCULADA' },
      });
    });

    it('con motivo: lo incluye en los metadatos de auditoría', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue({ status: 'EN_REVISION' });
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });

      await service.rechazar(TENANT, USER, PERIOD_ID, 'faltan novedades');

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYROLL_PERIOD_REJECTED',
          metadata: expect.objectContaining({ motivo: 'faltan novedades' }),
        }),
        mockPrisma,
      );
    });

    it('sin motivo: no incluye la clave motivo en los metadatos', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue({ status: 'EN_REVISION' });
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });

      await service.rechazar(TENANT, USER, PERIOD_ID);

      const call = mockAudit.log.mock.calls[0][0];
      expect(call.metadata).not.toHaveProperty('motivo');
    });

    it('APROBADA → CALCULADA: transición inválida (rechazar no revierte una aprobación)', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue({ status: 'APROBADA' });

      await expect(service.rechazar(TENANT, USER, PERIOD_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('BORRADOR → CALCULADA: transición inválida (rechazar exige EN_REVISION, no basta con que CALCULADA sea alcanzable desde BORRADOR)', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue({ status: 'BORRADOR' });

      await expect(service.rechazar(TENANT, USER, PERIOD_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPayrollPeriodUpdateMany).not.toHaveBeenCalled();
    });
  });

  // ── reabrir: CALCULADA → BORRADOR ────────────────────────────────────────────

  describe('reabrir', () => {
    it('CALCULADA → BORRADOR: transición válida', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue({ status: 'CALCULADA' });
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });

      await service.reabrir(TENANT, USER, PERIOD_ID);

      expect(mockPayrollPeriodUpdateMany).toHaveBeenCalledWith({
        where: { id: PERIOD_ID, tenantId: TENANT, status: 'CALCULADA' },
        data: { status: 'BORRADOR' },
      });
    });

    it('EN_REVISION → BORRADOR: transición inválida (reabrir no es rechazar)', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue({ status: 'EN_REVISION' });

      await expect(service.reabrir(TENANT, USER, PERIOD_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── closePeriod: alias legado CALCULADA → APROBADA directo ──────────────────

  describe('closePeriod (alias legado)', () => {
    beforeEach(() => {
      mockPayrollRunFindMany.mockResolvedValue([]);
    });

    it('CALCULADA → APROBADA directo, sin pasar por EN_REVISION', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CALCULADA'));
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });

      await service.closePeriod(TENANT, USER, PERIOD_ID);

      expect(mockPayrollPeriodUpdateMany).toHaveBeenCalledWith({
        where: { id: PERIOD_ID, tenantId: TENANT, status: 'CALCULADA' },
        data: {
          status: 'APROBADA',
          aprobadoPorId: USER,
          aprobadoEn: expect.any(Date),
        },
      });
    });

    it('audita con una acción distinta de `aprobar` (trazabilidad separada)', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CALCULADA'));
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });

      await service.closePeriod(TENANT, USER, PERIOD_ID);

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYROLL_PERIOD_APPROVED_LEGACY_CLOSE',
        }),
        mockPrisma,
      );
    });

    it('BORRADOR: rechaza con BadRequestException (solo aplica desde CALCULADA)', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('BORRADOR'));

      await expect(
        service.closePeriod(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow(BadRequestException);
      expect(mockPayrollPeriodUpdateMany).not.toHaveBeenCalled();
    });

    it('APROBADA: rechaza con BadRequestException (ya no es CALCULADA)', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('APROBADA'));

      await expect(
        service.closePeriod(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('count === 0 (carrera perdida) → ConflictException', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CALCULADA'));
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.closePeriod(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('bloqueos funcionales activos impiden el alias legado closePeriod', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CALCULADA'));
      mockPayrollBlockFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ employeeId: 'emp-1' }]);
      mockEmpleadoFindMany.mockResolvedValue([
        { id: 'emp-1', salario: 15_000_000, salarioIntegral: true },
      ]);
      mockContratoFindMany.mockResolvedValue([
        {
          id: 'contrato-1',
          empleadoId: 'emp-1',
          estado: 'VIGENTE',
          fechaInicio: new Date('2025-01-01'),
          fechaFin: null,
          sedeId: 'sede-1',
          salario: 15_000_000,
          claseRiesgoArl: 1,
        },
      ]);

      await expect(
        service.closePeriod(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow('bloqueos funcionales activos');
      expect(mockPayrollPeriodUpdateMany).not.toHaveBeenCalled();
      expect(mockPayrollSnapshotCreate).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });
  });

  // ── Guardas de estado en generate/recalculate ───────────────────────────────

  describe('generatePayroll — guardas de estado', () => {
    it('EN_REVISION: bloquea antes de tocar cualquier otro dato', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('EN_REVISION'));

      await expect(
        service.generatePayroll(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow(BadRequestException);
      expect(mockEmpleadoFindMany).not.toHaveBeenCalled();
    });

    it('APROBADA: bloquea', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('APROBADA'));

      await expect(
        service.generatePayroll(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('BORRADOR (permitido): al finalizar con éxito, transiciona a CALCULADA', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('BORRADOR'));
      mockParametroLegalFindFirst.mockResolvedValue(makeLegalParam());
      mockTenantFindUnique.mockResolvedValue({ aportesExonerados: false });
      mockEmpleadoFindMany.mockResolvedValue([]); // sin empleados: camino mínimo
      mockPayrollNoveltyFindMany.mockResolvedValue([]);
      mockContratoFindMany.mockResolvedValue([]);
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });

      await service.generatePayroll(TENANT, USER, PERIOD_ID);

      expect(mockPayrollPeriodUpdateMany).toHaveBeenCalledWith({
        where: { id: PERIOD_ID, tenantId: TENANT },
        data: { status: 'CALCULADA' },
      });
    });

    it('persiste centroCostoId resuelto desde Contrato.sedeId -> CentroCosto.sedeId', async () => {
      setupPayrollGeneration();

      await service.generatePayroll(TENANT, USER, PERIOD_ID);

      expect(mockCentroCostoFindMany).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT,
          sedeId: { in: ['sede-1'] },
          activo: true,
          deletedAt: null,
        },
        select: { id: true, codigo: true, nombre: true, sedeId: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(mockPayrollRunCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ centroCostoId: 'cc-1' }),
      });
    });

    it('persiste centroCostoId null cuando el contrato no tiene centro asociado', async () => {
      setupPayrollGeneration({ centrosCosto: [] });

      await service.generatePayroll(TENANT, USER, PERIOD_ID);

      expect(mockPayrollRunCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ centroCostoId: null }),
      });
    });

    it('clasifica salario integral como bloqueo y no crea PayrollRun', async () => {
      setupPayrollGeneration();
      mockEmpleadoFindMany.mockResolvedValue([
        {
          id: 'emp-1',
          salario: 15_000_000,
          salarioIntegral: true,
        },
      ]);
      mockContratoFindMany.mockResolvedValue([
        {
          id: 'contrato-1',
          empleadoId: 'emp-1',
          estado: 'VIGENTE',
          fechaInicio: new Date('2025-01-01'),
          fechaFin: null,
          sedeId: 'sede-1',
          salario: 15_000_000,
          claseRiesgoArl: 1,
        },
      ]);

      const result = await service.generatePayroll(TENANT, USER, PERIOD_ID);

      expect(mockPayrollRunCreate).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        created: 0,
        blocks: {
          'emp-1': [expect.stringContaining('Salario integral fuera de v1')],
        },
      });
      expect(mockPayrollBlockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT,
          payrollPeriodId: PERIOD_ID,
          employeeId: 'emp-1',
          code: 'UNSUPPORTED_INTEGRAL_SALARY',
          message: expect.stringContaining('Salario integral fuera de v1'),
          status: 'ACTIVE',
        }),
      });
    });

    it('marca como resuelto un bloqueo activo que ya no aparece al calcular', async () => {
      setupPayrollGeneration();
      mockPayrollBlockFindMany.mockResolvedValue([
        {
          id: 'block-1',
          employeeId: 'emp-1',
          code: 'UNSUPPORTED_INTEGRAL_SALARY',
          status: 'ACTIVE',
        },
      ]);

      await service.generatePayroll(TENANT, USER, PERIOD_ID);

      expect(mockPayrollBlockUpdate).toHaveBeenCalledWith({
        where: { id: 'block-1' },
        data: {
          status: 'RESOLVED',
          resolvedAt: expect.any(Date),
        },
      });
    });
  });

  describe('recalculatePayroll — guardas de estado', () => {
    it('EN_REVISION: bloquea con ConflictException', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('EN_REVISION'));

      await expect(
        service.recalculatePayroll(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow(ConflictException);
      expect(mockEmpleadoFindMany).not.toHaveBeenCalled();
    });

    it('APROBADA: bloquea', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('APROBADA'));

      await expect(
        service.recalculatePayroll(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('CALCULADA (permitido): al finalizar con éxito, permanece en CALCULADA', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CALCULADA'));
      mockParametroLegalFindFirst.mockResolvedValue(makeLegalParam());
      mockTenantFindUnique.mockResolvedValue({ aportesExonerados: false });
      mockEmpleadoFindMany.mockResolvedValue([]);
      mockPayrollNoveltyFindMany.mockResolvedValue([]);
      mockContratoFindMany.mockResolvedValue([]);
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });

      await service.recalculatePayroll(TENANT, USER, PERIOD_ID);

      expect(mockPayrollPeriodUpdateMany).toHaveBeenCalledWith({
        where: { id: PERIOD_ID, tenantId: TENANT },
        data: { status: 'CALCULADA' },
      });
    });

    it('persiste centroCostoId al recrear runs durante el recálculo', async () => {
      setupPayrollGeneration();
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CALCULADA'));
      mockPayrollRunFindMany.mockResolvedValue([]);

      await service.recalculatePayroll(TENANT, USER, PERIOD_ID);

      expect(mockPayrollRunCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ centroCostoId: 'cc-1' }),
      });
    });
  });

  describe('findOnePeriod — lectura de centro de costo', () => {
    it('incluye centroCosto en la consulta de runs del período', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CALCULADA'));
      mockPayrollRunFindMany.mockResolvedValue([]);

      await service.findOnePeriod(TENANT, PERIOD_ID);

      expect(mockPayrollRunFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            centroCosto: {
              select: { id: true, codigo: true, nombre: true, sedeId: true },
            },
          }),
        }),
      );
    });
  });

  // ── createPeriod: fija BORRADOR explícito ───────────────────────────────────

  describe('createPeriod', () => {
    it('fija status: BORRADOR explícito (no depende del @default de la DB)', async () => {
      const created = jest.fn().mockResolvedValue(makePeriod('BORRADOR'));
      (
        mockPrisma as unknown as { payrollPeriod: { create: typeof created } }
      ).payrollPeriod.create = created;

      await service.createPeriod(TENANT, USER, {
        nombre: 'Enero 2026',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-01-31',
      });

      expect(created).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'BORRADOR' }),
        }),
      );
    });
  });

  describe('contabilizar — causación contable (ACC-13)', () => {
    const accountingRun = {
      centroCostoId: 'cc-1',
      totalDevengos: 100,
      totalDeducciones: 10,
      netoPagar: 90,
      totalAportesPatronales: 20,
      totalProvisiones: 5,
      concepts: [
        { codigo: 'SALARIO_BASE', tipo: 'EARNING', valor: 100 },
        { codigo: 'SALUD_EMP', tipo: 'DEDUCTION', valor: 4 },
        { codigo: 'PENSION_EMP', tipo: 'DEDUCTION', valor: 6 },
        {
          codigo: 'SALUD_PAT',
          tipo: 'EMPLOYER_CONTRIBUTION',
          valor: 8,
        },
        {
          codigo: 'PENSION_PAT',
          tipo: 'EMPLOYER_CONTRIBUTION',
          valor: 4,
        },
        { codigo: 'ARL', tipo: 'EMPLOYER_CONTRIBUTION', valor: 2 },
        { codigo: 'CAJA', tipo: 'EMPLOYER_CONTRIBUTION', valor: 3 },
        { codigo: 'ICBF', tipo: 'EMPLOYER_CONTRIBUTION', valor: 2 },
        { codigo: 'SENA', tipo: 'EMPLOYER_CONTRIBUTION', valor: 1 },
        { codigo: 'PROV_PRIMA', tipo: 'PROVISION', valor: 5 },
      ],
    };

    function configureAccountingInputs() {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('APROBADA'));
      mockCuentaSistemaMapFindMany.mockResolvedValue(
        PAYROLL_ACCOUNTING_REQUIRED_ROLES.map((rol) => ({
          rol,
          cuentaId: `account-${rol}`,
        })),
      );
      mockPeriodoContableFindFirst.mockResolvedValue({
        id: 'accounting-period',
      });
      mockTipoComprobanteFindFirst.mockResolvedValue({ id: 'nom-type' });
      mockPayrollRunFindMany.mockResolvedValue([accountingRun]);
    }

    it('ejecuta el preflight antes de crear el comprobante', async () => {
      mockPreflight.validate.mockResolvedValue({
        status: 'ERROR',
        validations: [{ code: 'ACCOUNTING_PERIOD_CLOSED' }],
      });

      const result = await service.contabilizar(TENANT, USER, PERIOD_ID);

      expect(result).toEqual({
        status: 'PREFLIGHT_ERROR',
        preflight: expect.objectContaining({ status: 'ERROR' }),
      });
      expect(mockTenantPrisma.execute).toHaveBeenCalledTimes(1);
      expect(mockLedger.registrarComprobante).not.toHaveBeenCalled();
      expect(mockPayrollPeriodUpdateMany).not.toHaveBeenCalled();
    });

    it('causa una nómina aprobada a través del Ledger y conserva la relación de origen', async () => {
      configureAccountingInputs();

      const result = await service.contabilizar(TENANT, USER, PERIOD_ID);

      expect(result).toEqual({
        status: 'CAUSADA',
        payrollPeriodId: PERIOD_ID,
        comprobanteId: 'voucher-1',
      });
      expect(mockLedger.registrarComprobante).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT,
          origenTipo: 'PAYROLL',
          origenId: PERIOD_ID,
          origenEvento: 'CAUSACION',
        }),
        mockPrisma,
      );
      expect(mockPayrollPeriodUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'CAUSADA' } }),
      );
    });

    it('revierte la transacción si Ledger falla antes de la transición de Payroll', async () => {
      configureAccountingInputs();
      mockLedger.registrarComprobante.mockRejectedValueOnce(
        new Error('Ledger failure'),
      );

      await expect(
        service.contabilizar(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow('Ledger failure');

      expect(mockPayrollPeriodUpdateMany).not.toHaveBeenCalled();
    });

    it('propaga el fallo al persistir Payroll para que el comprobante sea rollback', async () => {
      configureAccountingInputs();
      mockPayrollPeriodUpdateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.contabilizar(TENANT, USER, PERIOD_ID),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mockLedger.registrarComprobante).toHaveBeenCalledTimes(1);
    });

    it('es idempotente si el período ya está causado y tiene su comprobante', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CAUSADA'));
      mockComprobanteFindFirst.mockResolvedValue({
        id: 'voucher-existing',
        estado: 'CONTABILIZADO',
        reversos: [],
      });
      mockPreflight.validate.mockResolvedValue({
        status: 'ERROR',
        validations: [{ code: 'ACCOUNTING_PERIOD_CLOSED' }],
      });

      const result = await service.contabilizar(TENANT, USER, PERIOD_ID);

      expect(result).toEqual({
        status: 'YA_CAUSADA',
        payrollPeriodId: PERIOD_ID,
        comprobanteId: 'voucher-existing',
      });
      expect(mockLedger.registrarComprobante).not.toHaveBeenCalled();
      expect(mockPayrollPeriodUpdateMany).not.toHaveBeenCalled();
      expect(mockPreflight.validate).not.toHaveBeenCalled();
    });

    it('bloquea una nómina causada cuyo comprobante fue revertido', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CAUSADA'));
      mockComprobanteFindFirst.mockResolvedValue({
        id: 'voucher-existing',
        estado: 'CONTABILIZADO',
        reversos: [{ id: 'voucher-reversal' }],
      });

      await expect(
        service.contabilizar(TENANT, USER, PERIOD_ID),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(mockLedger.registrarComprobante).not.toHaveBeenCalled();
      expect(mockPayrollPeriodUpdateMany).not.toHaveBeenCalled();
      expect(mockPreflight.validate).not.toHaveBeenCalled();
    });

    it('no crea un segundo comprobante en una segunda solicitud', async () => {
      configureAccountingInputs();
      await service.contabilizar(TENANT, USER, PERIOD_ID);

      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CAUSADA'));
      mockComprobanteFindFirst.mockResolvedValue({
        id: 'voucher-1',
        estado: 'CONTABILIZADO',
        reversos: [],
      });
      await service.contabilizar(TENANT, USER, PERIOD_ID);

      expect(mockLedger.registrarComprobante).toHaveBeenCalledTimes(1);
    });
  });

  describe('detalle de período y comprobante de nómina', () => {
    it('devuelve las líneas del comprobante del mismo tenant para mostrar el Ledger', async () => {
      const fecha = new Date('2026-02-28T00:00:00.000Z');
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CAUSADA'));
      mockPayrollRunFindMany.mockResolvedValue([]);
      mockPayrollSnapshotFindMany.mockResolvedValue([
        {
          id: 'snapshot-1',
          employeeId: 'employee-1',
          centroCostoId: 'cc-1',
          employee: {
            id: 'employee-1',
            primerNombre: 'Ana',
            segundoNombre: null,
            primerApellido: 'Pérez',
            segundoApellido: null,
          },
          centroCosto: { id: 'cc-1', codigo: 'CC-01', nombre: 'Sede Centro' },
        },
      ]);
      mockComprobanteFindFirst.mockResolvedValue({
        id: 'voucher-1',
        tenantId: TENANT,
        numero: 42,
        fecha,
        concepto: 'Causación nómina febrero',
        estado: 'CONTABILIZADO',
        reversos: [],
        totalDebito: 1_000_000,
        totalCredito: 1_000_000,
        movimientos: [
          {
            linea: 1,
            descripcion: 'Salarios',
            debito: 1_000_000,
            credito: 0,
            cuenta: { codigo: '510506', nombre: 'Sueldos' },
            centroCosto: { codigo: 'CC-01', nombre: 'Sede Centro' },
          },
        ],
      });

      const result = await service.findOnePeriod(TENANT, PERIOD_ID);

      expect(mockComprobanteFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: TENANT,
            origenTipo: 'PAYROLL',
            origenId: PERIOD_ID,
            origenEvento: 'CAUSACION',
          },
        }),
      );
      expect(mockPayrollSnapshotFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT, payrollPeriodId: PERIOD_ID },
        }),
      );
      expect(result.snapshots).toEqual([
        {
          id: 'snapshot-1',
          employeeId: 'employee-1',
          centroCostoId: 'cc-1',
          employee: {
            id: 'employee-1',
            primerNombre: 'Ana',
            segundoNombre: null,
            primerApellido: 'Pérez',
            segundoApellido: null,
          },
          centroCosto: { id: 'cc-1', codigo: 'CC-01', nombre: 'Sede Centro' },
        },
      ]);
      expect(result.accountingVoucher).toEqual({
        id: 'voucher-1',
        numero: 42,
        fecha,
        concepto: 'Causación nómina febrero',
        estado: 'CONTABILIZADO',
        reversado: false,
        vigente: true,
        totalDebito: 1_000_000,
        totalCredito: 1_000_000,
        movimientos: [
          {
            linea: 1,
            descripcion: 'Salarios',
            debito: 1_000_000,
            credito: 0,
            cuentaCodigo: '510506',
            cuentaNombre: 'Sueldos',
            centroCostoCodigo: 'CC-01',
            centroCostoNombre: 'Sede Centro',
          },
        ],
      });
    });

    it('marca como revertida una causación con reverso contabilizado del mismo tenant', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CAUSADA'));
      mockPayrollRunFindMany.mockResolvedValue([]);
      mockPayrollSnapshotFindMany.mockResolvedValue([]);
      mockComprobanteFindFirst.mockResolvedValue({
        id: 'voucher-1',
        tenantId: TENANT,
        numero: 42,
        fecha: new Date('2026-02-28T00:00:00.000Z'),
        concepto: 'Causación nómina febrero',
        estado: 'CONTABILIZADO',
        totalDebito: 1_000_000,
        totalCredito: 1_000_000,
        reversos: [
          {
            id: 'voucher-reversal',
            tenantId: TENANT,
            estado: 'CONTABILIZADO',
          },
        ],
        movimientos: [],
      });

      const result = await service.findOnePeriod(TENANT, PERIOD_ID);

      expect(result.accountingVoucher).toMatchObject({
        id: 'voucher-1',
        estado: 'CONTABILIZADO',
        reversado: true,
        vigente: false,
      });
    });
  });
});
