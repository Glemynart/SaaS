import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LiquidationStatus, PayrollPeriodStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { calculate, diasComerciales } from './liquidation-calculator';
import {
  addDays,
  buildLiquidationCreateData,
  buildLiquidationInput,
} from './liquidation-mapper';
import { ListLiquidationsDto } from '../dto/list-liquidations.dto';

const VALID_TRANSITIONS: Record<LiquidationStatus, LiquidationStatus[]> = {
  DRAFT: ['APPROVED', 'VOIDED'],
  APPROVED: ['PAID', 'VOIDED'],
  PAID: [],
  VOIDED: [],
};

/**
 * Estados de PayrollPeriod que indican "el mes ya se procesó" (resolveDias-
 * SalarioPendiente los usa como proxy temporal de PAID; ver ese método).
 * Antes de U1 el único estado terminal era CLOSED; U1 lo reemplazó por
 * APROBADA (P1) y migró los períodos legados CLOSED → CERRADA (backfill).
 * Ningún código nuevo escribe CLOSED — ver payroll-states.ts.
 */
const PERIODOS_PROCESADOS: PayrollPeriodStatus[] = [
  PayrollPeriodStatus.APROBADA,
  PayrollPeriodStatus.CERRADA,
];

@Injectable()
export class LiquidationService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  assertTransition(current: LiquidationStatus, target: LiquidationStatus) {
    if (!VALID_TRANSITIONS[current].includes(target)) {
      throw new BadRequestException(
        `Transición de estado no permitida: ${current} → ${target}`,
      );
    }
  }

  assertEditable(status: LiquidationStatus) {
    if (status !== 'DRAFT') {
      throw new BadRequestException(
        `La liquidación en estado ${status} no es modificable`,
      );
    }
  }

  async createLiquidacion(
    tenantId: string,
    userId: string,
    empleadoId: string,
  ) {
    // ── 1. Cargar empleado ───────────────────────────────────────────────────
    const emp = await this.prisma.empleado.findFirst({
      where: { id: empleadoId, tenantId, deletedAt: null },
      select: {
        id: true,
        estado: true,
        salario: true,
        salarioIntegral: true,
        fechaIngreso: true,
        fechaRetiro: true,
      },
    });

    if (!emp) {
      throw new NotFoundException('Empleado no encontrado');
    }

    // ── 2. Validaciones de dominio ───────────────────────────────────────────
    if (emp.estado !== 'RETIRADO') {
      throw new BadRequestException(
        'Solo se pueden liquidar empleados retirados',
      );
    }

    if (!emp.fechaRetiro) {
      throw new BadRequestException(
        'El empleado no tiene fecha de retiro registrada. ' +
          'Registre la fecha de retiro antes de generar la liquidación.',
      );
    }

    const existingDraft = await this.prisma.liquidation.findFirst({
      where: { tenantId, empleadoId, status: 'DRAFT' },
      select: { id: true },
    });

    if (existingDraft) {
      throw new ConflictException(
        `Ya existe una liquidación en estado DRAFT para este empleado ` +
          `(id: ${existingDraft.id}). ` +
          'Finalice o anule la existente antes de crear una nueva.',
      );
    }

    // ── 3. Resolver salario pendiente (política N2D.4) ───────────────────────
    const diasSalarioPendiente = await this.resolveDiasSalarioPendiente(
      tenantId,
      empleadoId,
      emp.fechaIngreso,
      emp.fechaRetiro,
    );

    // ── 4. Construir input (mapper adapta semántica inclusivo → exclusivo) ───
    const { input, diasLiquidados } = buildLiquidationInput(
      emp,
      emp.fechaRetiro,
      diasSalarioPendiente,
    );

    // ── 5. Calcular ──────────────────────────────────────────────────────────
    const result = calculate(input);

    // ── 6. Persistir en transacción ──────────────────────────────────────────
    //    El findFirst anterior es una optimización con mensaje amable, pero es
    //    racy (TOCTOU). El índice único parcial DRAFT (migración N2D.6) es la
    //    garantía real: dos requests simultáneos (doble click) chocan en P2002
    //    y aquí se traduce a 409 Conflict.
    let liquidation;
    try {
      liquidation = await this.prisma.$transaction(async (tx) => {
        return tx.liquidation.create({
          data: buildLiquidationCreateData(
            tenantId,
            empleadoId,
            emp.fechaRetiro!,
            diasLiquidados,
            result,
          ),
          include: { concepts: true },
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const target = (e.meta?.target as string[]) ?? [];
        if (target.includes('liquidations_tenantId_empleadoId_draft_key')) {
          throw new ConflictException(
            'Ya existe una liquidación en estado DRAFT para este empleado.',
          );
        }
      }
      throw e;
    }

    // ── 7. Auditoría ─────────────────────────────────────────────────────────
    this.audit
      .log({
        tenantId,
        userId,
        action: 'LIQUIDATION_CREATED',
        entityType: 'Liquidation',
        entityId: liquidation.id,
        metadata: {
          empleadoId,
          fechaRetiro: emp.fechaRetiro.toISOString().slice(0, 10),
          diasLiquidados,
          totalLiquidacion: result.totalLiquidacion,
          conceptosGenerados: result.conceptos.length,
        },
      })
      .catch(() => {});

    return liquidation;
  }

  /**
   * Resuelve los días de salario pendiente del mes de retiro (política N2D.4).
   *
   * Política (decisión funcional cerrada):
   *  1. Buscar el PayrollPeriod que contiene fechaRetiro (último día trabajado).
   *  2. Si existe un PayrollRun del empleado en ese período y el período ya
   *     fue procesado (APROBADA o, legado, CERRADA — ver PERIODOS_PROCESADOS)
   *     → 0 (el salario del mes ya se pagó; el estado "procesado" es proxy
   *     temporal de PAID).
   *  3. En caso contrario → días comerciales (30/360) trabajados dentro del
   *     período de retiro.
   *
   * No se analizan períodos anteriores ni se reconcilian históricos. Si no
   * existe ningún período que contenga fechaRetiro, no hay marco temporal para
   * determinar días pendientes y se retorna 0 (no se emite el concepto).
   *
   * @param fechaRetiro - Último día trabajado (inclusivo) leído de la BD.
   */
  private async resolveDiasSalarioPendiente(
    tenantId: string,
    empleadoId: string,
    fechaIngreso: Date,
    fechaRetiro: Date,
  ): Promise<number> {
    // 1. Período que contiene fechaRetiro.
    const periodo = await this.prisma.payrollPeriod.findFirst({
      where: {
        tenantId,
        fechaInicio: { lte: fechaRetiro },
        fechaFin: { gte: fechaRetiro },
      },
      orderBy: { fechaInicio: 'desc' },
      select: { id: true, status: true, fechaInicio: true },
    });

    // Sin período → fallback: mes calendario de fechaRetiro como ventana.
    if (!periodo) {
      const inicioMes = new Date(
        Date.UTC(fechaRetiro.getUTCFullYear(), fechaRetiro.getUTCMonth(), 1),
      );
      const desde = inicioMes > fechaIngreso ? inicioMes : fechaIngreso;
      const dias = diasComerciales(desde, addDays(fechaRetiro, 1));
      return dias > 0 ? dias : 0;
    }

    // 2. ¿Existe un PayrollRun del empleado en un período ya procesado?
    if (PERIODOS_PROCESADOS.includes(periodo.status)) {
      const run = await this.prisma.payrollRun.findFirst({
        where: {
          tenantId,
          employeeId: empleadoId,
          payrollPeriodId: periodo.id,
        },
        select: { id: true },
      });
      if (run) {
        return 0;
      }
    }

    // 3. Días comerciales trabajados dentro del período de retiro.
    //    El empleado no trabaja antes de su ingreso → se acota a fechaIngreso.
    //    fechaRetiro es inclusivo → extremo exclusivo = fechaRetiro + 1 día.
    const desde =
      periodo.fechaInicio > fechaIngreso ? periodo.fechaInicio : fechaIngreso;
    const dias = diasComerciales(desde, addDays(fechaRetiro, 1));
    return dias > 0 ? dias : 0;
  }

  // ── Lectura (N2D.6) ─────────────────────────────────────────────────────────

  async findAll(tenantId: string, query: ListLiquidationsDto) {
    const { page = 1, limit = 10, status, empleadoId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LiquidationWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(empleadoId && { empleadoId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.liquidation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.liquidation.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const liquidation = await this.prisma.liquidation.findFirst({
      where: { id, tenantId },
      include: { concepts: true },
    });

    if (!liquidation) {
      throw new NotFoundException('Liquidación no encontrada');
    }

    return liquidation;
  }

  // ── Transiciones de estado (N2D.5 / concurrencia N2D.6) ──────────────────────

  approveLiquidation(tenantId: string, userId: string, liquidationId: string) {
    return this.transition(
      tenantId,
      userId,
      liquidationId,
      'APPROVED',
      'LIQUIDATION_APPROVED',
    );
  }

  markLiquidationPaid(tenantId: string, userId: string, liquidationId: string) {
    return this.transition(
      tenantId,
      userId,
      liquidationId,
      'PAID',
      'LIQUIDATION_PAID',
    );
  }

  voidLiquidation(tenantId: string, userId: string, liquidationId: string) {
    return this.transition(
      tenantId,
      userId,
      liquidationId,
      'VOIDED',
      'LIQUIDATION_VOIDED',
    );
  }

  /**
   * Transición de estado segura ante concurrencia (N2D.6).
   *
   * El patrón previo findFirst+update tenía una ventana TOCTOU: dos requests
   * concurrentes (approve+void, pay+void) leían el mismo estado, ambos pasaban
   * assertTransition y ambos escribían, con last-write-wins no determinístico.
   *
   * Solución más simple compatible con Prisma: updateMany condicional con el
   * estado leído en el WHERE. La BD garantiza atomicidad de la condición; solo
   * el primer request que commitea cambia el estado. El segundo matchea 0 filas
   * (el estado ya no es el esperado) → 409 Conflict.
   *
   *   - 404: no existe o no es del tenant (findFirst).
   *   - 400: transición inválida según la máquina de estados (assertTransition).
   *   - 409: carrera perdida — otro request transicionó primero (count === 0).
   */
  private async transition(
    tenantId: string,
    userId: string,
    liquidationId: string,
    target: LiquidationStatus,
    auditAction: string,
  ) {
    const liq = await this.prisma.liquidation.findFirst({
      where: { id: liquidationId, tenantId },
      select: { id: true, status: true, empleadoId: true },
    });

    if (!liq) {
      throw new NotFoundException('Liquidación no encontrada');
    }

    this.assertTransition(liq.status, target);

    const { count } = await this.prisma.liquidation.updateMany({
      where: { id: liquidationId, tenantId, status: liq.status },
      data: { status: target },
    });

    if (count === 0) {
      throw new ConflictException(
        'La liquidación cambió de estado de forma concurrente. ' +
          'Recargue e intente de nuevo.',
      );
    }

    const updated = await this.prisma.liquidation.findFirst({
      where: { id: liquidationId, tenantId },
      include: { concepts: true },
    });

    this.audit
      .log({
        tenantId,
        userId,
        action: auditAction,
        entityType: 'Liquidation',
        entityId: liquidationId,
        metadata: { empleadoId: liq.empleadoId },
      })
      .catch(() => {});

    return updated;
  }
}
