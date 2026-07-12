import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, PayrollPeriodStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreatePayrollPeriodDto,
  CreatePayrollNoveltyDto,
} from './dto/create-payroll.dto';
import { calculate } from './calculator/payroll-calculator';
import { PayrollCalculationResult } from './calculator/payroll-types';
import {
  EmpForPayroll,
  buildCalculationInput,
  resolveContrato,
  toSnapshot,
} from './payroll-mapper';
import { assertTransition } from './payroll-states';

/** Estados en los que el motor de cálculo puede ejecutarse (ADR-002 §6). */
const GENERATE_ALLOWED_STATUSES: PayrollPeriodStatus[] = [
  PayrollPeriodStatus.BORRADOR,
  PayrollPeriodStatus.CALCULADA,
];

/** Idéntico rango que generate: recalcular es libre hasta APROBADA (§6). */
const RECALCULATE_ALLOWED_STATUSES: PayrollPeriodStatus[] =
  GENERATE_ALLOWED_STATUSES;

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
    const { period, runs, totals } = await this.findOnePeriod(tenantId, id);
    if (period.status !== PayrollPeriodStatus.CALCULADA) {
      throw new BadRequestException(
        `Solo se puede aprobar (alias legado "close") un período en estado ` +
          `CALCULADA; estado actual: ${period.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.payrollPeriod.updateMany({
        where: { id, tenantId, status: PayrollPeriodStatus.CALCULADA },
        data: {
          status: PayrollPeriodStatus.APROBADA,
          aprobadoPorId: userId,
          aprobadoEn: new Date(),
        },
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
          action: 'PAYROLL_PERIOD_APPROVED_LEGACY_CLOSE',
          entityType: 'PayrollPeriod',
          entityId: id,
          metadata: {
            periodName: period.nombre,
            payrollPeriodId: id,
            totalRuns: runs.length,
            totalNeto: totals.totalNeto,
            from: PayrollPeriodStatus.CALCULADA,
            to: PayrollPeriodStatus.APROBADA,
          },
        },
        tx,
      );

      return tx.payrollPeriod.findFirstOrThrow({ where: { id, tenantId } });
    });
  }

  /** CALCULADA → EN_REVISION (ADR-002 §6). */
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
    return this.transitionPeriod(
      tenantId,
      userId,
      id,
      PayrollPeriodStatus.EN_REVISION,
      PayrollPeriodStatus.APROBADA,
      'PAYROLL_PERIOD_APPROVED',
      { data: { aprobadoPorId: userId, aprobadoEn: new Date() } },
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
        salario: true,
        claseRiesgoArl: true,
      },
      orderBy: { fechaInicio: 'desc' },
    });
    const contractsByEmployee = new Map<string, typeof allContracts>();
    for (const c of allContracts) {
      const list = contractsByEmployee.get(c.empleadoId) ?? [];
      list.push(c);
      contractsByEmployee.set(c.empleadoId, list);
    }

    // ── Transacción ──────────────────────────────────────────────────────────
    const created: unknown[] = [];
    const runWarnings: Record<string, string[]> = {};

    try {
      await this.prisma.$transaction(
        async (tx) => {
          for (const emp of employees) {
            const existing = await tx.payrollRun.findFirst({
              where: {
                tenantId,
                payrollPeriodId: periodId,
                employeeId: emp.id,
              },
            });
            if (existing) continue;

            const empWarnings = this.calculateAndCollectWarnings(
              emp,
              contractsByEmployee.get(emp.id) ?? [],
              noveltiesByEmployee.get(emp.id) ?? [],
              aportesExonerados,
              legalSnapshot,
              period.fechaInicio,
              runWarnings,
            );

            const run = await tx.payrollRun.create({
              data: this.buildRunCreateData(
                emp,
                empWarnings.result,
                legalParam.id,
                periodId,
                tenantId,
              ),
            });
            created.push(run);
          }

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
        },
      })
      .catch(() => {});

    return {
      created: created.length,
      message: `${created.length} empleados liquidados`,
      ...(Object.keys(runWarnings).length > 0 && { warnings: runWarnings }),
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
        salario: true,
        claseRiesgoArl: true,
      },
      orderBy: { fechaInicio: 'desc' },
    });
    const contractsByEmployee = new Map<string, typeof allContracts>();
    for (const c of allContracts) {
      const list = contractsByEmployee.get(c.empleadoId) ?? [];
      list.push(c);
      contractsByEmployee.set(c.empleadoId, list);
    }

    // ── Transacción ──────────────────────────────────────────────────────────
    const runWarnings: Record<string, string[]> = {};
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
            const empWarnings = this.calculateAndCollectWarnings(
              emp,
              contractsByEmployee.get(emp.id) ?? [],
              noveltiesByEmployee.get(emp.id) ?? [],
              aportesExonerados,
              legalSnapshot,
              period.fechaInicio,
              runWarnings,
            );

            await tx.payrollRun.create({
              data: this.buildRunCreateData(
                emp,
                empWarnings.result,
                legalParam.id,
                periodId,
                tenantId,
              ),
            });
          }
          summary.runsCreated = employees.length;

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
        },
      })
      .catch(() => {});

    return {
      recalculated: employees.length,
      message: `${employees.length} empleados reliquidados`,
      ...(Object.keys(runWarnings).length > 0 && { warnings: runWarnings }),
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

  /**
   * Resuelve el ParametroLegalNomina vigente para una fecha de inicio de período.
   * Prioridad: override de tenant → global de plataforma.
   * Lanza NotFoundException si no existe ninguna vigencia aplicable.
   */
  private async resolveLegalParams(tenantId: string, periodStart: Date) {
    // Normalizar a fecha UTC pura (sin componente horario) para comparar con @db.Date
    const d = periodStart;
    const periodDate = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );

    // 1. Override específico del tenant
    const tenantParam = await this.prisma.parametroLegalNomina.findFirst({
      where: {
        tenantId,
        vigenciaDesde: { lte: periodDate },
        OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: periodDate } }],
      },
      orderBy: { vigenciaDesde: 'desc' },
    });
    if (tenantParam) return tenantParam;

    // 2. Global de plataforma (tenantId IS NULL)
    const globalParam = await this.prisma.parametroLegalNomina.findFirst({
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
  private calculateAndCollectWarnings(
    emp: EmpForPayroll,
    empContracts: Array<{
      id: string;
      empleadoId: string;
      estado: string;
      fechaInicio: Date;
      fechaFin: Date | null;
      salario: Prisma.Decimal;
      claseRiesgoArl: number | null;
    }>,
    empNovelties: Array<{ tipo: string; valor: Prisma.Decimal | null }>,
    aportesExonerados: boolean,
    legalSnapshot: ReturnType<typeof toSnapshot>,
    periodStart: Date,
    warningsMap: Record<string, string[]>,
  ): { result: PayrollCalculationResult } {
    const { contrato, fallback } = resolveContrato(empContracts, periodStart);

    const { input, serviceWarnings } = buildCalculationInput(
      emp,
      contrato,
      empNovelties,
      aportesExonerados,
      legalSnapshot,
    );

    const allWarnings: string[] = [];
    if (fallback) {
      allWarnings.push(
        `Contrato: sin VIGENTE para el período; usando fallback (${contrato?.estado ?? 'sin contrato'})`,
      );
    }
    allWarnings.push(...serviceWarnings);

    const result = calculate(input);
    allWarnings.push(...result.warnings.map((w) => w.message));

    if (allWarnings.length > 0) {
      warningsMap[emp.id] = allWarnings;
    }

    return { result };
  }

  /** Construye el payload de creación de PayrollRun con campos N2A completos. */
  private buildRunCreateData(
    emp: { id: string; salario: Prisma.Decimal },
    result: PayrollCalculationResult,
    parametroLegalId: string,
    periodId: string,
    tenantId: string,
  ) {
    return {
      tenantId,
      payrollPeriodId: periodId,
      employeeId: emp.id,
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
}
