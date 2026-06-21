import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
import { resolveDiasCausados } from './dias-causados';

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

  async closePeriod(tenantId: string, userId: string, id: string) {
    const { period, runs, totals } = await this.findOnePeriod(tenantId, id);
    if (period.status === 'CLOSED')
      throw new BadRequestException('El período ya está cerrado');
    const updated = await this.prisma.payrollPeriod.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
    this.auditService
      .log({
        tenantId,
        userId,
        action: 'PAYROLL_PERIOD_CLOSED',
        entityType: 'PayrollPeriod',
        entityId: id,
        metadata: {
          periodName: period.nombre,
          payrollPeriodId: id,
          totalRuns: runs.length,
          totalNeto: totals.totalNeto,
        },
      })
      .catch(() => {});
    return updated;
  }

  async generatePayroll(tenantId: string, userId: string, periodId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
    });
    if (!period) throw new NotFoundException('Período no encontrado');
    if (period.status === 'CLOSED')
      throw new BadRequestException(
        'No se puede generar nómina en un período cerrado',
      );

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

    // N2C: incluye RETIRADO cuyo fechaRetiro cae dentro o después del inicio del período.
    const employees = await this.prisma.empleado.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { estado: 'ACTIVO' },
          { estado: 'RETIRADO', fechaRetiro: { gte: period.fechaInicio } },
        ],
      },
      select: {
        id: true,
        salario: true,
        salarioIntegral: true,
        fechaIngreso: true,
        fechaRetiro: true,
      },
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
            // N2C: resolver días causados; omitir si el empleado no causa días en este período.
            const diasCausados = resolveDiasCausados(
              emp.fechaIngreso,
              emp.fechaRetiro,
              period.fechaInicio,
              period.fechaFin,
            );
            if (diasCausados === 0) continue;

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
              diasCausados,
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
    if (period.status === 'CLOSED')
      throw new ConflictException('No se puede recalcular un período cerrado');

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

    // N2C: incluye RETIRADO cuyo fechaRetiro cae dentro o después del inicio del período.
    const employees = await this.prisma.empleado.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { estado: 'ACTIVO' },
          { estado: 'RETIRADO', fechaRetiro: { gte: period.fechaInicio } },
        ],
      },
      select: {
        id: true,
        salario: true,
        salarioIntegral: true,
        fechaIngreso: true,
        fechaRetiro: true,
      },
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
            // N2C: resolver días causados; omitir si el empleado no causa días en este período.
            const diasCausados = resolveDiasCausados(
              emp.fechaIngreso,
              emp.fechaRetiro,
              period.fechaInicio,
              period.fechaFin,
            );
            if (diasCausados === 0) continue;

            const empWarnings = this.calculateAndCollectWarnings(
              emp,
              contractsByEmployee.get(emp.id) ?? [],
              noveltiesByEmployee.get(emp.id) ?? [],
              aportesExonerados,
              legalSnapshot,
              period.fechaInicio,
              runWarnings,
              diasCausados,
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
            summary.runsCreated++;
          }
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
      recalculated: summary.runsCreated,
      message: `${summary.runsCreated} empleados reliquidados`,
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
    diasCausados: number,
  ): { result: PayrollCalculationResult } {
    const { contrato, fallback } = resolveContrato(empContracts, periodStart);

    const { input, serviceWarnings } = buildCalculationInput(
      emp,
      contrato,
      empNovelties,
      aportesExonerados,
      legalSnapshot,
      diasCausados,
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
