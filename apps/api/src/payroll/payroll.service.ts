import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  Prisma,
  PayrollBlockStatus,
  PayrollCorrectionStatus,
  PayrollPeriodStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../accounting/ledger/ledger.service';
import {
  PAYROLL_ACCOUNTING_REQUIRED_ROLES,
  PayrollAccountingPreflightResult,
  PayrollAccountingPreflightService,
} from './accounting-preflight/payroll-accounting-preflight.service';
import {
  buildPayrollAccrualLines,
  PayrollSystemAccounts,
} from './accounting/payroll-accounting.mapper';
import {
  CreatePayrollPeriodDto,
  CreatePayrollNoveltyDto,
  UpdatePayrollPilaPaymentDateDto,
} from './dto/create-payroll.dto';
import { CreatePayrollCorrectionDto } from './dto/payroll-correction.dto';
import { calculate } from './calculator/payroll-calculator';
import {
  PayrollCalculationInput,
  PayrollCalculationResult,
  ArlClase,
  ConceptCodigo,
  FspTramo,
  LegalParamsSnapshot,
  PayrollConceptType,
} from './calculator/payroll-types';
import {
  EmpForPayroll,
  ContratoForPayroll,
  buildCalculationInput,
  resolveContrato,
  toSnapshot,
} from './payroll-mapper';
import { buildPayrollPeriodSnapshot } from './payroll-snapshot-period';
import { assertTransition } from './payroll-states';
import { assertCorrectionTransition } from './payroll-correction-states';
import {
  functionalBlock,
  PayrollBlockCode,
  PayrollFunctionalBlock,
} from './payroll-evaluation';
import {
  createCorrectionIntentPayload,
  parseCorrectionIntentPayload,
  parseCorrectionMaterialization,
  PayrollCorrectionCalculationInput,
  PayrollCorrectionDeltaEntry,
  PayrollCorrectionIntent,
  PayrollCorrectionIntentKind,
  PayrollCorrectionMaterialization,
  PAYROLL_CORRECTION_MATERIALIZATION_VERSION,
} from './corrections/payroll-correction.types';

/** Estados en los que el motor de cálculo puede ejecutarse (ADR-002 §6). */
const GENERATE_ALLOWED_STATUSES: PayrollPeriodStatus[] = [
  PayrollPeriodStatus.BORRADOR,
  PayrollPeriodStatus.CALCULADA,
];

/** Idéntico rango que generate: recalcular es libre hasta APROBADA (§6). */
const RECALCULATE_ALLOWED_STATUSES: PayrollPeriodStatus[] =
  GENERATE_ALLOWED_STATUSES;

const SNAPSHOT_PAYLOAD_VERSION = 1;
const CALCULATION_TRACE_VERSION = 1;

const PAYROLL_ACCOUNTING_VOUCHER_SELECT = {
  id: true,
  tenantId: true,
  numero: true,
  fecha: true,
  concepto: true,
  estado: true,
  totalDebito: true,
  totalCredito: true,
  movimientos: {
    orderBy: { linea: 'asc' },
    select: {
      linea: true,
      descripcion: true,
      debito: true,
      credito: true,
      cuenta: { select: { codigo: true, nombre: true } },
      centroCosto: { select: { codigo: true, nombre: true } },
    },
  },
  reversos: {
    select: { id: true, tenantId: true, estado: true },
  },
} satisfies Prisma.ComprobanteContableSelect;

type PayrollAccountingVoucherRecord = Prisma.ComprobanteContableGetPayload<{
  select: typeof PAYROLL_ACCOUNTING_VOUCHER_SELECT;
}>;

function mapPayrollAccountingVoucher(voucher: PayrollAccountingVoucherRecord) {
  const reversado = voucher.reversos.some(
    (reverso) =>
      reverso.tenantId === voucher.tenantId &&
      reverso.estado === 'CONTABILIZADO',
  );
  return {
    id: voucher.id,
    numero: voucher.numero,
    fecha: voucher.fecha,
    concepto: voucher.concepto,
    estado: voucher.estado,
    reversado,
    vigente: voucher.estado === 'CONTABILIZADO' && !reversado,
    totalDebito: Number(voucher.totalDebito),
    totalCredito: Number(voucher.totalCredito),
    movimientos: voucher.movimientos.map((movement) => ({
      linea: movement.linea,
      descripcion: movement.descripcion,
      debito: Number(movement.debito),
      credito: Number(movement.credito),
      cuentaCodigo: movement.cuenta.codigo,
      cuentaNombre: movement.cuenta.nombre,
      centroCostoCodigo: movement.centroCosto?.codigo ?? null,
      centroCostoNombre: movement.centroCosto?.nombre ?? null,
    })),
  };
}

type CostCenterForPayrollTrace = {
  id: string;
  codigo: string;
  nombre: string;
  sedeId: string | null;
};

type NoveltyForPayrollTrace = {
  id: string;
  tipo: string;
  descripcion: string | null;
  fecha: Date;
  valor: Prisma.Decimal | null;
};

type PayrollCalculationTrace = {
  traceVersion: number;
  period: {
    nombre: string;
    fechaInicio: string | null;
    fechaFin: string | null;
  };
  employee: {
    salarioIntegralUsado: boolean;
  };
  contract: {
    contratoId: string;
    tipo?: string;
    estado: string;
    fechaInicio: string | null;
    fechaFin: string | null;
    salarioContrato: number;
    sedeId: string | null;
    claseRiesgoArlOriginal: number | null;
    claseRiesgoArlUsada: number;
    fallbackUsado: boolean;
  } | null;
  costCenter: {
    codigo: string;
    nombre: string;
    sedeId: string | null;
  } | null;
  companyPolicy: {
    aportesExonerados: boolean;
  };
  legalParameters: Record<string, unknown>;
  novelties: Array<{
    noveltyId: string;
    tipo: string;
    descripcion: string | null;
    fecha: string | null;
    valor: number | null;
  }>;
  calculationEvidence: {
    politicaRedondeoAplicada: string;
  };
};

type PayrollBlockMap = Record<string, PayrollFunctionalBlock[]>;

type CorrectionSnapshot = {
  id: string;
  tenantId: string;
  payrollPeriodId: string;
  employeeId: string;
  centroCostoId: string | null;
  payload: Prisma.JsonValue;
};

type SnapshotConcept = {
  codigo: string;
  tipo: PayrollConceptType;
  valor: number;
};

type ParsedCorrectionSnapshot = {
  id: string;
  employeeId: string;
  centroCostoId: string | null;
  concepts: SnapshotConcept[];
  calculationInput: PayrollCalculationInput;
};

type EffectiveConceptAmount = {
  codigo: string;
  tipo: PayrollConceptType;
  centroCostoId: string | null;
  valor: number;
};

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private auditService: AuditService,
    private readonly ledger: LedgerService,
    private readonly accountingPreflight: PayrollAccountingPreflightService,
  ) {}

  async contabilizar(
    tenantId: string,
    userId: string,
    periodId: string,
  ): Promise<
    | {
        status: 'PREFLIGHT_ERROR';
        preflight: PayrollAccountingPreflightResult;
      }
    | {
        status: 'CAUSADA' | 'YA_CAUSADA';
        payrollPeriodId: string;
        comprobanteId: string;
      }
  > {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
      select: { id: true, fechaFin: true },
    });
    if (!period) throw new NotFoundException('Período de nómina no encontrado');

    return this.tenantPrisma.execute(async (tx) => {
      const current = await tx.payrollPeriod.findFirst({
        where: { id: periodId, tenantId },
        select: { id: true, nombre: true, fechaFin: true, status: true },
      });
      if (!current)
        throw new NotFoundException('Período de nómina no encontrado');

      const existing = await tx.comprobanteContable.findFirst({
        where: {
          tenantId,
          origenTipo: 'PAYROLL',
          origenId: current.id,
          origenEvento: 'CAUSACION',
        },
        select: {
          id: true,
          estado: true,
          reversos: {
            where: { tenantId, estado: 'CONTABILIZADO' },
            select: { id: true },
          },
        },
      });

      if (current.status === PayrollPeriodStatus.CAUSADA) {
        if (
          !existing ||
          existing.estado !== 'CONTABILIZADO' ||
          existing.reversos.length > 0
        ) {
          throw new ConflictException(
            'La causación de este período está anulada o revertida; revisa el asiento contable antes de continuar.',
          );
        }
        return {
          status: 'YA_CAUSADA' as const,
          payrollPeriodId: current.id,
          comprobanteId: existing.id,
        };
      }

      if (current.status !== PayrollPeriodStatus.APROBADA) {
        throw new BadRequestException(
          `Solo se puede contabilizar un período APROBADA; estado actual: ${current.status}.`,
        );
      }
      if (existing) {
        if (
          existing.estado !== 'CONTABILIZADO' ||
          existing.reversos.length > 0
        ) {
          throw new ConflictException(
            'Ya existe una causación anulada o revertida para este período; no se puede volver a causar con el mismo origen.',
          );
        }
        throw new ConflictException(
          'Ya existe una causación para este período de nómina.',
        );
      }

      const preflight = await this.accountingPreflight.validate(tenantId, {
        fechaCausacion: current.fechaFin,
      });
      if (preflight.status === 'ERROR') {
        return { status: 'PREFLIGHT_ERROR' as const, preflight };
      }

      const [maps, accountingPeriod, voucherType, runs] = await Promise.all([
        tx.cuentaSistemaMap.findMany({
          where: {
            tenantId,
            activo: true,
            rol: { in: [...PAYROLL_ACCOUNTING_REQUIRED_ROLES] },
          },
          select: { rol: true, cuentaId: true },
        }),
        tx.periodoContable.findFirst({
          where: {
            tenantId,
            estado: 'ABIERTO',
            fechaInicio: { lte: current.fechaFin },
            fechaFin: { gte: current.fechaFin },
          },
          select: { id: true },
        }),
        tx.tipoComprobante.findFirst({
          where: { codigo: 'NOM', activo: true },
          select: { id: true },
        }),
        tx.payrollRun.findMany({
          where: { tenantId, payrollPeriodId: current.id },
          select: {
            centroCostoId: true,
            totalDevengos: true,
            totalDeducciones: true,
            netoPagar: true,
            totalAportesPatronales: true,
            totalProvisiones: true,
            employee: {
              select: {
                cedula: true,
                tipoDocumento: true,
              },
            },
            concepts: { select: { codigo: true, tipo: true, valor: true } },
          },
        }),
      ]);

      if (!accountingPeriod || !voucherType) {
        throw new ConflictException(
          'La configuración contable cambió después del preflight.',
        );
      }
      if (runs.length === 0) {
        throw new BadRequestException(
          'No existen liquidaciones válidas para contabilizar.',
        );
      }

      const employeeIdentities = [
        ...new Map(
          runs.map((run) => [
            `${run.employee.tipoDocumento}\u0000${run.employee.cedula}`,
            {
              tipoDocumento: run.employee.tipoDocumento,
              numeroDocumento: run.employee.cedula,
            },
          ]),
        ).values(),
      ];
      const thirdParties = await tx.tercero.findMany({
        where: {
          tenantId,
          activo: true,
          deletedAt: null,
          esEmpleado: true,
          OR: employeeIdentities,
        },
        select: {
          id: true,
          tipoDocumento: true,
          numeroDocumento: true,
        },
      });
      const thirdPartyByIdentity = new Map(
        thirdParties.map((thirdParty) => [
          `${thirdParty.tipoDocumento}\u0000${thirdParty.numeroDocumento}`,
          thirdParty.id,
        ]),
      );
      const missingThirdParties = runs
        .filter(
          (run) =>
            !thirdPartyByIdentity.has(
              `${run.employee.tipoDocumento}\u0000${run.employee.cedula}`,
            ),
        )
        .map((run) => run.employee.cedula);
      if (missingThirdParties.length > 0) {
        throw new BadRequestException(
          `Cree o active un tercero contable con el rol empleado para cada documento antes de contabilizar la nómina: ${[...new Set(missingThirdParties)].join(', ')}.`,
        );
      }

      const accountMap = new Map(maps.map((map) => [map.rol, map.cuentaId]));
      const accounts = Object.fromEntries(
        PAYROLL_ACCOUNTING_REQUIRED_ROLES.map((role) => {
          const accountId = accountMap.get(role);
          if (!accountId) {
            throw new ConflictException(
              `El mapeo contable ${role} no está disponible para la causación.`,
            );
          }
          return [role, accountId];
        }),
      ) as PayrollSystemAccounts;

      const comprobante = await this.ledger.registrarComprobante(
        {
          tenantId,
          userId,
          tipoComprobanteId: voucherType.id,
          periodoId: accountingPeriod.id,
          fecha: current.fechaFin,
          concepto: `Causación nómina ${current.nombre}`,
          lineas: buildPayrollAccrualLines(
            runs.map((run) => ({
              terceroId: thirdPartyByIdentity.get(
                `${run.employee.tipoDocumento}\u0000${run.employee.cedula}`,
              )!,
              centroCostoId: run.centroCostoId,
              totalDevengos: Number(run.totalDevengos),
              totalDeducciones: Number(run.totalDeducciones),
              netoPagar: Number(run.netoPagar),
              totalAportesPatronales: run.totalAportesPatronales
                ? Number(run.totalAportesPatronales)
                : null,
              totalProvisiones: run.totalProvisiones
                ? Number(run.totalProvisiones)
                : null,
              concepts: run.concepts.map((concept) => ({
                codigo: concept.codigo,
                tipo: concept.tipo,
                valor: Number(concept.valor),
              })),
            })),
            accounts,
          ),
          origenTipo: 'PAYROLL',
          origenId: current.id,
          origenEvento: 'CAUSACION',
        },
        tx,
      );

      const transition = await tx.payrollPeriod.updateMany({
        where: {
          id: current.id,
          tenantId,
          status: PayrollPeriodStatus.APROBADA,
        },
        data: { status: PayrollPeriodStatus.CAUSADA },
      });
      if (transition.count === 0) {
        throw new ConflictException(
          'El período de nómina fue modificado durante la causación.',
        );
      }

      await this.auditService.log(
        {
          tenantId,
          userId,
          action: 'PAYROLL_ACCRUED',
          entityType: 'PayrollPeriod',
          entityId: current.id,
          metadata: {
            comprobanteId: comprobante.id,
            from: 'APROBADA',
            to: 'CAUSADA',
          },
        },
        tx,
      );

      return {
        status: 'CAUSADA' as const,
        payrollPeriodId: current.id,
        comprobanteId: comprobante.id,
      };
    });
  }

  async createPeriod(
    tenantId: string,
    userId: string,
    dto: CreatePayrollPeriodDto,
  ) {
    const period = await this.prisma.payrollPeriod.create({
      data: {
        ...dto,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin: new Date(dto.fechaFin),
        fechaPrevistaPagoPila: dto.fechaPrevistaPagoPila
          ? new Date(dto.fechaPrevistaPagoPila)
          : null,
        tenantId,
        // Explícito: no depender del @default de la DB (red de seguridad,
        // no fuente de verdad). Ver ADR-002 §6 / U1 Fase 1.
        status: PayrollPeriodStatus.BORRADOR,
      },
    });
    this.auditService
      .log({
        tenantId,
        userId,
        action: 'PAYROLL_PERIOD_CREATED',
        entityType: 'PayrollPeriod',
        entityId: period.id,
        metadata: { periodName: period.nombre, payrollPeriodId: period.id },
      })
      .catch(() => {});
    return period;
  }

  async updatePilaPaymentDate(
    tenantId: string,
    userId: string,
    periodId: string,
    dto: UpdatePayrollPilaPaymentDateDto,
  ) {
    if (dto.fechaPrevistaPagoPila === undefined) {
      throw new BadRequestException(
        'Debe indicar una fecha prevista o null para quitarla.',
      );
    }
    const fechaPrevistaPagoPila = dto.fechaPrevistaPagoPila
      ? new Date(`${dto.fechaPrevistaPagoPila}T00:00:00.000Z`)
      : null;
    const editableStatuses: PayrollPeriodStatus[] = [
      PayrollPeriodStatus.BORRADOR,
      PayrollPeriodStatus.CALCULADA,
      PayrollPeriodStatus.EN_REVISION,
    ];

    return this.prisma.$transaction(async (tx) => {
      const period = await tx.payrollPeriod.findFirst({
        where: { id: periodId, tenantId },
      });
      if (!period) throw new NotFoundException('Período no encontrado');
      if (!editableStatuses.includes(period.status)) {
        throw new ConflictException(
          'La fecha prevista de aportes PILA solo se puede editar antes de aprobar la nómina.',
        );
      }

      const updated = await tx.payrollPeriod.updateMany({
        where: { id: periodId, tenantId, status: { in: editableStatuses } },
        data: { fechaPrevistaPagoPila },
      });
      if (updated.count === 0) {
        throw new ConflictException(
          'El período fue aprobado o modificado durante la actualización.',
        );
      }

      await this.auditService.log(
        {
          tenantId,
          userId,
          action: 'PAYROLL_PILA_PAYMENT_DATE_UPDATED',
          entityType: 'PayrollPeriod',
          entityId: periodId,
          metadata: {
            fechaAnterior:
              period.fechaPrevistaPagoPila?.toISOString().slice(0, 10) ?? null,
            fechaNueva: dto.fechaPrevistaPagoPila,
          },
        },
        tx,
      );

      return tx.payrollPeriod.findFirstOrThrow({
        where: { id: periodId, tenantId },
      });
    });
  }

  async findAllPeriods(tenantId: string) {
    const periods = await this.prisma.payrollPeriod.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { runs: true } } },
    });
    return periods.map((p) => ({
      ...p,
      empleadosProcesados: p._count.runs,
      _count: undefined,
    }));
  }

  async findOnePeriod(tenantId: string, id: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id, tenantId },
    });
    if (!period) throw new NotFoundException('Período no encontrado');

    const snapshotsQuery =
      period.status === PayrollPeriodStatus.APROBADA ||
      period.status === PayrollPeriodStatus.CAUSADA
        ? this.prisma.payrollSnapshot.findMany({
            where: { tenantId, payrollPeriodId: id },
            select: {
              id: true,
              employeeId: true,
              centroCostoId: true,
              employee: {
                select: {
                  id: true,
                  primerNombre: true,
                  segundoNombre: true,
                  primerApellido: true,
                  segundoApellido: true,
                },
              },
              centroCosto: {
                select: { id: true, codigo: true, nombre: true },
              },
            },
            orderBy: [{ createdAt: 'asc' }, { employeeId: 'asc' }],
          })
        : Promise.resolve([]);

    const [runs, voucher, snapshots] = await Promise.all([
      this.prisma.payrollRun.findMany({
        where: { tenantId, payrollPeriodId: id },
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
          centroCosto: {
            select: { id: true, codigo: true, nombre: true, sedeId: true },
          },
          concepts: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.comprobanteContable.findFirst({
        where: {
          tenantId,
          origenTipo: 'PAYROLL',
          origenId: id,
          origenEvento: 'CAUSACION',
        },
        select: PAYROLL_ACCOUNTING_VOUCHER_SELECT,
      }),
      snapshotsQuery,
    ]);

    const totalDevengos = runs.reduce((s, r) => s + Number(r.totalDevengos), 0);
    const totalDeducciones = runs.reduce(
      (s, r) => s + Number(r.totalDeducciones),
      0,
    );
    const totalNeto = runs.reduce((s, r) => s + Number(r.netoPagar), 0);

    return {
      period,
      runs,
      snapshots,
      totals: { totalDevengos, totalDeducciones, totalNeto },
      accountingVoucher: voucher ? mapPayrollAccountingVoucher(voucher) : null,
    };
  }

  async findPeriodBlocks(tenantId: string, periodId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
      select: { id: true },
    });
    if (!period) throw new NotFoundException('PerÃ­odo no encontrado');

    return this.prisma.payrollBlock.findMany({
      where: { tenantId, payrollPeriodId: periodId },
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
  }

  async findPeriodCorrections(tenantId: string, periodId: string) {
    await this.requireApprovedPeriodForCorrections(
      tenantId,
      periodId,
      'Solo se pueden consultar correcciones sobre un período aprobado',
    );

    const corrections = await this.prisma.payrollCorrection.findMany({
      where: { tenantId, payrollPeriodId: periodId },
      orderBy: [{ createdAt: 'desc' }],
    });
    if (corrections.length === 0) return [];

    const vouchers = await this.prisma.comprobanteContable.findMany({
      where: {
        tenantId,
        origenTipo: 'PAYROLL_CORRECTION',
        origenId: { in: corrections.map((correction) => correction.id) },
        origenEvento: 'AJUSTE',
      },
      select: { ...PAYROLL_ACCOUNTING_VOUCHER_SELECT, origenId: true },
    });
    const voucherByCorrectionId = new Map(
      vouchers
        .filter((voucher) => voucher.origenId !== null)
        .map((voucher) => [voucher.origenId!, voucher]),
    );

    return corrections.map((correction) => {
      const voucher = voucherByCorrectionId.get(correction.id);
      return {
        ...correction,
        accountingVoucher: voucher
          ? mapPayrollAccountingVoucher(voucher)
          : null,
      };
    });
  }

  async createCorrection(
    tenantId: string,
    userId: string,
    periodId: string,
    dto: CreatePayrollCorrectionDto,
  ) {
    const descripcion = dto.descripcion.trim();
    if (descripcion.length === 0) {
      throw new BadRequestException(
        'La descripción de la corrección es obligatoria',
      );
    }
    const intent = createCorrectionIntentPayload(dto.intents);

    const period = await this.requireApprovedPeriodForCorrections(
      tenantId,
      periodId,
      'Solo se pueden registrar correcciones sobre un período aprobado',
    );

    return this.prisma.$transaction(async (tx) => {
      await this.validateCorrectionIntentReferences(
        tx,
        tenantId,
        period.id,
        intent.intents,
      );

      const correction = await tx.payrollCorrection.create({
        data: {
          tenantId,
          payrollPeriodId: period.id,
          status: PayrollCorrectionStatus.BORRADOR,
          descripcion,
          intentVersion: intent.version,
          intent,
        },
      });

      await this.auditService.log(
        {
          tenantId,
          userId,
          action: 'PAYROLL_CORRECTION_CREATED',
          entityType: 'PayrollCorrection',
          entityId: correction.id,
          metadata: {
            payrollPeriodId: period.id,
            periodName: period.nombre,
            status: PayrollCorrectionStatus.BORRADOR,
            intentIds: intent.intents.map((item) => item.id),
            intentKinds: intent.intents.map((item) => item.kind),
          },
        },
        tx,
      );

      return correction;
    });
  }

  async enviarCorrectionARevision(
    tenantId: string,
    userId: string,
    correctionId: string,
  ) {
    return this.transitionCorrection(
      tenantId,
      userId,
      correctionId,
      PayrollCorrectionStatus.BORRADOR,
      PayrollCorrectionStatus.EN_REVISION,
      'PAYROLL_CORRECTION_SENT_TO_REVIEW',
    );
  }

  async aprobarCorrection(
    tenantId: string,
    userId: string,
    correctionId: string,
  ) {
    return this.approveCorrectionWithMaterialization(
      tenantId,
      userId,
      correctionId,
    );
  }

  async rechazarCorrection(
    tenantId: string,
    userId: string,
    correctionId: string,
    motivo?: string,
  ) {
    return this.transitionCorrection(
      tenantId,
      userId,
      correctionId,
      PayrollCorrectionStatus.EN_REVISION,
      PayrollCorrectionStatus.RECHAZADA,
      'PAYROLL_CORRECTION_REJECTED',
      motivo ? { motivo } : undefined,
    );
  }

  async cancelarCorrection(
    tenantId: string,
    userId: string,
    correctionId: string,
    motivo?: string,
  ) {
    const correction = await this.prisma.payrollCorrection.findFirst({
      where: { id: correctionId, tenantId },
      select: { status: true },
    });
    if (!correction) throw new NotFoundException('Corrección no encontrada');
    if (
      correction.status !== PayrollCorrectionStatus.BORRADOR &&
      correction.status !== PayrollCorrectionStatus.EN_REVISION
    ) {
      throw new BadRequestException(
        `Transición de corrección no permitida: ${correction.status} → ${PayrollCorrectionStatus.CANCELADA}`,
      );
    }

    return this.transitionCorrection(
      tenantId,
      userId,
      correctionId,
      correction.status,
      PayrollCorrectionStatus.CANCELADA,
      'PAYROLL_CORRECTION_CANCELED',
      motivo ? { motivo } : undefined,
    );
  }

  async excludeBlock(
    tenantId: string,
    userId: string,
    blockId: string,
    motivo?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const block = await tx.payrollBlock.findFirst({
        where: { id: blockId, tenantId },
      });
      if (!block) throw new NotFoundException('Bloqueo no encontrado');

      if (block.status === PayrollBlockStatus.RESOLVED) {
        throw new BadRequestException(
          'No se puede excluir un bloqueo que ya esta resuelto',
        );
      }

      if (block.status === PayrollBlockStatus.EXCLUDED) {
        return block;
      }

      const updated = await tx.payrollBlock.update({
        where: { id: block.id },
        data: {
          status: PayrollBlockStatus.EXCLUDED,
          excludedAt: new Date(),
          excludedById: userId,
          exclusionReason: motivo?.trim() || null,
        },
      });

      await this.auditService.log(
        {
          tenantId,
          userId,
          action: 'PAYROLL_BLOCK_EXCLUDED',
          entityType: 'PayrollBlock',
          entityId: block.id,
          metadata: {
            payrollPeriodId: block.payrollPeriodId,
            employeeId: block.employeeId,
            code: block.code,
            motivo: motivo ?? null,
          },
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Alias legado de aprobación directa (P0/N2): transiciona
   * CALCULADA → APROBADA sin pasar por EN_REVISION. Existe solo mientras
   * el frontend no adopte el flujo de revisión (`enviarARevision` /
   * `aprobar` / `rechazar`); no se valida contra `VALID_TRANSITIONS`
   * a propósito (evita introducir un atajo en el flujo oficial del §6 del
   * ADR-002) y se audita con una acción distinta de `aprobar` para
   * mantener ambas rutas trazables por separado.
   *
   * @deprecated Eliminar cuando el frontend adopte el flujo de revisión.
   */
  async closePeriod(tenantId: string, userId: string, id: string) {
    return this.approvePeriod(
      tenantId,
      userId,
      id,
      PayrollPeriodStatus.CALCULADA,
      'PAYROLL_PERIOD_APPROVED_LEGACY_CLOSE',
      'LEGACY_CLOSE',
    );
  }
  async enviarARevision(tenantId: string, userId: string, id: string) {
    return this.transitionPeriod(
      tenantId,
      userId,
      id,
      PayrollPeriodStatus.CALCULADA,
      PayrollPeriodStatus.EN_REVISION,
      'PAYROLL_PERIOD_SENT_TO_REVIEW',
    );
  }

  /** EN_REVISION → APROBADA (ADR-002 §6). Terminal en P1. */
  async aprobar(tenantId: string, userId: string, id: string) {
    return this.approvePeriod(
      tenantId,
      userId,
      id,
      PayrollPeriodStatus.EN_REVISION,
      'PAYROLL_PERIOD_APPROVED',
      'APPROVE',
    );
  }

  /** EN_REVISION → CALCULADA: devuelve el período a recálculo. */
  async rechazar(
    tenantId: string,
    userId: string,
    id: string,
    motivo?: string,
  ) {
    return this.transitionPeriod(
      tenantId,
      userId,
      id,
      PayrollPeriodStatus.EN_REVISION,
      PayrollPeriodStatus.CALCULADA,
      'PAYROLL_PERIOD_REJECTED',
      motivo ? { metadata: { motivo } } : undefined,
    );
  }

  /** CALCULADA → BORRADOR: deshace el cálculo para modificar insumos. */
  async reabrir(tenantId: string, userId: string, id: string) {
    return this.transitionPeriod(
      tenantId,
      userId,
      id,
      PayrollPeriodStatus.CALCULADA,
      PayrollPeriodStatus.BORRADOR,
      'PAYROLL_PERIOD_REOPENED',
    );
  }

  private async approvePeriod(
    tenantId: string,
    userId: string,
    periodId: string,
    from: PayrollPeriodStatus,
    action: string,
    origin: string,
  ) {
    if (from !== PayrollPeriodStatus.CALCULADA) {
      assertTransition(from, PayrollPeriodStatus.APROBADA);
    }

    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
    });
    if (!period) throw new NotFoundException('PerÃ­odo no encontrado');
    if (period.status !== from) {
      throw new BadRequestException(
        `TransiciÃ³n de estado no permitida: ${period.status} â†’ ${PayrollPeriodStatus.APROBADA} (se requiere ${from})`,
      );
    }

    return this.tenantPrisma.execute(async (tx) => {
      await this.assertNoFunctionalBlocksForApproval(tx, tenantId, period);

      const result = await tx.payrollPeriod.updateMany({
        where: { id: periodId, tenantId, status: from },
        data: {
          status: PayrollPeriodStatus.APROBADA,
          aprobadoPorId: userId,
          aprobadoEn: new Date(),
        },
      });
      if (result.count === 0) {
        throw new ConflictException(
          'El perÃ­odo fue modificado por otra operaciÃ³n concurrente',
        );
      }

      const approvedPeriod = await tx.payrollPeriod.findFirstOrThrow({
        where: { id: periodId, tenantId },
      });
      const snapshotsCreated = await this.createApprovedSnapshots(
        tx,
        tenantId,
        userId,
        approvedPeriod,
        origin,
      );

      await this.auditService.log(
        {
          tenantId,
          userId,
          action,
          entityType: 'PayrollPeriod',
          entityId: periodId,
          metadata: {
            periodName: period.nombre,
            payrollPeriodId: periodId,
            snapshotsCreated,
            from: period.status,
            to: PayrollPeriodStatus.APROBADA,
          },
        },
        tx,
      );

      return approvedPeriod;
    });
  }

  /**
   * Transición genérica y transaccional del ProcesoNómina (ADR-002 §6).
   *
   * Recibe `from` explícito por método (no se deriva del grafo): en
   * `VALID_TRANSITIONS`, CALCULADA es alcanzable tanto desde BORRADOR
   * ("calcular", fuera de este helper — ver generatePayroll) como desde
   * EN_REVISION ("rechazar"). Si `rechazar` solo validara "¿puede el
   * estado real llegar a CALCULADA según el grafo?" aceptaría también un
   * período en BORRADOR, que no es su precondición real. Por eso la
   * precondición de cada acción es explícita y se compara contra el
   * estado leído; `assertTransition(from, to)` queda como verificación
   * estática de que el par declarado es en efecto un edge válido del
   * grafo (documental/defensivo), no como el gate en tiempo de ejecución.
   *
   * Flujo: lee el estado real (404 si no existe) → compara contra `from`
   * (400 si no coincide: transición no aplicable) → `updateMany`
   * optimista con el estado leído en el WHERE (409 si cambió entre la
   * lectura y el commit — TOCTOU) → audita dentro de la misma
   * transacción (si falla, la transición completa revierte — fail-secure,
   * §6).
   */
  private async transitionPeriod(
    tenantId: string,
    userId: string,
    periodId: string,
    from: PayrollPeriodStatus,
    to: PayrollPeriodStatus,
    action: string,
    options?: {
      data?: Prisma.PayrollPeriodUncheckedUpdateManyInput;
      metadata?: Record<string, unknown>;
    },
  ) {
    assertTransition(from, to);

    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
      select: { status: true },
    });
    if (!period) throw new NotFoundException('Período no encontrado');
    if (period.status !== from) {
      throw new BadRequestException(
        `Transición de estado no permitida: ${period.status} → ${to} (se requiere ${from})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.payrollPeriod.updateMany({
        where: { id: periodId, tenantId, status: from },
        data: { status: to, ...options?.data },
      });
      if (result.count === 0) {
        throw new ConflictException(
          'El período fue modificado por otra operación concurrente',
        );
      }

      await this.auditService.log(
        {
          tenantId,
          userId,
          action,
          entityType: 'PayrollPeriod',
          entityId: periodId,
          metadata: { from: period.status, to, ...options?.metadata },
        },
        tx,
      );

      return tx.payrollPeriod.findFirstOrThrow({
        where: { id: periodId, tenantId },
      });
    });
  }

  private async transitionCorrection(
    tenantId: string,
    userId: string,
    correctionId: string,
    from: PayrollCorrectionStatus,
    to: PayrollCorrectionStatus,
    action: string,
    metadata?: Record<string, unknown>,
  ) {
    assertCorrectionTransition(from, to);

    const correction = await this.prisma.payrollCorrection.findFirst({
      where: { id: correctionId, tenantId },
      select: { status: true, payrollPeriodId: true },
    });
    if (!correction) throw new NotFoundException('Corrección no encontrada');

    const period = await this.requireApprovedPeriodForCorrections(
      tenantId,
      correction.payrollPeriodId,
      'Solo se pueden operar correcciones sobre un período aprobado',
    );

    if (correction.status !== from) {
      throw new BadRequestException(
        `Transición de corrección no permitida: ${correction.status} → ${to} (se requiere ${from})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.payrollCorrection.updateMany({
        where: {
          id: correctionId,
          tenantId,
          payrollPeriodId: period.id,
          status: from,
        },
        data: { status: to },
      });
      if (result.count === 0) {
        throw new ConflictException(
          'La corrección fue modificada por otra operación concurrente',
        );
      }

      await this.auditService.log(
        {
          tenantId,
          userId,
          action,
          entityType: 'PayrollCorrection',
          entityId: correctionId,
          metadata: {
            payrollPeriodId: correction.payrollPeriodId,
            from: correction.status,
            to,
            ...metadata,
          },
        },
        tx,
      );

      return tx.payrollCorrection.findFirstOrThrow({
        where: { id: correctionId, tenantId },
      });
    });
  }

  /**
   * EN_REVISION → APROBADA con materialización inmutable. La transacción es
   * serializable para que dos correcciones del mismo período no calculen la
   * misma línea base de manera concurrente.
   */
  private async approveCorrectionWithMaterialization(
    tenantId: string,
    userId: string,
    correctionId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const correction = await tx.payrollCorrection.findFirst({
          where: { id: correctionId, tenantId },
          select: {
            id: true,
            tenantId: true,
            payrollPeriodId: true,
            status: true,
            intent: true,
            intentVersion: true,
            materialization: true,
          },
        });
        if (!correction)
          throw new NotFoundException('Corrección no encontrada');
        if (correction.status !== PayrollCorrectionStatus.EN_REVISION) {
          throw new BadRequestException(
            `Transición de corrección no permitida: ${correction.status} → ${PayrollCorrectionStatus.APROBADA}`,
          );
        }
        if (
          correction.materialization !== null &&
          correction.materialization !== undefined
        ) {
          throw new ConflictException(
            'La corrección ya posee una materialización inmutable.',
          );
        }

        const period = await this.requireCorrectablePeriod(
          tx,
          tenantId,
          correction.payrollPeriodId,
          'Solo se pueden aprobar correcciones sobre un período aprobado o causado',
        );
        const intent = parseCorrectionIntentPayload(correction.intent);
        if (correction.intentVersion !== intent.version) {
          throw new ConflictException(
            'La versión de intención de la corrección no es válida.',
          );
        }

        const snapshots = await this.validateCorrectionIntentReferences(
          tx,
          tenantId,
          period.id,
          intent.intents,
        );
        const previousCorrections = await tx.payrollCorrection.findMany({
          where: {
            tenantId,
            payrollPeriodId: period.id,
            status: PayrollCorrectionStatus.APROBADA,
            id: { not: correction.id },
          },
          select: {
            id: true,
            materialization: true,
            materializationVersion: true,
            materializedAt: true,
            createdAt: true,
          },
          orderBy: [{ materializedAt: 'asc' }, { createdAt: 'asc' }],
        });

        const previousMaterializations = previousCorrections.map((previous) => {
          if (
            previous.materialization === null ||
            previous.materializationVersion !==
              PAYROLL_CORRECTION_MATERIALIZATION_VERSION
          ) {
            throw new ConflictException(
              'No puede reconstruirse una línea base con una corrección aprobada sin materialización válida.',
            );
          }
          return {
            correctionId: previous.id,
            materialization: parseCorrectionMaterialization(
              previous.materialization,
            ),
          };
        });

        const materializedAt = new Date();
        const materialization = this.buildCorrectionMaterialization(
          snapshots,
          intent.intents,
          previousMaterializations,
          materializedAt,
        );

        const updated = await tx.payrollCorrection.updateMany({
          where: {
            id: correction.id,
            tenantId,
            payrollPeriodId: period.id,
            status: PayrollCorrectionStatus.EN_REVISION,
            materialization: { equals: Prisma.DbNull },
          },
          data: {
            status: PayrollCorrectionStatus.APROBADA,
            materializationVersion: materialization.version,
            materialization,
            materializedAt,
          },
        });
        if (updated.count === 0) {
          throw new ConflictException(
            'La corrección fue modificada por otra operación concurrente.',
          );
        }

        await this.auditService.log(
          {
            tenantId,
            userId,
            action: 'PAYROLL_CORRECTION_APPROVED',
            entityType: 'PayrollCorrection',
            entityId: correction.id,
            metadata: {
              payrollPeriodId: period.id,
              from: PayrollCorrectionStatus.EN_REVISION,
              to: PayrollCorrectionStatus.APROBADA,
              intentIds: intent.intents.map((item) => item.id),
              snapshotIds: materialization.snapshotIds,
              approvedCorrectionIds: materialization.approvedCorrectionIds,
              materializationVersion: materialization.version,
            },
          },
          tx,
        );

        return tx.payrollCorrection.findFirstOrThrow({
          where: { id: correction.id, tenantId },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async validateCorrectionIntentReferences(
    tx: Prisma.TransactionClient,
    tenantId: string,
    payrollPeriodId: string,
    intents: PayrollCorrectionIntent[],
  ): Promise<CorrectionSnapshot[]> {
    const snapshotIds = [
      ...new Set(intents.map((intent) => intent.snapshotId)),
    ];
    const snapshots = await tx.payrollSnapshot.findMany({
      where: {
        id: { in: snapshotIds },
        tenantId,
        payrollPeriodId,
      },
      select: {
        id: true,
        tenantId: true,
        payrollPeriodId: true,
        employeeId: true,
        centroCostoId: true,
        payload: true,
      },
    });
    if (snapshots.length !== snapshotIds.length) {
      throw new BadRequestException(
        'La corrección referencia snapshots inexistentes o fuera del tenant/período.',
      );
    }

    const targetCostCenterIds = [
      ...new Set(
        intents
          .filter(
            (
              intent,
            ): intent is Extract<
              PayrollCorrectionIntent,
              { kind: PayrollCorrectionIntentKind.MOVE_COST_CENTER }
            > => intent.kind === PayrollCorrectionIntentKind.MOVE_COST_CENTER,
          )
          .map((intent) => intent.targetCostCenterId),
      ),
    ];
    if (targetCostCenterIds.length > 0) {
      const costCenters = await tx.centroCosto.findMany({
        where: {
          id: { in: targetCostCenterIds },
          tenantId,
          activo: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (costCenters.length !== targetCostCenterIds.length) {
        throw new BadRequestException(
          'La corrección referencia un centro de costo inexistente o inactivo.',
        );
      }
    }

    return snapshots;
  }

  private buildCorrectionMaterialization(
    snapshots: CorrectionSnapshot[],
    intents: PayrollCorrectionIntent[],
    previousCorrections: Array<{
      correctionId: string;
      materialization: PayrollCorrectionMaterialization;
    }>,
    materializedAt: Date,
  ): PayrollCorrectionMaterialization {
    const snapshotIds = snapshots.map((snapshot) => snapshot.id).sort();
    const entries: PayrollCorrectionDeltaEntry[] = [];

    for (const rawSnapshot of snapshots) {
      const snapshot = this.parseCorrectionSnapshot(rawSnapshot);
      const previousEntries = previousCorrections.flatMap((previous) => {
        const materialization = previous.materialization;
        if (
          materialization.entries.some(
            (entry) =>
              entry.snapshotId === snapshot.id &&
              !materialization.snapshotIds.includes(snapshot.id),
          )
        ) {
          throw new ConflictException(
            'La materialización previa tiene referencias inconsistentes.',
          );
        }
        return materialization.entries.filter(
          (entry) => entry.snapshotId === snapshot.id,
        );
      });
      const baseline = this.buildEffectiveAmounts(snapshot, previousEntries);
      const currentCenterId = this.resolveEffectiveCostCenter(baseline);
      const currentInput = this.reconstructCalculationInput(
        snapshot,
        baseline,
        currentCenterId,
      );

      const currentResult = calculate(currentInput);
      const recalculatedBaseline = this.resultToAmounts(
        currentResult,
        currentCenterId,
      );
      if (!this.sameAmounts(baseline, recalculatedBaseline)) {
        throw new ConflictException(
          'No puede reconstruirse una línea base consistente para la corrección.',
        );
      }

      const snapshotIntents = intents.filter(
        (intent) => intent.snapshotId === snapshot.id,
      );
      const nextInput = {
        ...currentInput,
        novelties: [...currentInput.novelties],
      };
      let targetCenterId = currentCenterId;
      for (const intent of snapshotIntents) {
        if (intent.kind === PayrollCorrectionIntentKind.MOVE_COST_CENTER) {
          targetCenterId = intent.targetCostCenterId;
          continue;
        }
        if (intent.input === PayrollCorrectionCalculationInput.SALARIO_BASE) {
          nextInput.salarioBase = intent.targetAmount;
        } else {
          const novelty = nextInput.novelties.find(
            (item) => item.tipo === String(intent.input),
          );
          if (novelty) novelty.valor = intent.targetAmount;
          else
            nextInput.novelties.push({
              tipo: intent.input,
              valor: intent.targetAmount,
            });
        }
      }

      const nextAmounts = this.resultToAmounts(
        calculate(nextInput),
        targetCenterId,
      );
      entries.push(...this.diffAmounts(snapshot, baseline, nextAmounts));
    }

    if (entries.length === 0) {
      throw new BadRequestException(
        'La corrección no genera cambios materiales.',
      );
    }

    return {
      version: PAYROLL_CORRECTION_MATERIALIZATION_VERSION,
      generatedAt: materializedAt.toISOString(),
      snapshotIds,
      approvedCorrectionIds: previousCorrections.map(
        (previous) => previous.correctionId,
      ),
      entries,
    };
  }

  private buildEffectiveAmounts(
    snapshot: ParsedCorrectionSnapshot,
    previousEntries: PayrollCorrectionDeltaEntry[],
  ) {
    const amounts = new Map<string, EffectiveConceptAmount>();
    const add = (
      codigo: string,
      tipo: PayrollConceptType,
      centroCostoId: string | null,
      valor: number,
    ) => {
      const key = this.amountKey(codigo, tipo, centroCostoId);
      const current = amounts.get(key);
      amounts.set(key, {
        codigo,
        tipo,
        centroCostoId,
        valor: (current?.valor ?? 0) + valor,
      });
    };

    for (const concept of snapshot.concepts) {
      add(concept.codigo, concept.tipo, snapshot.centroCostoId, concept.valor);
    }
    for (const entry of previousEntries) {
      if (entry.employeeId !== snapshot.employeeId) {
        throw new ConflictException(
          'La materialización previa no corresponde al empleado del snapshot.',
        );
      }
      add(
        entry.concept.codigo,
        this.asPayrollConceptType(entry.concept.tipo),
        entry.centroCostoId,
        entry.delta,
      );
    }

    for (const amount of amounts.values()) {
      if (amount.valor < 0) {
        throw new ConflictException(
          'La línea base de la corrección contiene valores negativos.',
        );
      }
    }
    return [...amounts.values()].filter((amount) => amount.valor !== 0);
  }

  private resolveEffectiveCostCenter(amounts: EffectiveConceptAmount[]) {
    const centers = new Set(
      amounts
        .filter((amount) => amount.valor !== 0)
        .map((amount) => amount.centroCostoId),
    );
    if (centers.size !== 1) {
      throw new ConflictException(
        'La distribución vigente por centro de costo no puede reconstruirse de forma consistente.',
      );
    }
    return [...centers][0] ?? null;
  }

  private reconstructCalculationInput(
    snapshot: ParsedCorrectionSnapshot,
    amounts: EffectiveConceptAmount[],
    centroCostoId: string | null,
  ): PayrollCalculationInput {
    const amountFor = (codigo: string) =>
      amounts
        .filter(
          (amount) =>
            amount.codigo === codigo && amount.centroCostoId === centroCostoId,
        )
        .reduce((total, amount) => total + amount.valor, 0);
    const salarioBase = amountFor(ConceptCodigo.SALARIO_BASE);
    if (salarioBase <= 0) {
      throw new ConflictException(
        'La línea base no contiene un salario base válido.',
      );
    }
    return {
      ...snapshot.calculationInput,
      salarioBase,
      novelties: [
        {
          tipo: PayrollCorrectionCalculationInput.BONUS,
          valor: amountFor(ConceptCodigo.BONUS),
        },
        {
          tipo: PayrollCorrectionCalculationInput.OVERTIME,
          valor: amountFor(ConceptCodigo.OVERTIME),
        },
      ].filter((novelty) => novelty.valor > 0),
    };
  }

  private resultToAmounts(
    result: PayrollCalculationResult,
    centroCostoId: string | null,
  ): EffectiveConceptAmount[] {
    return result.concepts.map((concept) => ({
      codigo: concept.codigo,
      tipo: concept.tipo,
      centroCostoId,
      valor: concept.valor,
    }));
  }

  private diffAmounts(
    snapshot: ParsedCorrectionSnapshot,
    before: EffectiveConceptAmount[],
    after: EffectiveConceptAmount[],
  ): PayrollCorrectionDeltaEntry[] {
    const amounts = new Map<string, EffectiveConceptAmount>();
    for (const item of before) {
      amounts.set(this.amountKey(item.codigo, item.tipo, item.centroCostoId), {
        ...item,
        valor: -item.valor,
      });
    }
    for (const item of after) {
      const key = this.amountKey(item.codigo, item.tipo, item.centroCostoId);
      const current = amounts.get(key);
      amounts.set(key, { ...item, valor: (current?.valor ?? 0) + item.valor });
    }
    return [...amounts.values()]
      .filter((item) => item.valor !== 0)
      .sort((a, b) =>
        this.amountKey(a.codigo, a.tipo, a.centroCostoId).localeCompare(
          this.amountKey(b.codigo, b.tipo, b.centroCostoId),
        ),
      )
      .map((item) => ({
        snapshotId: snapshot.id,
        employeeId: snapshot.employeeId,
        centroCostoId: item.centroCostoId,
        concept: { codigo: item.codigo, tipo: item.tipo },
        delta: item.valor,
      }));
  }

  private sameAmounts(
    left: EffectiveConceptAmount[],
    right: EffectiveConceptAmount[],
  ) {
    const toMap = (values: EffectiveConceptAmount[]) =>
      new Map(
        values.map((item) => [
          this.amountKey(item.codigo, item.tipo, item.centroCostoId),
          item.valor,
        ]),
      );
    const leftMap = toMap(left);
    const rightMap = toMap(right);
    if (leftMap.size !== rightMap.size) return false;
    return [...leftMap].every(([key, value]) => rightMap.get(key) === value);
  }

  private amountKey(
    codigo: string,
    tipo: string,
    centroCostoId: string | null,
  ) {
    return JSON.stringify([codigo, tipo, centroCostoId]);
  }

  private asPayrollConceptType(value: string): PayrollConceptType {
    if (
      value === 'EARNING' ||
      value === 'DEDUCTION' ||
      value === 'EMPLOYER_CONTRIBUTION' ||
      value === 'PROVISION'
    ) {
      return value;
    }
    throw new ConflictException(
      'La materialización contiene un tipo de concepto inválido.',
    );
  }

  private parseCorrectionSnapshot(
    snapshot: CorrectionSnapshot,
  ): ParsedCorrectionSnapshot {
    const payload = this.asRecord(
      snapshot.payload,
      'El snapshot no tiene un payload válido.',
    );
    const employee = this.asRecord(
      payload.employee,
      'El snapshot no contiene el empleado original.',
    );
    const contract =
      payload.contract === null
        ? null
        : this.asRecord(
            payload.contract,
            'El snapshot no contiene el contrato original.',
          );
    const policy = this.asRecord(
      payload.companyPolicy,
      'El snapshot no contiene la política de empresa.',
    );
    const legal = this.asRecord(
      payload.legalParameters,
      'El snapshot no contiene los parámetros legales congelados.',
    );
    if (!Array.isArray(payload.concepts)) {
      throw new ConflictException('El snapshot no contiene conceptos válidos.');
    }

    const concepts = payload.concepts.map((concept) => {
      const value = this.asRecord(
        concept,
        'El snapshot contiene un concepto inválido.',
      );
      const codigo = this.asNonEmptyString(
        value.codigo,
        'El concepto del snapshot no tiene código.',
      );
      return {
        codigo,
        tipo: this.asPayrollConceptType(
          this.asNonEmptyString(
            value.tipo,
            'El concepto del snapshot no tiene tipo.',
          ),
        ),
        valor: this.asInteger(
          value.valor,
          'El concepto del snapshot no tiene un valor válido.',
        ),
      };
    });

    return {
      id: snapshot.id,
      employeeId: snapshot.employeeId,
      centroCostoId: snapshot.centroCostoId,
      concepts,
      calculationInput: {
        salarioBase: this.asPositiveInteger(
          employee.salarioBaseUsado,
          'El snapshot no contiene un salario base válido.',
        ),
        salarioIntegral: this.asBoolean(
          employee.salarioIntegralUsado,
          'El snapshot no contiene la condición salarial original.',
        ),
        claseRiesgoArl: this.asArlClass(contract?.claseRiesgoArlUsada ?? 1),
        aportesExonerados: this.asBoolean(
          policy.aportesExonerados,
          'El snapshot no contiene la política de aportes.',
        ),
        legalParams: this.parseFrozenLegalParams(legal),
        novelties: [],
      },
    };
  }

  private parseFrozenLegalParams(
    value: Record<string, unknown>,
  ): LegalParamsSnapshot {
    const topes = this.asRecord(
      value.topes,
      'El snapshot no contiene topes legales válidos.',
    );
    const tarifasEmpleado = this.asRecord(
      value.tarifasEmpleado,
      'El snapshot no contiene tarifas de empleado válidas.',
    );
    const tarifasEmpleador = this.asRecord(
      value.tarifasEmpleador,
      'El snapshot no contiene tarifas de empleador válidas.',
    );
    const tarifasArl = this.asRecord(
      value.tarifasArl,
      'El snapshot no contiene tarifas ARL válidas.',
    );
    const factoresProvision = this.asRecord(
      value.factoresProvision,
      'El snapshot no contiene factores de provisión válidos.',
    );
    if (!Array.isArray(value.fspTramos)) {
      throw new ConflictException(
        'El snapshot no contiene tramos FSP válidos.',
      );
    }
    const fspTramos: FspTramo[] = value.fspTramos.map((tramo) => {
      const item = this.asRecord(
        tramo,
        'El snapshot contiene un tramo FSP inválido.',
      );
      return {
        desdeSmmlv: this.asFiniteNumber(
          item.desdeSmmlv,
          'El tramo FSP no es válido.',
        ),
        hastaSmmlv:
          item.hastaSmmlv === null
            ? null
            : this.asFiniteNumber(
                item.hastaSmmlv,
                'El tramo FSP no es válido.',
              ),
        pct: this.asFiniteNumber(item.pct, 'El tramo FSP no es válido.'),
      };
    });
    return {
      smmlv: this.asFiniteNumber(
        value.smmlv,
        'El SMMLV congelado no es válido.',
      ),
      auxilioTransporte: this.asFiniteNumber(
        value.auxilioTransporte,
        'El auxilio de transporte congelado no es válido.',
      ),
      topeIbcMinSmmlv: this.asFiniteNumber(
        topes.topeIbcMinSmmlv,
        'El tope IBC mínimo no es válido.',
      ),
      topeIbcMaxSmmlv: this.asFiniteNumber(
        topes.topeIbcMaxSmmlv,
        'El tope IBC máximo no es válido.',
      ),
      umbralAuxilioSmmlv: this.asFiniteNumber(
        topes.umbralAuxilioSmmlv,
        'El umbral de auxilio no es válido.',
      ),
      umbralExoneracionSmmlv: this.asFiniteNumber(
        topes.umbralExoneracionSmmlv,
        'El umbral de exoneración no es válido.',
      ),
      pctSaludEmpleado: this.asFiniteNumber(
        tarifasEmpleado.pctSaludEmpleado,
        'La tarifa de salud empleado no es válida.',
      ),
      pctPensionEmpleado: this.asFiniteNumber(
        tarifasEmpleado.pctPensionEmpleado,
        'La tarifa de pensión empleado no es válida.',
      ),
      pctSaludEmpleador: this.asFiniteNumber(
        tarifasEmpleador.pctSaludEmpleador,
        'La tarifa de salud empleador no es válida.',
      ),
      pctPensionEmpleador: this.asFiniteNumber(
        tarifasEmpleador.pctPensionEmpleador,
        'La tarifa de pensión empleador no es válida.',
      ),
      pctCaja: this.asFiniteNumber(
        tarifasEmpleador.pctCaja,
        'La tarifa de caja no es válida.',
      ),
      pctIcbf: this.asFiniteNumber(
        tarifasEmpleador.pctIcbf,
        'La tarifa ICBF no es válida.',
      ),
      pctSena: this.asFiniteNumber(
        tarifasEmpleador.pctSena,
        'La tarifa SENA no es válida.',
      ),
      arlPorClase: {
        1: this.asFiniteNumber(
          tarifasArl.arlClaseI,
          'La tarifa ARL I no es válida.',
        ),
        2: this.asFiniteNumber(
          tarifasArl.arlClaseII,
          'La tarifa ARL II no es válida.',
        ),
        3: this.asFiniteNumber(
          tarifasArl.arlClaseIII,
          'La tarifa ARL III no es válida.',
        ),
        4: this.asFiniteNumber(
          tarifasArl.arlClaseIV,
          'La tarifa ARL IV no es válida.',
        ),
        5: this.asFiniteNumber(
          tarifasArl.arlClaseV,
          'La tarifa ARL V no es válida.',
        ),
      },
      factorProvPrima: this.asFiniteNumber(
        factoresProvision.factorProvPrima,
        'El factor de prima no es válido.',
      ),
      factorProvCesantias: this.asFiniteNumber(
        factoresProvision.factorProvCesantias,
        'El factor de cesantías no es válido.',
      ),
      factorProvIntCesantias: this.asFiniteNumber(
        factoresProvision.factorProvIntCesantias,
        'El factor de intereses de cesantías no es válido.',
      ),
      factorProvVacaciones: this.asFiniteNumber(
        factoresProvision.factorProvVacaciones,
        'El factor de vacaciones no es válido.',
      ),
      fspTramos,
    };
  }

  private asRecord(value: unknown, message: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ConflictException(message);
    }
    return value as Record<string, unknown>;
  }

  private asNonEmptyString(value: unknown, message: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new ConflictException(message);
    }
    return value;
  }

  private asFiniteNumber(value: unknown, message: string) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ConflictException(message);
    }
    return value;
  }

  private asInteger(value: unknown, message: string) {
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value < 0
    ) {
      throw new ConflictException(message);
    }
    return value;
  }

  private asPositiveInteger(value: unknown, message: string) {
    const integer = this.asInteger(value, message);
    if (integer <= 0) throw new ConflictException(message);
    return integer;
  }

  private asBoolean(value: unknown, message: string) {
    if (typeof value !== 'boolean') throw new ConflictException(message);
    return value;
  }

  private asArlClass(value: unknown): ArlClase {
    if (
      value === 1 ||
      value === 2 ||
      value === 3 ||
      value === 4 ||
      value === 5
    ) {
      return value;
    }
    throw new ConflictException('La clase ARL congelada no es válida.');
  }

  private async requireCorrectablePeriod(
    tx: Prisma.TransactionClient,
    tenantId: string,
    periodId: string,
    message: string,
  ) {
    const period = await tx.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
      select: {
        id: true,
        nombre: true,
        status: true,
        aprobadoPorId: true,
        aprobadoEn: true,
      },
    });
    if (!period) throw new NotFoundException('Período no encontrado');
    if (
      period.status !== PayrollPeriodStatus.APROBADA &&
      period.status !== PayrollPeriodStatus.CAUSADA
    ) {
      throw new BadRequestException(message);
    }
    if (!period.aprobadoPorId || !period.aprobadoEn) {
      throw new ConflictException(
        'El período aprobado no tiene una aprobación original auditable',
      );
    }
    return period;
  }

  private async requireApprovedPeriodForCorrections(
    tenantId: string,
    periodId: string,
    notApprovedMessage: string,
  ) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
      select: {
        id: true,
        nombre: true,
        status: true,
        aprobadoPorId: true,
        aprobadoEn: true,
      },
    });
    if (!period) throw new NotFoundException('Período no encontrado');

    if (
      period.status !== PayrollPeriodStatus.APROBADA &&
      period.status !== PayrollPeriodStatus.CAUSADA
    ) {
      throw new BadRequestException(notApprovedMessage);
    }

    if (!period.aprobadoPorId || !period.aprobadoEn) {
      throw new ConflictException(
        'El período aprobado no tiene una aprobación original auditable',
      );
    }

    return period;
  }

  async generatePayroll(tenantId: string, userId: string, periodId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
    });
    if (!period) throw new NotFoundException('Período no encontrado');
    if (!GENERATE_ALLOWED_STATUSES.includes(period.status)) {
      throw new BadRequestException(
        `No se puede generar nómina en un período en estado ${period.status}`,
      );
    }

    // ── Datos compartidos: resolver antes de la transacción ─────────────────
    const [legalParam, tenant] = await Promise.all([
      this.resolveLegalParams(tenantId, period.fechaInicio),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { aportesExonerados: true },
      }),
    ]);
    const legalSnapshot = toSnapshot(legalParam);
    const aportesExonerados = tenant!.aportesExonerados;

    const employees = await this.tenantPrisma.execute((prisma) =>
      prisma.empleado.findMany({
        where: { tenantId, deletedAt: null, estado: 'ACTIVO' },
        select: { id: true, salario: true, salarioIntegral: true },
      }),
    );

    const allNovelties = await this.prisma.payrollNovelty.findMany({
      where: { tenantId, payrollPeriodId: periodId },
    });
    const noveltiesByEmployee = new Map<string, typeof allNovelties>();
    for (const n of allNovelties) {
      const list = noveltiesByEmployee.get(n.employeeId) ?? [];
      list.push(n);
      noveltiesByEmployee.set(n.employeeId, list);
    }

    const employeeIds = employees.map((e) => e.id);
    const allContracts = await this.prisma.contrato.findMany({
      where: { tenantId, empleadoId: { in: employeeIds } },
      select: {
        id: true,
        empleadoId: true,
        tipo: true,
        estado: true,
        fechaInicio: true,
        fechaFin: true,
        sedeId: true,
        salario: true,
        claseRiesgoArl: true,
      },
      orderBy: { fechaInicio: 'desc' },
    });
    const centroCostoBySede = await this.resolveCentrosCostoBySede(
      tenantId,
      allContracts,
    );
    const contractsByEmployee = new Map<string, typeof allContracts>();
    for (const c of allContracts) {
      const list = contractsByEmployee.get(c.empleadoId) ?? [];
      list.push(c);
      contractsByEmployee.set(c.empleadoId, list);
    }

    // ── Transacción ──────────────────────────────────────────────────────────
    const created: unknown[] = [];
    const runWarnings: Record<string, string[]> = {};
    const runBlocks: PayrollBlockMap = {};

    try {
      await this.prisma.$transaction(
        async (tx) => {
          for (const emp of employees) {
            const calculation = this.calculateAndCollectWarnings(
              emp,
              contractsByEmployee.get(emp.id) ?? [],
              noveltiesByEmployee.get(emp.id) ?? [],
              aportesExonerados,
              legalSnapshot,
              period.fechaInicio,
              runWarnings,
              runBlocks,
            );
            if (runBlocks[emp.id]?.length) continue;

            const existing = await tx.payrollRun.findFirst({
              where: {
                tenantId,
                payrollPeriodId: periodId,
                employeeId: emp.id,
              },
            });
            if (existing) continue;

            const centroCosto = this.resolveCentroCosto(
              calculation.contrato,
              centroCostoBySede,
            );

            const run = await tx.payrollRun.create({
              data: this.buildRunCreateData(
                emp,
                calculation.result,
                legalParam.id,
                period,
                tenantId,
                centroCosto,
                calculation,
                this.serializeLegalParams(legalParam),
                noveltiesByEmployee.get(emp.id) ?? [],
              ),
            });
            created.push(run);
          }

          await this.syncFunctionalBlocksForPeriod(
            tx,
            tenantId,
            periodId,
            runBlocks,
          );

          // "El cálculo terminó correctamente" (ADR-002 §6): al final de esta
          // misma transacción, tras persistir los runs, el período pasa a
          // CALCULADA. Sin `where: status` de origen: es válido tanto desde
          // BORRADOR como desde CALCULADA (recalcular no debe retroceder).
          // Efecto natural del evento de cálculo, no una transición formal
          // separada — no pasa por assertTransition/transitionPeriod.
          await tx.payrollPeriod.updateMany({
            where: { id: periodId, tenantId },
            data: { status: PayrollPeriodStatus.CALCULADA },
          });
        },
        { timeout: 30000 },
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una liquidación para uno de los empleados en este período',
        );
      }
      throw e;
    }

    this.auditService
      .log({
        tenantId,
        userId,
        action: 'PAYROLL_GENERATED',
        entityType: 'PayrollPeriod',
        entityId: periodId,
        metadata: {
          periodName: period.nombre,
          payrollPeriodId: periodId,
          parametroLegalId: legalParam.id,
          runsCreated: created.length,
          skipped: employees.length - created.length,
          warningsCount: Object.keys(runWarnings).length,
          blocksCount: Object.keys(runBlocks).length,
        },
      })
      .catch(() => {});

    return {
      created: created.length,
      message: `${created.length} empleados liquidados`,
      ...(Object.keys(runWarnings).length > 0 && { warnings: runWarnings }),
      ...(Object.keys(runBlocks).length > 0 && {
        blocks: this.blockMessages(runBlocks),
      }),
    };
  }

  async recalculatePayroll(tenantId: string, userId: string, periodId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
    });
    if (!period) throw new NotFoundException('Período no encontrado');
    if (!RECALCULATE_ALLOWED_STATUSES.includes(period.status)) {
      throw new ConflictException(
        `No se puede recalcular un período en estado ${period.status}`,
      );
    }

    // ── Datos compartidos: resolver antes de la transacción ─────────────────
    const [legalParam, tenant] = await Promise.all([
      this.resolveLegalParams(tenantId, period.fechaInicio),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { aportesExonerados: true },
      }),
    ]);
    const legalSnapshot = toSnapshot(legalParam);
    const aportesExonerados = tenant!.aportesExonerados;

    const employees = await this.tenantPrisma.execute((prisma) =>
      prisma.empleado.findMany({
        where: { tenantId, deletedAt: null, estado: 'ACTIVO' },
        select: { id: true, salario: true, salarioIntegral: true },
      }),
    );

    const allNovelties = await this.prisma.payrollNovelty.findMany({
      where: { tenantId, payrollPeriodId: periodId },
    });
    const noveltiesByEmployee = new Map<string, typeof allNovelties>();
    for (const n of allNovelties) {
      const list = noveltiesByEmployee.get(n.employeeId) ?? [];
      list.push(n);
      noveltiesByEmployee.set(n.employeeId, list);
    }

    const employeeIds = employees.map((e) => e.id);
    const allContracts = await this.prisma.contrato.findMany({
      where: { tenantId, empleadoId: { in: employeeIds } },
      select: {
        id: true,
        empleadoId: true,
        tipo: true,
        estado: true,
        fechaInicio: true,
        fechaFin: true,
        sedeId: true,
        salario: true,
        claseRiesgoArl: true,
      },
      orderBy: { fechaInicio: 'desc' },
    });
    const centroCostoBySede = await this.resolveCentrosCostoBySede(
      tenantId,
      allContracts,
    );
    const contractsByEmployee = new Map<string, typeof allContracts>();
    for (const c of allContracts) {
      const list = contractsByEmployee.get(c.empleadoId) ?? [];
      list.push(c);
      contractsByEmployee.set(c.empleadoId, list);
    }

    // ── Transacción ──────────────────────────────────────────────────────────
    const runWarnings: Record<string, string[]> = {};
    const runBlocks: PayrollBlockMap = {};
    const summary = { runsDeleted: 0, runsCreated: 0 };

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const existingRuns = await tx.payrollRun.findMany({
            where: { tenantId, payrollPeriodId: periodId },
            select: { id: true },
          });
          const runIds = existingRuns.map((r) => r.id);
          summary.runsDeleted = runIds.length;

          if (runIds.length > 0) {
            await tx.payrollConcept.deleteMany({
              where: { payrollRunId: { in: runIds } },
            });
            await tx.payrollRun.deleteMany({
              where: { tenantId, payrollPeriodId: periodId },
            });
          }

          for (const emp of employees) {
            const calculation = this.calculateAndCollectWarnings(
              emp,
              contractsByEmployee.get(emp.id) ?? [],
              noveltiesByEmployee.get(emp.id) ?? [],
              aportesExonerados,
              legalSnapshot,
              period.fechaInicio,
              runWarnings,
              runBlocks,
            );
            if (runBlocks[emp.id]?.length) continue;

            const centroCosto = this.resolveCentroCosto(
              calculation.contrato,
              centroCostoBySede,
            );

            await tx.payrollRun.create({
              data: this.buildRunCreateData(
                emp,
                calculation.result,
                legalParam.id,
                period,
                tenantId,
                centroCosto,
                calculation,
                this.serializeLegalParams(legalParam),
                noveltiesByEmployee.get(emp.id) ?? [],
              ),
            });
            summary.runsCreated += 1;
          }

          await this.syncFunctionalBlocksForPeriod(
            tx,
            tenantId,
            periodId,
            runBlocks,
          );

          // La reliquidación mantiene CALCULADA (nunca retrocede a BORRADOR).
          // Mismo evento de negocio que en generatePayroll: ver comentario ahí.
          await tx.payrollPeriod.updateMany({
            where: { id: periodId, tenantId },
            data: { status: PayrollPeriodStatus.CALCULADA },
          });
        },
        { timeout: 30000 },
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Error de duplicado al regenerar nómina');
      }
      throw e;
    }

    this.auditService
      .log({
        tenantId,
        userId,
        action: 'PAYROLL_RECALCULATED',
        entityType: 'PayrollPeriod',
        entityId: periodId,
        metadata: {
          periodName: period.nombre,
          payrollPeriodId: periodId,
          parametroLegalId: legalParam.id,
          runsDeleted: summary.runsDeleted,
          runsCreated: summary.runsCreated,
          warningsCount: Object.keys(runWarnings).length,
          blocksCount: Object.keys(runBlocks).length,
        },
      })
      .catch(() => {});

    return {
      recalculated: employees.length,
      message: `${employees.length} empleados reliquidados`,
      ...(Object.keys(runWarnings).length > 0 && { warnings: runWarnings }),
      ...(Object.keys(runBlocks).length > 0 && {
        blocks: this.blockMessages(runBlocks),
      }),
    };
  }

  async createNovelty(
    tenantId: string,
    userId: string,
    dto: CreatePayrollNoveltyDto,
  ) {
    const [emp, period] = await Promise.all([
      this.tenantPrisma.execute((prisma) =>
        prisma.empleado.findFirst({
          where: { id: dto.employeeId, tenantId, deletedAt: null },
        }),
      ),
      this.prisma.payrollPeriod.findFirst({
        where: { id: dto.payrollPeriodId, tenantId },
      }),
    ]);
    if (!emp) throw new NotFoundException('Empleado no encontrado');
    if (!period) throw new NotFoundException('Período no encontrado');
    const novelty = await this.prisma.payrollNovelty.create({
      data: { ...dto, fecha: new Date(dto.fecha), tenantId },
    });
    this.auditService
      .log({
        tenantId,
        userId,
        action: 'PAYROLL_NOVELTY_CREATED',
        entityType: 'PayrollNovelty',
        entityId: novelty.id,
        metadata: {
          employeeId: dto.employeeId,
          payrollPeriodId: dto.payrollPeriodId,
          tipo: dto.tipo,
          valor: dto.valor ?? null,
        },
      })
      .catch(() => {});
    return novelty;
  }

  async findNovelties(tenantId: string, employeeId?: string) {
    return this.prisma.payrollNovelty.findMany({
      where: { tenantId, ...(employeeId ? { employeeId } : {}) },
      include: {
        employee: {
          select: {
            id: true,
            primerNombre: true,
            segundoNombre: true,
            primerApellido: true,
            segundoApellido: true,
          },
        },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async getDashboard(tenantId: string) {
    const [periods, totalRuns] = await Promise.all([
      this.prisma.payrollPeriod.count({ where: { tenantId } }),
      this.prisma.payrollRun.count({ where: { tenantId } }),
    ]);

    const lastPeriod = await this.prisma.payrollPeriod.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, nombre: true, status: true },
    });

    let lastPeriodTotals = {
      totalDevengos: 0,
      totalDeducciones: 0,
      totalNeto: 0,
    };
    if (lastPeriod) {
      const runs = await this.prisma.payrollRun.findMany({
        where: { tenantId, payrollPeriodId: lastPeriod.id },
      });
      lastPeriodTotals = {
        totalDevengos: runs.reduce((s, r) => s + Number(r.totalDevengos), 0),
        totalDeducciones: runs.reduce(
          (s, r) => s + Number(r.totalDeducciones),
          0,
        ),
        totalNeto: runs.reduce((s, r) => s + Number(r.netoPagar), 0),
      };
    }

    return {
      totalPeriodos: periods,
      empleadosLiquidados: totalRuns,
      ...lastPeriodTotals,
      ultimoPeriodo: lastPeriod?.nombre ?? null,
    };
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private async assertNoFunctionalBlocksForApproval(
    tx: Prisma.TransactionClient,
    tenantId: string,
    period: {
      id: string;
      fechaInicio: Date;
    },
  ) {
    const blocks = await this.collectFunctionalBlocksForPeriod(
      tx,
      tenantId,
      period,
    );
    await this.syncFunctionalBlocksForPeriod(tx, tenantId, period.id, blocks);

    const activeBlocks = await tx.payrollBlock.findMany({
      where: {
        tenantId,
        payrollPeriodId: period.id,
        status: PayrollBlockStatus.ACTIVE,
      },
      select: { employeeId: true },
    });
    const blockedEmployees = new Set(
      activeBlocks.map((block) => block.employeeId),
    );

    if (blockedEmployees.size > 0) {
      throw new BadRequestException(
        `No se puede aprobar la nomina: existen ${blockedEmployees.size} empleado(s) con bloqueos funcionales activos`,
      );
    }
  }

  private async collectFunctionalBlocksForPeriod(
    tx: Prisma.TransactionClient,
    tenantId: string,
    period: {
      id: string;
      fechaInicio: Date;
    },
  ): Promise<PayrollBlockMap> {
    const [legalParam, tenant] = await Promise.all([
      this.resolveLegalParams(tenantId, period.fechaInicio, tx),
      tx.tenant.findUnique({
        where: { id: tenantId },
        select: { aportesExonerados: true },
      }),
    ]);
    const legalSnapshot = toSnapshot(legalParam);
    const aportesExonerados = tenant!.aportesExonerados;

    const employees = await tx.empleado.findMany({
      where: { tenantId, deletedAt: null, estado: 'ACTIVO' },
      select: { id: true, salario: true, salarioIntegral: true },
    });

    const allNovelties = await tx.payrollNovelty.findMany({
      where: { tenantId, payrollPeriodId: period.id },
    });
    const noveltiesByEmployee = new Map<string, typeof allNovelties>();
    for (const novelty of allNovelties) {
      const list = noveltiesByEmployee.get(novelty.employeeId) ?? [];
      list.push(novelty);
      noveltiesByEmployee.set(novelty.employeeId, list);
    }

    const employeeIds = employees.map((employee) => employee.id);
    const allContracts = await tx.contrato.findMany({
      where: { tenantId, empleadoId: { in: employeeIds } },
      select: {
        id: true,
        empleadoId: true,
        tipo: true,
        estado: true,
        fechaInicio: true,
        fechaFin: true,
        sedeId: true,
        salario: true,
        claseRiesgoArl: true,
      },
      orderBy: { fechaInicio: 'desc' },
    });
    const contractsByEmployee = new Map<string, typeof allContracts>();
    for (const contract of allContracts) {
      const list = contractsByEmployee.get(contract.empleadoId) ?? [];
      list.push(contract);
      contractsByEmployee.set(contract.empleadoId, list);
    }

    const warnings: Record<string, string[]> = {};
    const blocks: PayrollBlockMap = {};
    for (const employee of employees) {
      this.calculateAndCollectWarnings(
        employee,
        contractsByEmployee.get(employee.id) ?? [],
        noveltiesByEmployee.get(employee.id) ?? [],
        aportesExonerados,
        legalSnapshot,
        period.fechaInicio,
        warnings,
        blocks,
      );
    }

    return blocks;
  }

  private async syncFunctionalBlocksForPeriod(
    tx: Prisma.TransactionClient,
    tenantId: string,
    payrollPeriodId: string,
    detectedBlocks: PayrollBlockMap,
  ) {
    const existingBlocks = await tx.payrollBlock.findMany({
      where: { tenantId, payrollPeriodId },
      select: {
        id: true,
        employeeId: true,
        code: true,
        status: true,
      },
    });
    const existingByKey = new Map(
      existingBlocks.map((block) => [
        this.blockKey(block.employeeId, block.code),
        block,
      ]),
    );

    const detectedKeys = new Set<string>();
    for (const [employeeId, blocks] of Object.entries(detectedBlocks)) {
      for (const block of blocks) {
        const key = this.blockKey(employeeId, block.code);
        detectedKeys.add(key);
        const existing = existingByKey.get(key);

        if (!existing) {
          await tx.payrollBlock.create({
            data: {
              tenantId,
              payrollPeriodId,
              employeeId,
              code: block.code,
              message: block.message,
              status: PayrollBlockStatus.ACTIVE,
            },
          });
          continue;
        }

        if (existing.status === PayrollBlockStatus.EXCLUDED) {
          await tx.payrollBlock.update({
            where: { id: existing.id },
            data: { message: block.message },
          });
          continue;
        }

        await tx.payrollBlock.update({
          where: { id: existing.id },
          data: {
            message: block.message,
            status: PayrollBlockStatus.ACTIVE,
            resolvedAt: null,
          },
        });
      }
    }

    const now = new Date();
    for (const block of existingBlocks) {
      const key = this.blockKey(block.employeeId, block.code);
      if (
        detectedKeys.has(key) ||
        block.status === PayrollBlockStatus.RESOLVED
      ) {
        continue;
      }

      await tx.payrollBlock.update({
        where: { id: block.id },
        data: {
          status: PayrollBlockStatus.RESOLVED,
          resolvedAt: now,
        },
      });
    }
  }

  private blockKey(employeeId: string, code: string) {
    return `${employeeId}:${code}`;
  }

  private blockMessages(blocks: PayrollBlockMap): Record<string, string[]> {
    return Object.fromEntries(
      Object.entries(blocks).map(([employeeId, employeeBlocks]) => [
        employeeId,
        employeeBlocks.map((block) => block.message),
      ]),
    );
  }

  /**
   * Resuelve el ParametroLegalNomina vigente para una fecha de inicio de período.
   * Prioridad: override de tenant → global de plataforma.
   * Lanza NotFoundException si no existe ninguna vigencia aplicable.
   */
  private async resolveLegalParams(
    tenantId: string,
    periodStart: Date,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    // Normalizar a fecha UTC pura (sin componente horario) para comparar con @db.Date
    const d = periodStart;
    const periodDate = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );

    // 1. Override específico del tenant
    const tenantParam = await db.parametroLegalNomina.findFirst({
      where: {
        tenantId,
        vigenciaDesde: { lte: periodDate },
        OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: periodDate } }],
      },
      orderBy: { vigenciaDesde: 'desc' },
    });
    if (tenantParam) return tenantParam;

    // 2. Global de plataforma (tenantId IS NULL)
    const globalParam = await db.parametroLegalNomina.findFirst({
      where: {
        tenantId: null,
        vigenciaDesde: { lte: periodDate },
        OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: periodDate } }],
      },
      orderBy: { vigenciaDesde: 'desc' },
    });
    if (!globalParam) {
      const iso = periodDate.toISOString().slice(0, 10);
      throw new NotFoundException(
        `No existe parámetro legal de nómina vigente para ${iso}. ` +
          `Verifique que el seed haya corrido o defina un override para este tenant.`,
      );
    }
    return globalParam;
  }

  /**
   * Calcula la nómina de un empleado y acumula sus advertencias en `warningsMap`.
   * Extrae la lógica de resolución de contrato + ARL + calculator para reutilizar
   * en generatePayroll y recalculatePayroll sin duplicar código.
   */
  private async createApprovedSnapshots(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    period: {
      id: string;
      tenantId: string;
      nombre: string;
      fechaInicio: Date;
      fechaFin: Date;
      fechaPrevistaPagoPila: Date | null;
      status: PayrollPeriodStatus;
    },
    origin: string,
  ) {
    const runs = await tx.payrollRun.findMany({
      where: { tenantId, payrollPeriodId: period.id },
      include: {
        concepts: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (runs.length === 0) return 0;

    for (const run of runs) {
      const trace = this.getCalculationTrace(run.id, run.calculationTrace);
      if (!run.parametroLegalId) {
        throw new BadRequestException(
          `La liquidaciÃ³n ${run.id} no tiene parÃ¡metro legal para congelar`,
        );
      }

      const payload = {
        metadata: {
          payloadVersion: SNAPSHOT_PAYLOAD_VERSION,
          generatedAt: new Date().toISOString(),
          generatedInStatus: PayrollPeriodStatus.APROBADA,
          origin,
          approvedById: userId,
        },
        period: buildPayrollPeriodSnapshot({
          payrollPeriodId: run.payrollPeriodId,
          nombre: trace.period.nombre,
          fechaInicio: trace.period.fechaInicio,
          fechaFin: trace.period.fechaFin,
          fechaPrevistaPagoPila: period.fechaPrevistaPagoPila,
          status: PayrollPeriodStatus.APROBADA,
        }),
        employee: {
          employeeId: run.employeeId,
          salarioBaseUsado: this.toNumber(run.salarioBaseSnapshot),
          salarioIntegralUsado: trace.employee.salarioIntegralUsado,
        },
        contract: trace.contract
          ? {
              contratoId: trace.contract.contratoId,
              tipo: trace.contract.tipo,
              estado: trace.contract.estado,
              fechaInicio: trace.contract.fechaInicio,
              fechaFin: trace.contract.fechaFin,
              salarioContrato: trace.contract.salarioContrato,
              sedeId: trace.contract.sedeId,
              claseRiesgoArlUsada: trace.contract.claseRiesgoArlUsada,
            }
          : null,
        costCenter: trace.costCenter
          ? {
              centroCostoId: run.centroCostoId,
              codigo: trace.costCenter.codigo,
              nombre: trace.costCenter.nombre,
              sedeId: trace.costCenter.sedeId,
            }
          : { centroCostoId: run.centroCostoId },
        companyPolicy: trace.companyPolicy,
        legalParameters: {
          parametroLegalId: run.parametroLegalId,
          ...trace.legalParameters,
        },
        novelties: trace.novelties,
        concepts: run.concepts.map((concept) => ({
          conceptId: concept.id,
          codigo: concept.codigo,
          tipo: concept.tipo,
          nombre: concept.nombre,
          base: this.toNumber(concept.base),
          factor: this.toNumber(concept.factor),
          valor: this.toNumber(concept.valor),
        })),
        totals: {
          totalDevengos: this.toNumber(run.totalDevengos),
          totalDeducciones: this.toNumber(run.totalDeducciones),
          netoPagar: this.toNumber(run.netoPagar),
          ibc: this.toNumber(run.ibc),
          auxilioTransporte: this.toNumber(run.auxilioTransporte),
          totalAportesPatronales: this.toNumber(run.totalAportesPatronales),
          totalProvisiones: this.toNumber(run.totalProvisiones),
          costoTotalEmpleador: this.toNumber(run.costoTotalEmpleador),
        },
        calculationEvidence: trace.calculationEvidence,
      };

      await tx.payrollSnapshot.create({
        data: {
          tenantId,
          payrollRunId: run.id,
          payrollPeriodId: period.id,
          employeeId: run.employeeId,
          contratoId: trace.contract?.contratoId ?? null,
          parametroLegalId: run.parametroLegalId,
          centroCostoId: run.centroCostoId,
          aprobadoPorId: userId,
          estadoPeriodo: PayrollPeriodStatus.APROBADA,
          origen: origin,
          payloadVersion: SNAPSHOT_PAYLOAD_VERSION,
          payload,
        },
      });
    }

    return runs.length;
  }

  private getCalculationTrace(
    runId: string,
    value: Prisma.JsonValue,
  ): PayrollCalculationTrace {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(
        `La liquidación ${runId} no tiene huella técnica de cálculo para congelar`,
      );
    }
    return value as unknown as PayrollCalculationTrace;
  }

  private serializeLegalParams(p: {
    id: string;
    tenantId: string | null;
    vigenciaDesde: Date;
    vigenciaHasta: Date | null;
    anio: number;
    smmlv: unknown;
    auxilioTransporte: unknown;
    uvt: unknown;
    topeIbcMinSmmlv: number;
    topeIbcMaxSmmlv: number;
    umbralAuxilioSmmlv: unknown;
    umbralExoneracionSmmlv: number;
    pctSaludEmpleado: unknown;
    pctPensionEmpleado: unknown;
    pctSaludEmpleador: unknown;
    pctPensionEmpleador: unknown;
    pctCaja: unknown;
    pctIcbf: unknown;
    pctSena: unknown;
    arlClaseI: unknown;
    arlClaseII: unknown;
    arlClaseIII: unknown;
    arlClaseIV: unknown;
    arlClaseV: unknown;
    factorProvPrima: unknown;
    factorProvCesantias: unknown;
    factorProvIntCesantias: unknown;
    factorProvVacaciones: unknown;
    fspTramos: Prisma.JsonValue;
    fuente: string | null;
    notas: string | null;
  }) {
    return {
      tenantId: p.tenantId,
      vigenciaDesde: this.toIsoDate(p.vigenciaDesde),
      vigenciaHasta: this.toIsoDate(p.vigenciaHasta),
      anio: p.anio,
      smmlv: this.toNumber(p.smmlv),
      auxilioTransporte: this.toNumber(p.auxilioTransporte),
      uvt: this.toNumber(p.uvt),
      topes: {
        topeIbcMinSmmlv: p.topeIbcMinSmmlv,
        topeIbcMaxSmmlv: p.topeIbcMaxSmmlv,
        umbralAuxilioSmmlv: this.toNumber(p.umbralAuxilioSmmlv),
        umbralExoneracionSmmlv: p.umbralExoneracionSmmlv,
      },
      tarifasEmpleado: {
        pctSaludEmpleado: this.toNumber(p.pctSaludEmpleado),
        pctPensionEmpleado: this.toNumber(p.pctPensionEmpleado),
      },
      tarifasEmpleador: {
        pctSaludEmpleador: this.toNumber(p.pctSaludEmpleador),
        pctPensionEmpleador: this.toNumber(p.pctPensionEmpleador),
        pctCaja: this.toNumber(p.pctCaja),
        pctIcbf: this.toNumber(p.pctIcbf),
        pctSena: this.toNumber(p.pctSena),
      },
      tarifasArl: {
        arlClaseI: this.toNumber(p.arlClaseI),
        arlClaseII: this.toNumber(p.arlClaseII),
        arlClaseIII: this.toNumber(p.arlClaseIII),
        arlClaseIV: this.toNumber(p.arlClaseIV),
        arlClaseV: this.toNumber(p.arlClaseV),
      },
      factoresProvision: {
        factorProvPrima: this.toNumber(p.factorProvPrima),
        factorProvCesantias: this.toNumber(p.factorProvCesantias),
        factorProvIntCesantias: this.toNumber(p.factorProvIntCesantias),
        factorProvVacaciones: this.toNumber(p.factorProvVacaciones),
      },
      fspTramos: p.fspTramos,
      fuente: p.fuente,
      notas: p.notas,
    };
  }

  private toNumber(value: unknown) {
    return value === null || value === undefined ? null : Number(value);
  }

  private toIsoDate(value: Date | null) {
    return value ? value.toISOString() : null;
  }

  private calculateAndCollectWarnings(
    emp: EmpForPayroll,
    empContracts: Array<{
      id: string;
      empleadoId: string;
      tipo: string;
      estado: string;
      fechaInicio: Date;
      fechaFin: Date | null;
      salario: Prisma.Decimal;
      sedeId: string | null;
      claseRiesgoArl: number | null;
    }>,
    empNovelties: Array<{ tipo: string; valor: Prisma.Decimal | null }>,
    aportesExonerados: boolean,
    legalSnapshot: ReturnType<typeof toSnapshot>,
    periodStart: Date,
    warningsMap: Record<string, string[]>,
    blocksMap: PayrollBlockMap,
  ): {
    result: PayrollCalculationResult;
    contrato: ContratoForPayroll | null;
    contratoFallback: boolean;
    input: PayrollCalculationInput;
  } {
    const { contrato, fallback } = resolveContrato(empContracts, periodStart);

    const { input, blocks: inputBlocks } = buildCalculationInput(
      emp,
      contrato,
      empNovelties,
      aportesExonerados,
      legalSnapshot,
    );

    const allWarnings: string[] = [];
    const blocks: PayrollFunctionalBlock[] = [];
    if (fallback) {
      allWarnings.push(
        `Contrato: sin VIGENTE para el período; usando fallback (${contrato?.estado ?? 'sin contrato'})`,
      );
    }
    if (fallback) {
      blocks.push(
        functionalBlock(
          PayrollBlockCode.MISSING_ACTIVE_CONTRACT,
          `Contrato: sin VIGENTE para el periodo (${contrato?.estado ?? 'sin contrato'}); no se puede liquidar con correccion garantizada`,
        ),
      );
    }
    if (!contrato) {
      blocks.push(
        functionalBlock(
          PayrollBlockCode.MISSING_ACTIVE_CONTRACT,
          'Contrato: no existe contrato para el empleado; no se puede liquidar con correccion garantizada',
        ),
      );
    }
    blocks.push(...inputBlocks);

    const result = calculate(input);
    allWarnings.push(...result.warnings.map((w) => w.message));

    const informativeWarnings = allWarnings.filter(
      (warning) => !warning.startsWith('Contrato: sin VIGENTE'),
    );
    if (informativeWarnings.length > 0) {
      warningsMap[emp.id] = informativeWarnings;
    }
    if (blocks.length > 0) {
      blocksMap[emp.id] = blocks;
    }

    return { result, contrato, contratoFallback: fallback, input };
  }

  private buildCalculationTrace(
    emp: EmpForPayroll,
    period: {
      nombre: string;
      fechaInicio: Date;
      fechaFin: Date;
    },
    centroCosto: CostCenterForPayrollTrace | null,
    calculation: {
      contrato: ContratoForPayroll | null;
      contratoFallback: boolean;
      input: PayrollCalculationInput;
    },
    legalParameters: Record<string, unknown>,
    novelties: NoveltyForPayrollTrace[],
  ): PayrollCalculationTrace {
    const { contrato, contratoFallback, input } = calculation;

    return {
      traceVersion: CALCULATION_TRACE_VERSION,
      period: {
        nombre: period.nombre,
        fechaInicio: this.toIsoDate(period.fechaInicio),
        fechaFin: this.toIsoDate(period.fechaFin),
      },
      employee: {
        salarioIntegralUsado: emp.salarioIntegral,
      },
      contract: contrato
        ? {
            contratoId: contrato.id,
            tipo: contrato.tipo,
            estado: contrato.estado,
            fechaInicio: this.toIsoDate(contrato.fechaInicio),
            fechaFin: this.toIsoDate(contrato.fechaFin),
            salarioContrato: Number(contrato.salario),
            sedeId: contrato.sedeId,
            claseRiesgoArlOriginal: contrato.claseRiesgoArl,
            claseRiesgoArlUsada: input.claseRiesgoArl,
            fallbackUsado: contratoFallback,
          }
        : null,
      costCenter: centroCosto
        ? {
            codigo: centroCosto.codigo,
            nombre: centroCosto.nombre,
            sedeId: centroCosto.sedeId,
          }
        : null,
      companyPolicy: {
        aportesExonerados: input.aportesExonerados,
      },
      legalParameters,
      novelties: novelties.map((n) => ({
        noveltyId: n.id,
        tipo: n.tipo,
        descripcion: n.descripcion,
        fecha: this.toIsoDate(n.fecha),
        valor: this.toNumber(n.valor),
      })),
      calculationEvidence: { politicaRedondeoAplicada: 'PESO_ENTERO' },
    };
  }

  /** Construye el payload de creación de PayrollRun con campos N2A completos. */
  private buildRunCreateData(
    emp: EmpForPayroll,
    result: PayrollCalculationResult,
    parametroLegalId: string,
    period: {
      id: string;
      nombre: string;
      fechaInicio: Date;
      fechaFin: Date;
    },
    tenantId: string,
    centroCosto: CostCenterForPayrollTrace | null,
    calculation: {
      contrato: ContratoForPayroll | null;
      contratoFallback: boolean;
      input: PayrollCalculationInput;
    },
    legalParameters: Record<string, unknown>,
    novelties: NoveltyForPayrollTrace[],
  ) {
    return {
      tenantId,
      payrollPeriodId: period.id,
      employeeId: emp.id,
      centroCostoId: centroCosto?.id ?? null,
      totalDevengos: result.totalDevengos,
      totalDeducciones: result.totalDeducciones,
      netoPagar: result.netoPagar,
      salarioBaseSnapshot: Number(emp.salario),
      // N2A — snapshot de cálculo colombiano
      ibc: result.ibc,
      auxilioTransporte: result.auxilioTransporte,
      totalAportesPatronales: result.totalAportesPatronales,
      costoTotalEmpleador: result.costoTotalEmpleador,
      // N2B — snapshot de provisiones prestacionales
      totalProvisiones: result.totalProvisiones,
      parametroLegalId,
      calculationTrace: this.buildCalculationTrace(
        emp,
        period,
        centroCosto,
        calculation,
        legalParameters,
        novelties,
      ) as Prisma.InputJsonValue,
      // Conceptos (mapeo genérico): incluye PROVISION con codigo/base/factor.
      concepts: {
        create: result.concepts.map((c) => ({
          tipo: c.tipo,
          nombre: c.nombre,
          valor: c.valor,
          codigo: c.codigo,
          base: c.base,
          factor: c.factor,
        })),
      },
    };
  }

  private async resolveCentrosCostoBySede(
    tenantId: string,
    contracts: Array<{ sedeId: string | null }>,
  ) {
    const sedeIds = [
      ...new Set(
        contracts
          .map((c) => c.sedeId)
          .filter((sedeId): sedeId is string => Boolean(sedeId)),
      ),
    ];
    if (sedeIds.length === 0)
      return new Map<string, CostCenterForPayrollTrace>();

    const centros = await this.prisma.centroCosto.findMany({
      where: {
        tenantId,
        sedeId: { in: sedeIds },
        activo: true,
        deletedAt: null,
      },
      select: { id: true, codigo: true, nombre: true, sedeId: true },
      orderBy: { createdAt: 'asc' },
    });

    const bySede = new Map<string, CostCenterForPayrollTrace>();
    for (const centro of centros) {
      if (centro.sedeId && !bySede.has(centro.sedeId)) {
        bySede.set(centro.sedeId, centro);
      }
    }
    return bySede;
  }

  private resolveCentroCosto(
    contrato: ContratoForPayroll | null,
    centroCostoBySede: Map<string, CostCenterForPayrollTrace>,
  ) {
    if (!contrato?.sedeId) return null;
    return centroCostoBySede.get(contrato.sedeId) ?? null;
  }
}
