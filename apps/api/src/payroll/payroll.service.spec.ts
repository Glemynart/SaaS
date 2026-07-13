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
import { PayrollService } from './payroll.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Test } from '@nestjs/testing';

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
const mockPayrollCorrectionCreate = jest.fn();
const mockPayrollCorrectionFindMany = jest.fn();
const mockPayrollCorrectionFindFirst = jest.fn();
const mockPayrollCorrectionFindFirstOrThrow = jest.fn();
const mockPayrollCorrectionUpdateMany = jest.fn();
const mockPayrollBlockFindMany = jest.fn();
const mockPayrollBlockFindFirst = jest.fn();
const mockPayrollBlockCreate = jest.fn();
const mockPayrollBlockUpdate = jest.fn();

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
  payrollSnapshot: { create: mockPayrollSnapshotCreate },
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
  $transaction: jest.fn(),
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

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
    mockPayrollCorrectionCreate.mockResolvedValue({});
    mockPayrollCorrectionFindMany.mockResolvedValue([]);
    mockPayrollCorrectionFindFirst.mockResolvedValue(null);
    mockPayrollCorrectionFindFirstOrThrow.mockResolvedValue({});
    mockPayrollCorrectionUpdateMany.mockResolvedValue({ count: 1 });
    mockPayrollBlockFindMany.mockResolvedValue([]);
    mockPayrollBlockFindFirst.mockResolvedValue(null);
    mockPayrollBlockCreate.mockResolvedValue({});
    mockPayrollBlockUpdate.mockResolvedValue({});

    const module = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
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
        }),
      ).rejects.toThrow(ConflictException);
      expect(mockPayrollCorrectionCreate).not.toHaveBeenCalled();
      expect(mockAudit.log).not.toHaveBeenCalled();
    });

    it('rechaza descripcion vacia tras trim', async () => {
      await expect(
        service.createCorrection(TENANT, USER, PERIOD_ID, {
          descripcion: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPayrollPeriodFindFirst).not.toHaveBeenCalled();
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
        },
      ]);
      expect(mockPayrollCorrectionFindMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT, payrollPeriodId: PERIOD_ID },
        orderBy: [{ createdAt: 'desc' }],
      });
      expect(mockPayrollRunFindMany).not.toHaveBeenCalled();
      expect(mockPayrollSnapshotCreate).not.toHaveBeenCalled();
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
});
