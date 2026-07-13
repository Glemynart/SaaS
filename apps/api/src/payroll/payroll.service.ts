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
import { AuditService } from '../audit/audit.service';
import {
  CreatePayrollPeriodDto,
  CreatePayrollNoveltyDto,
} from './dto/create-payroll.dto';
import { CreatePayrollCorrectionDto } from './dto/payroll-correction.dto';
import { calculate } from './calculator/payroll-calculator';
import {
  PayrollCalculationInput,
  PayrollCalculationResult,
} from './calculator/payroll-types';
import {
  EmpForPayroll,
  ContratoForPayroll,
  buildCalculationInput,
  resolveContrato,
  toSnapshot,
} from './payroll-mapper';
import { assertTransition } from './payroll-states';
import { assertCorrectionTransition } from './payroll-correction-states';
import {
  functionalBlock,
  PayrollBlockCode,
  PayrollFunctionalBlock,
} from './payroll-evaluation';

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

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

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

    const runs = await this.prisma.payrollRun.findMany({
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
    });

    const totalDevengos = runs.reduce((s, r) => s + Number(r.totalDevengos), 0);
    const totalDeducciones = runs.reduce(
      (s, r) => s + Number(r.totalDeducciones),
      0,
    );
    const totalNeto = runs.reduce((s, r) => s + Number(r.netoPagar), 0);

    return {
      period,
      runs,
      totals: { totalDevengos, totalDeducciones, totalNeto },
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
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
      select: { id: true },
    });
    if (!period) throw new NotFoundException('Período no encontrado');

    return this.prisma.payrollCorrection.findMany({
      where: { tenantId, payrollPeriodId: periodId },
      orderBy: [{ createdAt: 'desc' }],
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

    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
      select: { id: true, nombre: true, status: true },
    });
    if (!period) throw new NotFoundException('Período no encontrado');
    if (period.status !== PayrollPeriodStatus.APROBADA) {
      throw new BadRequestException(
        'Solo se pueden registrar correcciones sobre un período aprobado',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const correction = await tx.payrollCorrection.create({
        data: {
          tenantId,
          payrollPeriodId: period.id,
          status: PayrollCorrectionStatus.BORRADOR,
          descripcion,
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
    return this.transitionCorrection(
      tenantId,
      userId,
      correctionId,
      PayrollCorrectionStatus.EN_REVISION,
      PayrollCorrectionStatus.APROBADA,
      'PAYROLL_CORRECTION_APPROVED',
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

    return this.prisma.$transaction(async (tx) => {
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
    if (correction.status !== from) {
      throw new BadRequestException(
        `Transición de corrección no permitida: ${correction.status} → ${to} (se requiere ${from})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.payrollCorrection.updateMany({
        where: { id: correctionId, tenantId, status: from },
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

    const employees = await this.prisma.empleado.findMany({
      where: { tenantId, deletedAt: null, estado: 'ACTIVO' },
      select: { id: true, salario: true, salarioIntegral: true },
    });

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

    const employees = await this.prisma.empleado.findMany({
      where: { tenantId, deletedAt: null, estado: 'ACTIVO' },
      select: { id: true, salario: true, salarioIntegral: true },
    });

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
      this.prisma.empleado.findFirst({
        where: { id: dto.employeeId, tenantId, deletedAt: null },
      }),
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
        period: {
          payrollPeriodId: run.payrollPeriodId,
          nombre: trace.period.nombre,
          fechaInicio: trace.period.fechaInicio,
          fechaFin: trace.period.fechaFin,
          status: PayrollPeriodStatus.APROBADA,
        },
        employee: {
          employeeId: run.employeeId,
          salarioBaseUsado: this.toNumber(run.salarioBaseSnapshot),
          salarioIntegralUsado: trace.employee.salarioIntegralUsado,
        },
        contract: trace.contract
          ? {
              contratoId: trace.contract.contratoId,
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
          payload: payload as Prisma.InputJsonValue,
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
