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
import {
  PayrollCorrectionStatus,
  PayrollPilaFspSourceScope,
  PayrollPilaVoluntaryPensionStatus,
  PilaEventCode,
} from '@prisma/client';
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
const mockPayrollRunFindFirstOrThrow = jest.fn();
const mockPayrollRunUpdateMany = jest.fn();
const mockPayrollRunCreate = jest.fn();
const mockPayrollRunDeleteMany = jest.fn();
const mockPayrollConceptDeleteMany = jest.fn();
const mockParametroLegalFindFirst = jest.fn();
const mockTenantFindUnique = jest.fn();
const mockEmpleadoFindMany = jest.fn();
const mockEmpleadoFindFirst = jest.fn();
const mockAfiliacionFindMany = jest.fn();
const mockPilaWorkAssignmentFindMany = jest.fn();
const mockPilaWorkLocationFindMany = jest.fn();
const mockPayrollNoveltyFindMany = jest.fn();
const mockPayrollPilaEventFindMany = jest.fn();
const mockPayrollPilaEventFindFirst = jest.fn();
const mockPayrollPilaEventCreate = jest.fn();
const mockPayrollPilaEventDelete = jest.fn();
const mockContratoFindMany = jest.fn();
const mockCentroCostoFindMany = jest.fn();
const mockSedeFindMany = jest.fn();
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
const mockTerceroFindMany = jest.fn();
const mockQueryRaw = jest.fn();

const mockPrisma = {
  payrollPeriod: {
    findFirst: mockPayrollPeriodFindFirst,
    updateMany: mockPayrollPeriodUpdateMany,
    findFirstOrThrow: mockPayrollPeriodFindFirstOrThrow,
  },
  payrollRun: {
    findMany: mockPayrollRunFindMany,
    findFirst: mockPayrollRunFindFirst,
    findFirstOrThrow: mockPayrollRunFindFirstOrThrow,
    updateMany: mockPayrollRunUpdateMany,
    create: mockPayrollRunCreate,
    deleteMany: mockPayrollRunDeleteMany,
  },
  payrollConcept: { deleteMany: mockPayrollConceptDeleteMany },
  parametroLegalNomina: { findFirst: mockParametroLegalFindFirst },
  tenant: {
    findUnique: mockTenantFindUnique,
  },
  empleado: {
    findMany: mockEmpleadoFindMany,
    findFirst: mockEmpleadoFindFirst,
  },
  afiliacionSeguridadSocial: { findMany: mockAfiliacionFindMany },
  pilaAsignacionCentroTrabajo: { findMany: mockPilaWorkAssignmentFindMany },
  pilaUbicacionLaboral: { findMany: mockPilaWorkLocationFindMany },
  payrollNovelty: { findMany: mockPayrollNoveltyFindMany },
  payrollPilaEvent: {
    findMany: mockPayrollPilaEventFindMany,
    findFirst: mockPayrollPilaEventFindFirst,
    create: mockPayrollPilaEventCreate,
    delete: mockPayrollPilaEventDelete,
  },
  contrato: { findMany: mockContratoFindMany },
  centroCosto: { findMany: mockCentroCostoFindMany },
  sede: { findMany: mockSedeFindMany },
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
  tercero: { findMany: mockTerceroFindMany },
  $queryRaw: mockQueryRaw,
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

function makeCorrectionSnapshot(salarioBase = 2_000_000, diasNomina = 30) {
  const legal = makeLegalParam();
  const result = calculate({
    salarioBase,
    diasNomina,
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
      employee: {
        salarioBaseUsado: salarioBase,
        salarioIntegralUsado: false,
        diasNomina,
      },
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
  mockTenantFindUnique.mockResolvedValue({
    id: TENANT,
    razonSocial: 'Empresa de prueba S.A.S.',
    nit: '900123456',
    digitoVerif: '7',
    direccion: null,
    telefono: null,
    email: null,
    representanteLegal: null,
    aportesExonerados: false,
    municipio: null,
  });
  mockEmpleadoFindMany.mockResolvedValue([
    {
      id: 'emp-1',
      salario: 2_000_000,
      salarioIntegral: false,
      tipoSalarioPila: null,
      tipoDocumento: 'CC',
      cedula: '1000000001',
      primerNombre: 'Ana',
      segundoNombre: null,
      primerApellido: 'Pérez',
      segundoApellido: null,
      fechaNacimiento: new Date('1990-01-01T00:00:00.000Z'),
      fechaIngreso: new Date('2025-01-01T00:00:00.000Z'),
      fechaRetiro: null,
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
  mockAfiliacionFindMany.mockResolvedValue([]);
  mockPilaWorkAssignmentFindMany.mockResolvedValue([]);
  mockPilaWorkLocationFindMany.mockResolvedValue([]);
  mockSedeFindMany.mockResolvedValue([]);
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
    mockPayrollRunFindFirst.mockResolvedValue(null);
    mockPayrollRunFindFirstOrThrow.mockResolvedValue({});
    mockPayrollRunUpdateMany.mockResolvedValue({ count: 1 });
    mockPayrollNoveltyFindMany.mockResolvedValue([]);
    mockPayrollPilaEventFindMany.mockResolvedValue([]);
    mockQueryRaw.mockResolvedValue([]);
    mockPilaWorkAssignmentFindMany.mockResolvedValue([]);
    mockPilaWorkLocationFindMany.mockResolvedValue([]);
    mockContratoFindMany.mockResolvedValue([]);
    mockEmpleadoFindMany.mockResolvedValue([]);
    mockEmpleadoFindFirst.mockResolvedValue(null);
    mockParametroLegalFindFirst.mockResolvedValue(makeLegalParam());
    mockTenantFindUnique.mockResolvedValue({
      id: TENANT,
      razonSocial: 'Empresa de prueba S.A.S.',
      nit: '900123456',
      digitoVerif: '7',
      direccion: null,
      telefono: null,
      email: null,
      representanteLegal: null,
      aportesExonerados: false,
      municipio: null,
    });
    mockAfiliacionFindMany.mockResolvedValue([]);
    mockSedeFindMany.mockResolvedValue([]);
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

  describe('alcance de fuentes de ingreso FSP para PILA', () => {
    const runReference = {
      id: 'run-1',
      payrollPeriodId: PERIOD_ID,
      employeeId: 'emp-1',
      pilaFspSourceScope: PayrollPilaFspSourceScope.UNCONFIRMED,
    };

    it('guarda y audita la confirmación tenant-scoped antes de aprobar', async () => {
      mockPayrollRunFindFirst.mockResolvedValue(runReference);
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('EN_REVISION'));
      mockPayrollRunFindFirstOrThrow.mockResolvedValue({
        id: 'run-1',
        employeeId: 'emp-1',
        payrollPeriodId: PERIOD_ID,
        pilaFspSourceScope: PayrollPilaFspSourceScope.SINGLE_SOURCE_CONFIRMED,
        pilaFspSourceScopeUpdatedAt: new Date('2026-11-03T12:00:00.000Z'),
        pilaFspSourceScopeUpdatedById: USER,
      });

      const result = await service.updatePilaFspSourceScope(
        TENANT,
        USER,
        'run-1',
        {
          sourceScope: PayrollPilaFspSourceScope.SINGLE_SOURCE_CONFIRMED,
        },
      );

      expect(result.pilaFspSourceScope).toBe(
        PayrollPilaFspSourceScope.SINGLE_SOURCE_CONFIRMED,
      );
      expect(mockPayrollRunFindFirst).toHaveBeenCalledWith({
        where: { id: 'run-1', tenantId: TENANT },
        select: {
          id: true,
          payrollPeriodId: true,
          employeeId: true,
          pilaFspSourceScope: true,
        },
      });
      expect(mockPayrollRunUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'run-1',
          tenantId: TENANT,
          payrollPeriodId: PERIOD_ID,
          pilaFspSourceScope: PayrollPilaFspSourceScope.UNCONFIRMED,
        },
        data: {
          pilaFspSourceScope: PayrollPilaFspSourceScope.SINGLE_SOURCE_CONFIRMED,
          pilaFspSourceScopeUpdatedAt: expect.any(Date),
          pilaFspSourceScopeUpdatedById: USER,
        },
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYROLL_PILA_FSP_SOURCE_SCOPE_UPDATED',
          entityType: 'PayrollRun',
          entityId: 'run-1',
          metadata: expect.objectContaining({
            payrollPeriodId: PERIOD_ID,
            employeeId: 'emp-1',
            previousScope: PayrollPilaFspSourceScope.UNCONFIRMED,
            newScope: PayrollPilaFspSourceScope.SINGLE_SOURCE_CONFIRMED,
          }),
        }),
        mockPrisma,
      );
    });

    it('bloquea cambios después de aprobar', async () => {
      mockPayrollRunFindFirst.mockResolvedValue(runReference);
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('APROBADA'));

      await expect(
        service.updatePilaFspSourceScope(TENANT, USER, 'run-1', {
          sourceScope: PayrollPilaFspSourceScope.SINGLE_SOURCE_CONFIRMED,
        }),
      ).rejects.toThrow(ConflictException);
      expect(mockPayrollRunUpdateMany).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('rechaza una carrera si el estado de la declaración cambió', async () => {
      mockPayrollRunFindFirst.mockResolvedValue(runReference);
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CALCULADA'));
      mockPayrollRunUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updatePilaFspSourceScope(TENANT, USER, 'run-1', {
          sourceScope: PayrollPilaFspSourceScope.SINGLE_SOURCE_CONFIRMED,
        }),
      ).rejects.toThrow(ConflictException);
      expect(mockAudit.log).not.toHaveBeenCalled();
    });
  });

  describe('declaración de aportes voluntarios PILA', () => {
    const runReference = {
      id: 'run-avp',
      payrollPeriodId: PERIOD_ID,
      employeeId: 'emp-1',
      pilaVoluntaryPensionStatus: PayrollPilaVoluntaryPensionStatus.UNCONFIRMED,
      pilaVoluntaryPensionUpdatedAt: null,
      pilaVoluntaryPensionUpdatedById: null,
    };

    it('guarda y audita una confirmación de ausencia antes de aprobar', async () => {
      mockPayrollRunFindFirst.mockResolvedValue(runReference);
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('EN_REVISION'));
      mockPayrollRunFindFirstOrThrow.mockResolvedValue({
        ...runReference,
        pilaVoluntaryPensionStatus:
          PayrollPilaVoluntaryPensionStatus.NONE_CONFIRMED,
        pilaVoluntaryPensionUpdatedAt: new Date('2026-11-04T12:00:00.000Z'),
        pilaVoluntaryPensionUpdatedById: USER,
      });

      const result = await service.updatePilaVoluntaryPensionStatus(
        TENANT,
        USER,
        'run-avp',
        { status: PayrollPilaVoluntaryPensionStatus.NONE_CONFIRMED },
      );

      expect(result.pilaVoluntaryPensionStatus).toBe(
        PayrollPilaVoluntaryPensionStatus.NONE_CONFIRMED,
      );
      expect(mockPayrollRunFindFirst).toHaveBeenCalledWith({
        where: { id: 'run-avp', tenantId: TENANT },
        select: {
          id: true,
          payrollPeriodId: true,
          employeeId: true,
          pilaVoluntaryPensionStatus: true,
          pilaVoluntaryPensionUpdatedAt: true,
          pilaVoluntaryPensionUpdatedById: true,
        },
      });
      const updateCalls = mockPayrollRunUpdateMany.mock
        .calls as unknown as Array<
        [
          {
            where: {
              id: string;
              tenantId: string;
              payrollPeriodId: string;
              pilaVoluntaryPensionStatus: PayrollPilaVoluntaryPensionStatus;
              pilaVoluntaryPensionUpdatedAt: Date | null;
              pilaVoluntaryPensionUpdatedById: string | null;
            };
            data: {
              pilaVoluntaryPensionStatus: PayrollPilaVoluntaryPensionStatus;
              pilaVoluntaryPensionUpdatedAt: Date | null;
              pilaVoluntaryPensionUpdatedById: string | null;
            };
          },
        ]
      >;
      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0]?.[0]).toMatchObject({
        where: {
          id: 'run-avp',
          tenantId: TENANT,
          payrollPeriodId: PERIOD_ID,
          pilaVoluntaryPensionStatus:
            PayrollPilaVoluntaryPensionStatus.UNCONFIRMED,
          pilaVoluntaryPensionUpdatedAt: null,
          pilaVoluntaryPensionUpdatedById: null,
        },
        data: {
          pilaVoluntaryPensionStatus:
            PayrollPilaVoluntaryPensionStatus.NONE_CONFIRMED,
          pilaVoluntaryPensionUpdatedById: USER,
        },
      });
      expect(
        updateCalls[0]?.[0].data.pilaVoluntaryPensionUpdatedAt,
      ).toBeInstanceOf(Date);

      const auditCalls = mockAudit.log.mock.calls as unknown as Array<
        [
          {
            action: string;
            entityType: string;
            entityId: string;
            metadata: Record<string, unknown>;
          },
          unknown,
        ]
      >;
      expect(auditCalls).toHaveLength(1);
      expect(auditCalls[0]?.[0]).toMatchObject({
        action: 'PAYROLL_PILA_VOLUNTARY_PENSION_STATUS_UPDATED',
        entityType: 'PayrollRun',
        entityId: 'run-avp',
        metadata: {
          payrollPeriodId: PERIOD_ID,
          employeeId: 'emp-1',
          previousStatus: PayrollPilaVoluntaryPensionStatus.UNCONFIRMED,
          newStatus: PayrollPilaVoluntaryPensionStatus.NONE_CONFIRMED,
        },
      });
      expect(auditCalls[0]?.[1]).toBe(mockPrisma);
    });

    it('bloquea cambios después de aprobar', async () => {
      mockPayrollRunFindFirst.mockResolvedValue(runReference);
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('APROBADA'));

      await expect(
        service.updatePilaVoluntaryPensionStatus(TENANT, USER, 'run-avp', {
          status: PayrollPilaVoluntaryPensionStatus.NONE_CONFIRMED,
        }),
      ).rejects.toThrow(ConflictException);
      expect(mockPayrollRunUpdateMany).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('rechaza una carrera si cambió la declaración antes de guardar', async () => {
      mockPayrollRunFindFirst.mockResolvedValue(runReference);
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CALCULADA'));
      mockPayrollRunUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updatePilaVoluntaryPensionStatus(TENANT, USER, 'run-avp', {
          status: PayrollPilaVoluntaryPensionStatus.NONE_CONFIRMED,
        }),
      ).rejects.toThrow(ConflictException);
      expect(mockAudit.log).not.toHaveBeenCalled();
    });
  });

  describe('eventos PILA', () => {
    it('crea un evento tenant-scoped solo en un período en borrador', async () => {
      const fechaInicio = new Date('2026-01-10T00:00:00.000Z');
      const employee = {
        id: 'emp-1',
        primerNombre: 'Ana',
        segundoNombre: null,
        primerApellido: 'Pérez',
        segundoApellido: null,
      };
      mockEmpleadoFindFirst.mockResolvedValue({
        id: employee.id,
        estado: 'ACTIVO',
        fechaRetiro: null,
      });
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('BORRADOR'));
      mockPayrollPilaEventFindFirst.mockResolvedValue(null);
      mockPayrollPilaEventCreate.mockResolvedValue({
        id: 'event-1',
        tenantId: TENANT,
        payrollPeriodId: PERIOD_ID,
        employeeId: employee.id,
        codigo: PilaEventCode.ING,
        fechaInicio,
        fechaFin: null,
        dias: null,
        employee,
      });

      const result = await service.createPilaEvent(TENANT, USER, PERIOD_ID, {
        employeeId: employee.id,
        codigo: PilaEventCode.ING,
        fechaInicio: '2026-01-10',
      });

      expect(result).toMatchObject({
        id: 'event-1',
        codigo: PilaEventCode.ING,
      });
      expect(mockEmpleadoFindFirst).toHaveBeenCalledWith({
        where: {
          id: employee.id,
          tenantId: TENANT,
          deletedAt: null,
        },
        select: { id: true, estado: true },
      });
      expect(mockPayrollPilaEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            tenantId: TENANT,
            payrollPeriodId: PERIOD_ID,
            employeeId: employee.id,
            codigo: PilaEventCode.ING,
            fechaInicio,
            fechaFin: null,
            dias: null,
          },
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYROLL_PILA_EVENT_CREATED' }),
        mockPrisma,
      );
    });

    it('falla de forma segura si no puede auditar el alta', async () => {
      mockEmpleadoFindFirst.mockResolvedValue({
        id: 'emp-1',
        estado: 'ACTIVO',
        fechaRetiro: null,
      });
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('BORRADOR'));
      mockPayrollPilaEventFindFirst.mockResolvedValue(null);
      mockPayrollPilaEventCreate.mockResolvedValue({
        id: 'event-1',
        tenantId: TENANT,
        payrollPeriodId: PERIOD_ID,
        employeeId: 'emp-1',
        codigo: PilaEventCode.ING,
        fechaInicio: new Date('2026-01-10T00:00:00.000Z'),
        fechaFin: null,
        dias: null,
      });
      mockAudit.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.createPilaEvent(TENANT, USER, PERIOD_ID, {
          employeeId: 'emp-1',
          codigo: PilaEventCode.ING,
          fechaInicio: '2026-01-10',
        }),
      ).rejects.toThrow('audit down');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYROLL_PILA_EVENT_CREATED' }),
        mockPrisma,
      );
    });

    it('rechaza cambios cuando el período ya salió de borrador', async () => {
      mockEmpleadoFindFirst.mockResolvedValue({
        id: 'emp-1',
        estado: 'ACTIVO',
        fechaRetiro: null,
      });
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CALCULADA'));

      await expect(
        service.createPilaEvent(TENANT, USER, PERIOD_ID, {
          employeeId: 'emp-1',
          codigo: PilaEventCode.ING,
          fechaInicio: '2026-01-10',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPayrollPilaEventCreate).not.toHaveBeenCalled();
    });

    it('rechaza duplicar el mismo evento para el mismo empleado y período', async () => {
      mockEmpleadoFindFirst.mockResolvedValue({
        id: 'emp-1',
        estado: 'ACTIVO',
        fechaRetiro: null,
      });
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('BORRADOR'));
      mockPayrollPilaEventFindFirst.mockResolvedValue({ id: 'event-existing' });

      await expect(
        service.createPilaEvent(TENANT, USER, PERIOD_ID, {
          employeeId: 'emp-1',
          codigo: PilaEventCode.ING,
          fechaInicio: '2026-01-10',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPayrollPilaEventCreate).not.toHaveBeenCalled();
    });

    it('rechaza RET para un empleado inactivo porque Nómina no liquida períodos parciales', async () => {
      mockEmpleadoFindFirst.mockResolvedValue({
        id: 'emp-1',
        estado: 'INACTIVO',
        fechaRetiro: new Date('2026-01-20T00:00:00.000Z'),
      });
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('BORRADOR'));
      await expect(
        service.createPilaEvent(TENANT, USER, PERIOD_ID, {
          employeeId: 'emp-1',
          codigo: PilaEventCode.RET,
          fechaInicio: '2026-01-20',
        }),
      ).rejects.toThrow(
        'Nómina aún no liquida proporcionalmente el período desde su fecha de retiro',
      );

      expect(mockPayrollPilaEventCreate).not.toHaveBeenCalled();
    });

    it('rechaza otras novedades para empleados inactivos', async () => {
      mockEmpleadoFindFirst.mockResolvedValue({
        id: 'emp-1',
        estado: 'INACTIVO',
        fechaRetiro: new Date('2026-01-20T00:00:00.000Z'),
      });
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('BORRADOR'));

      await expect(
        service.createPilaEvent(TENANT, USER, PERIOD_ID, {
          employeeId: 'emp-1',
          codigo: PilaEventCode.IGE,
          fechaInicio: '2026-01-20',
          fechaFin: '2026-01-21',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPayrollPilaEventCreate).not.toHaveBeenCalled();
    });

    it('rechaza RET si la fecha informada no coincide con el retiro registrado', async () => {
      mockEmpleadoFindFirst.mockResolvedValue({
        id: 'emp-1',
        estado: 'INACTIVO',
        fechaRetiro: new Date('2026-01-20T00:00:00.000Z'),
      });
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('BORRADOR'));

      await expect(
        service.createPilaEvent(TENANT, USER, PERIOD_ID, {
          employeeId: 'emp-1',
          codigo: PilaEventCode.RET,
          fechaInicio: '2026-01-21',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPayrollPilaEventCreate).not.toHaveBeenCalled();
    });

    it('elimina un evento del tenant solo mientras su período está en borrador', async () => {
      mockPayrollPilaEventFindFirst
        .mockResolvedValueOnce({ id: 'event-1', payrollPeriodId: PERIOD_ID })
        .mockResolvedValueOnce({
          id: 'event-1',
          tenantId: TENANT,
          payrollPeriodId: PERIOD_ID,
          employeeId: 'emp-1',
          codigo: PilaEventCode.ING,
          fechaInicio: new Date('2026-01-10T00:00:00.000Z'),
          fechaFin: null,
          dias: null,
          payrollPeriod: { status: 'BORRADOR' },
        });

      await expect(
        service.deletePilaEvent(TENANT, USER, 'event-1'),
      ).resolves.toEqual({ deleted: true });

      expect(mockPayrollPilaEventDelete).toHaveBeenCalledWith({
        where: { id: 'event-1' },
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYROLL_PILA_EVENT_DELETED' }),
        mockPrisma,
      );
    });

    it('falla de forma segura si no puede auditar el borrado', async () => {
      mockPayrollPilaEventFindFirst
        .mockResolvedValueOnce({ id: 'event-1', payrollPeriodId: PERIOD_ID })
        .mockResolvedValueOnce({
          id: 'event-1',
          tenantId: TENANT,
          payrollPeriodId: PERIOD_ID,
          employeeId: 'emp-1',
          codigo: PilaEventCode.ING,
          fechaInicio: new Date('2026-01-10T00:00:00.000Z'),
          fechaFin: null,
          dias: null,
          payrollPeriod: { status: 'BORRADOR' },
        });
      mockAudit.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.deletePilaEvent(TENANT, USER, 'event-1'),
      ).rejects.toThrow('audit down');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAYROLL_PILA_EVENT_DELETED' }),
        mockPrisma,
      );
    });

    it('no elimina eventos de períodos ya calculados', async () => {
      mockPayrollPilaEventFindFirst
        .mockResolvedValueOnce({ id: 'event-1', payrollPeriodId: PERIOD_ID })
        .mockResolvedValueOnce({
          id: 'event-1',
          payrollPeriod: { status: 'CALCULADA' },
        });

      await expect(
        service.deletePilaEvent(TENANT, USER, 'event-1'),
      ).rejects.toThrow(ConflictException);

      expect(mockPayrollPilaEventDelete).not.toHaveBeenCalled();
    });
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

    it('no permite excluir una liquidación con tasa FSP desactualizada', async () => {
      mockPayrollBlockFindFirst.mockResolvedValue({
        id: 'block-fsp',
        tenantId: TENANT,
        payrollPeriodId: PERIOD_ID,
        employeeId: 'emp-1',
        code: 'STALE_FSP_CALCULATION',
        message: 'Reliquide el período',
        status: 'ACTIVE',
      });

      await expect(
        service.excludeBlock(TENANT, USER, 'block-fsp', 'ignorar'),
      ).rejects.toThrow('reliquide el período');
      expect(mockPayrollBlockUpdate).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
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

    it('mantiene el prorrateo al encadenar correcciones de salario en un ingreso parcial', async () => {
      const original = makeCorrectionSnapshot(2_000_000, 15);
      const previousSalary = makeCorrectionSnapshot(2_200_000, 15);
      const previousValues = new Map(
        previousSalary.payload.concepts.map((concept) => [
          `${concept.codigo}:${concept.tipo}`,
          concept.valor,
        ]),
      );
      const entries = original.payload.concepts.flatMap((concept) => {
        const delta =
          (previousValues.get(`${concept.codigo}:${concept.tipo}`) ?? 0) -
          concept.valor;
        return delta === 0
          ? []
          : [
              {
                snapshotId: original.id,
                employeeId: original.employeeId,
                centroCostoId: original.centroCostoId,
                concept: { codigo: concept.codigo, tipo: concept.tipo },
                delta,
              },
            ];
      });
      mockPayrollCorrectionFindFirst.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.EN_REVISION, {
          intent: {
            version: 1,
            intents: [
              {
                id: 'intent-current-salary',
                kind: PayrollCorrectionIntentKind.SET_CALCULATION_INPUT,
                snapshotId: original.id,
                input: PayrollCorrectionCalculationInput.SALARIO_BASE,
                targetAmount: 2_400_000,
              },
            ],
          },
        }),
      );
      mockPayrollSnapshotFindMany.mockResolvedValueOnce([original]);
      mockPayrollCorrectionFindMany.mockResolvedValueOnce([
        {
          id: 'corr-previous-salary',
          intent: {
            version: 1,
            intents: [
              {
                id: 'intent-previous-salary',
                kind: PayrollCorrectionIntentKind.SET_CALCULATION_INPUT,
                snapshotId: original.id,
                input: PayrollCorrectionCalculationInput.SALARIO_BASE,
                targetAmount: 2_200_000,
              },
            ],
          },
          materializationVersion: 1,
          materialization: {
            version: 1,
            generatedAt: '2026-03-01T00:00:00.000Z',
            snapshotIds: [original.id],
            approvedCorrectionIds: [],
            entries,
          },
          materializedAt: new Date('2026-03-01T00:00:00.000Z'),
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
        },
      ]);
      mockPayrollCorrectionFindFirstOrThrow.mockResolvedValueOnce(
        makeCorrection(PayrollCorrectionStatus.APROBADA),
      );

      await service.aprobarCorrection(TENANT, USER, 'corr-1');

      const updateCalls = mockPayrollCorrectionUpdateMany.mock
        .calls as unknown as Array<
        [
          {
            data: {
              materialization?: { entries: unknown[] };
            };
          },
        ]
      >;
      const materialization = updateCalls.at(-1)?.[0].data.materialization;
      expect(materialization?.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            snapshotId: original.id,
            concept: { codigo: 'SALARIO_BASE', tipo: 'EARNING' },
            delta: 100_000,
          }),
        ]),
      );
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

    it('bloquea aprobar una ejecución con tasa FSP calculada bajo los tramos anteriores', async () => {
      const smmlv = 1_423_500;
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('EN_REVISION'));
      mockParametroLegalFindFirst.mockResolvedValue({
        ...makeLegalParam(),
        fspTramos: [
          { desdeSmmlv: 4, hastaSmmlv: 16, pct: 0.01 },
          {
            desdeSmmlv: 16,
            hastaSmmlv: 17,
            pct: 0.012,
            hastaIncluido: true,
          },
          {
            desdeSmmlv: 17,
            hastaSmmlv: 18,
            pct: 0.014,
            desdeIncluido: false,
            hastaIncluido: true,
          },
          {
            desdeSmmlv: 18,
            hastaSmmlv: 19,
            pct: 0.016,
            desdeIncluido: false,
            hastaIncluido: true,
          },
          {
            desdeSmmlv: 19,
            hastaSmmlv: 20,
            pct: 0.018,
            desdeIncluido: false,
            hastaIncluido: true,
          },
          {
            desdeSmmlv: 20,
            hastaSmmlv: null,
            pct: 0.02,
            desdeIncluido: false,
          },
        ],
      });
      mockPayrollRunFindMany.mockResolvedValue([
        {
          employeeId: 'emp-1',
          ibc: 17 * smmlv,
          concepts: [{ factor: 0.014 }],
        },
      ]);
      mockPayrollBlockFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ employeeId: 'emp-1' }]);
      mockEmpleadoFindMany.mockResolvedValue([
        {
          id: 'emp-1',
          salario: 17 * smmlv,
          salarioIntegral: false,
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
          salario: 17 * smmlv,
          claseRiesgoArl: 1,
        },
      ]);

      await expect(service.aprobar(TENANT, USER, PERIOD_ID)).rejects.toThrow(
        'bloqueos funcionales activos',
      );

      expect(mockPayrollRunFindMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT, payrollPeriodId: PERIOD_ID },
        select: {
          employeeId: true,
          ibc: true,
          concepts: { where: { codigo: 'FSP' }, select: { factor: true } },
        },
      });
      expect(mockPayrollBlockCreate).toHaveBeenCalledWith({
        data: {
          tenantId: TENANT,
          payrollPeriodId: PERIOD_ID,
          employeeId: 'emp-1',
          code: 'STALE_FSP_CALCULATION',
          message:
            'La tasa FSP de esta liquidación no coincide con los parámetros legales vigentes. Reliquide el período antes de aprobarlo.',
          status: 'ACTIVE',
        },
      });
      expect(mockPayrollSnapshotCreate).not.toHaveBeenCalled();
      expect(mockPayrollPeriodUpdateMany).not.toHaveBeenCalled();
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
      mockPayrollPilaEventFindMany.mockResolvedValue([]);
      mockPayrollPilaEventFindFirst.mockResolvedValue(null);
      mockPayrollPilaEventCreate.mockResolvedValue({});
      mockPayrollPilaEventDelete.mockResolvedValue({});
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
        diasNomina: 30,
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
      const snapshotData = mockPayrollSnapshotCreate.mock.calls[0][0].data;
      expect(snapshotData.pilaPayloadVersion).toBeNull();
      expect(snapshotData).toHaveProperty('pilaPayload');
      expect(mockAfiliacionFindMany).not.toHaveBeenCalled();
      expect(mockSedeFindMany).not.toHaveBeenCalled();
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

      const generated = await service.generatePayroll(TENANT, USER, PERIOD_ID);
      expect(generated.created).toBe(1);

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
          fechaPrevistaPagoPila: new Date('2026-03-05T00:00:00.000Z'),
        }),
      );
      mockTenantFindUnique.mockResolvedValue({
        id: TENANT,
        razonSocial: 'Empresa mutada S.A.S.',
        nit: '900999999',
        digitoVerif: '9',
        direccion: null,
        telefono: null,
        email: null,
        representanteLegal: null,
        aportesExonerados: true,
        municipio: null,
      });
      mockPayrollPeriodUpdateMany.mockResolvedValue({ count: 1 });
      mockPilaWorkAssignmentFindMany.mockResolvedValue([
        {
          id: 'risk-assignment-at-approval',
          tenantId: TENANT,
          empleadoId: 'emp-1',
          codigoActividadEconomica: '1131202',
          formatoNormativoVersion: 'DECRETO_768_2022',
          vigenteDesde: new Date('2026-01-01T00:00:00.000Z'),
          vigenteHasta: null,
          centroTrabajo: {
            id: 'pila-center-at-approval',
            tenantId: TENANT,
            sedeId: 'sede-1',
            arlCodigo: 'ARL001',
            codigoCentro: '0001',
            nombre: 'Centro confirmado',
          },
        },
      ]);
      mockPilaWorkLocationFindMany.mockResolvedValue([
        {
          id: 'work-location-at-approval',
          tenantId: TENANT,
          empleadoId: 'emp-1',
          municipioId: 'municipality-at-approval',
          vigenteDesde: new Date('2026-01-01T00:00:00.000Z'),
          vigenteHasta: null,
          municipio: {
            id: 'municipality-at-approval',
            codigo: '08001',
            nombre: 'Barranquilla',
            departamento: 'Atlántico',
          },
        },
      ]);

      await service.aprobar(TENANT, USER, PERIOD_ID);
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();

      type SnapshotCreateData = {
        payload: {
          period: object;
          employee: object;
          contract: object;
          companyPolicy: object;
          legalParameters: object;
          novelties: unknown[];
        };
        pilaPayload: { schemaVersion: number } & Record<string, unknown>;
        pilaPayloadVersion: number;
      };
      const snapshotCreateData = (
        mockPayrollSnapshotCreate.mock.calls as unknown as Array<
          [{ data: SnapshotCreateData }]
        >
      )[0][0].data;
      const payload = snapshotCreateData.payload;
      expect(payload.period).toMatchObject({
        nombre: 'Enero 2026',
        fechaInicio: new Date('2026-01-01').toISOString(),
        fechaFin: new Date('2026-01-31').toISOString(),
      });
      expect(payload.employee).toMatchObject({
        salarioBaseUsado: 2_000_000,
        salarioIntegralUsado: false,
        diasNomina: 30,
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
      const pilaPayload = snapshotCreateData.pilaPayload;
      expect(pilaPayload).toMatchObject({
        schemaVersion: 10,
        pilaRiskAssignments: [
          {
            assignmentId: 'risk-assignment-at-approval',
            codigoActividadEconomica: '1131202',
            centroTrabajo: {
              centroTrabajoId: 'pila-center-at-approval',
            },
          },
        ],
        pilaWorkLocations: [
          {
            assignmentId: 'work-location-at-approval',
            tenantId: TENANT,
            municipioId: 'municipality-at-approval',
            municipio: {
              id: 'municipality-at-approval',
              codigo: '08001',
              nombre: 'Barranquilla',
              departamento: 'Atlántico',
            },
            vigenteDesde: '2026-01-01',
            vigenteHasta: null,
          },
        ],
        employer: { tenantId: TENANT, nit: '900123456' },
        employee: {
          employeeId: 'emp-1',
          cedula: '1000000001',
          primerNombre: 'Ana',
        },
        contract: { contractId: 'contrato-1', sedeId: 'sede-1' },
        payroll: {
          payrollRunId: 'run-1',
          payrollCalculationParameters: {
            sourceVersion: 'PAYROLL_LEGAL_PARAMETERS_V2',
            parametroLegalId: 'param-1',
            smmlv: 1_423_500,
            fspTramos: [],
          },
          fechaPrevistaPagoPila: '2026-03-05',
          voluntaryPensionDeclaration: {
            status: 'UNCONFIRMED',
            declaredAt: null,
            declaredById: null,
          },
          salarioBasico: 2_000_000,
          tipoSalario: null,
          ibc: 2_100_000,
          ibcPorSubsistema: {
            otrosParafiscales: {
              valor: null,
              reglaVersion: 'CO_PARAFISCAL_BASE_V1',
            },
          },
        },
      });
      expect(snapshotCreateData).toMatchObject({
        pilaPayloadVersion: 10,
      });
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
        where: {
          id: PERIOD_ID,
          tenantId: TENANT,
          status: { in: ['BORRADOR', 'CALCULADA'] },
        },
        data: { status: 'CALCULADA' },
      });
    });

    it('bloquea generación si un RET quedó asociado a un empleado inactivo', async () => {
      setupPayrollGeneration();
      mockEmpleadoFindMany.mockResolvedValue([]);
      mockPayrollPilaEventFindMany.mockResolvedValue([
        {
          id: 'event-ret',
          employeeId: 'emp-retired',
          codigo: PilaEventCode.RET,
          fechaInicio: new Date('2026-01-20T00:00:00.000Z'),
          fechaFin: null,
          dias: null,
          createdAt: new Date('2026-01-20T00:00:00.000Z'),
        },
      ]);
      mockQueryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 'emp-retired', estado: 'INACTIVO', deletedAt: null },
        ]);

      await expect(
        service.generatePayroll(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow('asociado(s) a novedades PILA no está(n) activo(s)');

      expect(mockPayrollRunCreate).not.toHaveBeenCalled();
      expect(mockPayrollPeriodUpdateMany).not.toHaveBeenCalled();
    });

    it('si el período se aprueba mientras se prepara la generación, no crea liquidaciones', async () => {
      setupPayrollGeneration();
      mockPayrollPeriodFindFirst
        .mockResolvedValueOnce(makePeriod('BORRADOR'))
        .mockResolvedValueOnce(makePeriod('APROBADA'));

      await expect(
        service.generatePayroll(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow(ConflictException);

      expect(mockPayrollRunCreate).not.toHaveBeenCalled();
      expect(mockPayrollPeriodUpdateMany).not.toHaveBeenCalled();
      expect(mockPayrollPeriodFindFirst).toHaveBeenLastCalledWith({
        where: { id: PERIOD_ID, tenantId: TENANT },
        select: { status: true },
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

    it('prorratea el ingreso de mitad de mes y conserva el salario mensual de referencia', async () => {
      setupPayrollGeneration();
      const period = makePeriod('BORRADOR', {
        fechaInicio: new Date('2026-03-01T00:00:00.000Z'),
        fechaFin: new Date('2026-03-31T00:00:00.000Z'),
        nombre: 'Marzo 2026',
      });
      mockPayrollPeriodFindFirst.mockResolvedValue(period);
      mockEmpleadoFindMany.mockResolvedValue([
        {
          id: 'emp-1',
          salario: 2_000_000,
          salarioIntegral: false,
          tipoSalarioPila: null,
          tipoDocumento: 'CC',
          cedula: '1000000001',
          primerNombre: 'Ana',
          segundoNombre: null,
          primerApellido: 'Pérez',
          segundoApellido: null,
          fechaNacimiento: new Date('1990-01-01T00:00:00.000Z'),
          fechaIngreso: new Date('2026-03-10T00:00:00.000Z'),
          fechaRetiro: null,
        },
      ]);
      mockContratoFindMany.mockResolvedValue([
        {
          id: 'contract-new-hire',
          empleadoId: 'emp-1',
          estado: 'VIGENTE',
          fechaInicio: new Date('2026-03-10T00:00:00.000Z'),
          fechaFin: null,
          sedeId: 'sede-1',
          salario: 2_000_000,
          claseRiesgoArl: 1,
        },
      ]);

      const result = await service.generatePayroll(TENANT, USER, PERIOD_ID);

      expect(result.created).toBe(1);
      const createCalls = mockPayrollRunCreate.mock.calls as unknown as Array<
        [
          {
            data: {
              salarioBaseSnapshot: number;
              calculationTrace: { employee: { diasNomina: number } };
              concepts: { create: Array<{ codigo: string; valor: number }> };
              ibc: number;
            };
          },
        ]
      >;
      const data = createCalls[0][0].data;
      expect(data.salarioBaseSnapshot).toBe(2_000_000);
      expect(data.calculationTrace.employee.diasNomina).toBe(21);
      expect(data.concepts.create).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ codigo: 'SALARIO_BASE', valor: 1_400_000 }),
        ]),
      );
      expect(data.ibc).toBe(1_400_000);
    });

    it('bloquea un ingreso parcial cuando el período no es un mes calendario completo', async () => {
      setupPayrollGeneration();
      mockPayrollPeriodFindFirst.mockResolvedValue(
        makePeriod('BORRADOR', {
          fechaInicio: new Date('2026-03-15T00:00:00.000Z'),
          fechaFin: new Date('2026-03-31T00:00:00.000Z'),
          nombre: 'Segunda quincena marzo 2026',
        }),
      );
      mockEmpleadoFindMany.mockResolvedValue([
        {
          id: 'emp-1',
          salario: 2_000_000,
          salarioIntegral: false,
          fechaIngreso: new Date('2026-03-15T00:00:00.000Z'),
        },
      ]);
      mockContratoFindMany.mockResolvedValue([
        {
          id: 'contract-new-hire',
          empleadoId: 'emp-1',
          estado: 'VIGENTE',
          fechaInicio: new Date('2026-03-15T00:00:00.000Z'),
          fechaFin: null,
          sedeId: 'sede-1',
          salario: 2_000_000,
          claseRiesgoArl: 1,
        },
      ]);

      const result = await service.generatePayroll(TENANT, USER, PERIOD_ID);

      expect(result.created).toBe(0);
      expect(result.blocks?.['emp-1']).toContain(
        'El ingreso dentro del período solo se liquida proporcionalmente en un mes calendario completo.',
      );
      expect(mockPayrollRunCreate).not.toHaveBeenCalled();
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
        where: {
          id: PERIOD_ID,
          tenantId: TENANT,
          status: { in: ['BORRADOR', 'CALCULADA'] },
        },
        data: { status: 'CALCULADA' },
      });
    });

    it('bloquea reliquidación si un RET quedó asociado a un empleado inactivo', async () => {
      setupPayrollGeneration();
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CALCULADA'));
      mockEmpleadoFindMany.mockResolvedValue([]);
      mockPayrollPilaEventFindMany.mockResolvedValue([
        {
          id: 'event-ret',
          employeeId: 'emp-retired',
          codigo: PilaEventCode.RET,
          fechaInicio: new Date('2026-01-20T00:00:00.000Z'),
          fechaFin: null,
          dias: null,
          createdAt: new Date('2026-01-20T00:00:00.000Z'),
        },
      ]);
      mockQueryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 'emp-retired', estado: 'INACTIVO', deletedAt: null },
        ]);

      await expect(
        service.recalculatePayroll(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow('asociado(s) a novedades PILA no está(n) activo(s)');

      expect(mockPayrollRunFindMany).not.toHaveBeenCalled();
      expect(mockPayrollRunDeleteMany).not.toHaveBeenCalled();
      expect(mockPayrollRunCreate).not.toHaveBeenCalled();
    });

    it('si el período se aprueba mientras se prepara el recálculo, conserva las liquidaciones existentes', async () => {
      setupPayrollGeneration();
      mockPayrollPeriodFindFirst
        .mockResolvedValueOnce(makePeriod('CALCULADA'))
        .mockResolvedValueOnce(makePeriod('APROBADA'));

      await expect(
        service.recalculatePayroll(TENANT, USER, PERIOD_ID),
      ).rejects.toThrow(ConflictException);

      expect(mockPayrollRunFindMany).not.toHaveBeenCalled();
      expect(mockPayrollConceptDeleteMany).not.toHaveBeenCalled();
      expect(mockPayrollRunDeleteMany).not.toHaveBeenCalled();
      expect(mockPayrollRunCreate).not.toHaveBeenCalled();
      expect(mockPayrollPeriodUpdateMany).not.toHaveBeenCalled();
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

    it('recaptura afiliaciones, sede y eventos PILA al recrear la nómina', async () => {
      setupPayrollGeneration();
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CALCULADA'));
      mockPayrollRunFindMany.mockResolvedValue([{ id: 'run-anterior' }]);
      mockAfiliacionFindMany.mockResolvedValue([
        {
          id: 'affiliation-previous',
          empleadoId: 'emp-1',
          tipoCotizanteCodigo: '01',
          subtipoCotizanteCodigo: null,
          epsCodigo: 'EPS000',
          epsNombre: 'EPS anterior',
          fondoPensionCodigo: 'AFP000',
          fondoPensionNombre: 'Fondo anterior',
          arlCodigo: 'ARL000',
          arlNombre: 'ARL anterior',
          arlClaseRiesgo: '1',
          cajaCompensacionCodigo: 'CCF000',
          cajaCompensacionNombre: 'Caja anterior',
          vigenteDesde: new Date('2025-01-01T00:00:00.000Z'),
          vigenteHasta: new Date('2026-01-15T00:00:00.000Z'),
          versionCaptura: 'PILA_AFFILIATION_CAPTURE_V1',
        },
        {
          id: 'affiliation-current',
          empleadoId: 'emp-1',
          tipoCotizanteCodigo: '01',
          subtipoCotizanteCodigo: null,
          epsCodigo: 'EPS001',
          epsNombre: 'EPS vigente',
          fondoPensionCodigo: 'AFP001',
          fondoPensionNombre: 'Fondo vigente',
          arlCodigo: 'ARL001',
          arlNombre: 'ARL vigente',
          arlClaseRiesgo: '1',
          cajaCompensacionCodigo: 'CCF001',
          cajaCompensacionNombre: 'Caja vigente',
          vigenteDesde: new Date('2026-01-16T00:00:00.000Z'),
          vigenteHasta: null,
          versionCaptura: 'PILA_AFFILIATION_CAPTURE_V1',
        },
      ]);
      mockSedeFindMany.mockResolvedValue([
        {
          id: 'sede-1',
          nombre: 'Sede vigente',
          direccion: 'Calle 1',
          municipio: {
            id: 'municipio-1',
            codigo: '08001',
            nombre: 'Barranquilla',
            departamento: 'Atlántico',
          },
        },
      ]);
      mockPilaWorkAssignmentFindMany.mockResolvedValue([
        {
          id: 'risk-assignment-1',
          tenantId: TENANT,
          empleadoId: 'emp-1',
          codigoActividadEconomica: '1131202',
          formatoNormativoVersion: 'DECRETO_768_2022',
          vigenteDesde: new Date('2026-01-01T00:00:00.000Z'),
          vigenteHasta: null,
          centroTrabajo: {
            id: 'pila-center-1',
            tenantId: TENANT,
            sedeId: 'sede-1',
            arlCodigo: 'ARL001',
            codigoCentro: '0001',
            nombre: 'Centro declarado',
          },
        },
      ]);
      mockPayrollPilaEventFindMany.mockResolvedValue([
        {
          id: 'event-ige-1',
          employeeId: 'emp-1',
          codigo: PilaEventCode.IGE,
          fechaInicio: new Date('2026-01-12T00:00:00.000Z'),
          fechaFin: new Date('2026-01-14T00:00:00.000Z'),
          dias: null,
        },
      ]);
      mockQueryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 'emp-1', estado: 'ACTIVO', deletedAt: null },
        ]);

      await service.recalculatePayroll(TENANT, USER, PERIOD_ID);

      expect(mockPayrollRunCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pilaSource: expect.objectContaining({
            employee: expect.objectContaining({ cedula: '1000000001' }),
            worksite: expect.objectContaining({
              sedeId: 'sede-1',
              municipio: expect.objectContaining({ codigo: '08001' }),
            }),
            affiliations: expect.arrayContaining([
              expect.objectContaining({
                affiliationId: 'affiliation-previous',
                epsCodigo: 'EPS000',
                vigenteDesde: '2025-01-01',
                vigenteHasta: '2026-01-15',
              }),
              expect.objectContaining({
                affiliationId: 'affiliation-current',
                epsCodigo: 'EPS001',
                vigenteDesde: '2026-01-16',
                vigenteHasta: null,
                versionCaptura: 'PILA_AFFILIATION_CAPTURE_V1',
              }),
            ]),
            pilaEvents: [
              {
                eventId: 'event-ige-1',
                codigo: PilaEventCode.IGE,
                fechaInicio: '2026-01-12',
                fechaFin: '2026-01-14',
                dias: null,
              },
            ],
            pilaRiskAssignments: [
              expect.objectContaining({
                assignmentId: 'risk-assignment-1',
                tenantId: TENANT,
                codigoActividadEconomica: '1131202',
                formatoNormativoVersion: 'DECRETO_768_2022',
                vigenteDesde: '2026-01-01',
                vigenteHasta: null,
                centroTrabajo: expect.objectContaining({
                  centroTrabajoId: 'pila-center-1',
                  tenantId: TENANT,
                  codigoCentro: '0001',
                }),
              }),
            ],
          }),
        }),
      });
      expect(mockAfiliacionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT,
            empleadoId: { in: ['emp-1'] },
            vigenteDesde: { lte: new Date('2026-01-31') },
            OR: [
              { vigenteHasta: null },
              { vigenteHasta: { gte: new Date('2026-01-01') } },
            ],
          }),
        }),
      );
      expect(mockSedeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT, id: { in: ['sede-1'] } },
        }),
      );
      expect(mockPayrollRunDeleteMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT, payrollPeriodId: PERIOD_ID },
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

    it('no expone la captura PILA previa a la aprobación', async () => {
      mockPayrollPeriodFindFirst.mockResolvedValue(makePeriod('CALCULADA'));
      mockPayrollRunFindMany.mockResolvedValue([
        { ...makeRunForSnapshot(), pilaSource: { cedula: 'dato-privado' } },
      ]);

      const period = await service.findOnePeriod(TENANT, PERIOD_ID);

      expect(period.runs[0]).not.toHaveProperty('pilaSource');
    });
  });

  // ── createPeriod: fija BORRADOR explícito ───────────────────────────────────

  describe('createPeriod', () => {
    it('fija status: BORRADOR explícito (no depende del @default de la DB)', async () => {
      const expectedPaymentDate = new Date('2026-11-05T00:00:00.000Z');
      const created = jest.fn().mockResolvedValue(
        makePeriod('BORRADOR', {
          fechaPrevistaPagoPila: expectedPaymentDate,
        }),
      );
      (
        mockPrisma as unknown as { payrollPeriod: { create: typeof created } }
      ).payrollPeriod.create = created;

      await service.createPeriod(TENANT, USER, {
        nombre: 'Enero 2026',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-01-31',
        fechaPrevistaPagoPila: '2026-11-05',
      });

      expect(created).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'BORRADOR',
            fechaPrevistaPagoPila: expectedPaymentDate,
          }),
        }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYROLL_PERIOD_CREATED',
          metadata: {
            periodName: 'Enero 2026',
            payrollPeriodId: PERIOD_ID,
            fechaPrevistaPagoPila: '2026-11-05',
          },
        }),
      );
    });
  });

  describe('contabilizar — causación contable (ACC-13)', () => {
    const accountingRun = {
      centroCostoId: 'cc-1',
      employee: { cedula: 'employee-cc-1', tipoDocumento: 'CC' },
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
      mockTerceroFindMany.mockResolvedValue([
        {
          id: 'employee-thirdparty-1',
          tipoDocumento: 'CC',
          numeroDocumento: 'employee-cc-1',
        },
      ]);
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
      expect(
        mockPayrollSnapshotFindMany.mock.calls[0][0].select,
      ).not.toHaveProperty('pilaPayload');
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
