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
  $transaction: jest.fn(),
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

const TENANT = 'tenant-1';
const USER = 'user-1';
const PERIOD_ID = 'period-1';

function makePeriod(status: string, overrides: Record<string, unknown> = {}) {
  return {
    id: PERIOD_ID,
    tenantId: TENANT,
    nombre: 'Enero 2026',
    fechaInicio: new Date('2026-01-01'),
    fechaFin: new Date('2026-01-31'),
    status,
    aprobadoPorId: null,
    aprobadoEn: null,
    ...overrides,
  };
}

/** Fila mínima de ParametroLegalNomina para que toSnapshot() no falle. */
function makeLegalParam() {
  return {
    id: 'param-1',
    smmlv: 1_423_500,
    auxilioTransporte: 202_897,
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
  };
}

function setupPayrollGeneration(
  overrides: {
    contratoSedeId?: string | null;
    centrosCosto?: Array<{ id: string; sedeId: string | null }>;
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
    overrides.centrosCosto ?? [{ id: 'cc-1', sedeId: 'sede-1' }],
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
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma),
    );
    mockPayrollPeriodFindFirstOrThrow.mockImplementation(async () =>
      makePeriod('APROBADA'),
    );

    const module = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get(PayrollService);
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
      mockPayrollPeriodFindFirst.mockResolvedValue({ status: 'EN_REVISION' });
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
      mockPayrollPeriodFindFirst.mockResolvedValue({ status: 'EN_REVISION' });
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
  });

  // ── rechazar: EN_REVISION → CALCULADA ────────────────────────────────────────

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
        select: { id: true, sedeId: true },
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
