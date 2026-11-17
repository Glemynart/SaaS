import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LiquidationStatus, PayrollPeriodStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../tenant-prisma/tenant-prisma.service';
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
 * Estados que la regla actual N2D.4 trata como salario cubierto al calcular la
 * liquidación. Esto es un proxy funcional heredado, no evidencia de desembolso:
 * el modelo no registra pagos de nómina ni confirmación bancaria. No ampliar ni
 * reinterpretar esta lista sin definir primero qué hecho satisface el salario.
 */
const PERIODOS_PROCESADOS: PayrollPeriodStatus[] = [
  PayrollPeriodStatus.APROBADA,
  PayrollPeriodStatus.CAUSADA,
  PayrollPeriodStatus.CERRADA,
];

@Injectable()
export class LiquidationService {
  constructor(
    private prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
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
    // Serialize liquidation creation with RET capture and payroll generation.
    // All three paths lock this tenant-owned employee row before checking the
    // cross-module state that could otherwise pay the retirement month twice.
    try {
      return await this.tenantPrisma.execute(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "empleados"
          WHERE "tenantId" = ${tenantId} AND "id" = ${empleadoId}
          FOR UPDATE
        `;

        const emp = await tx.empleado.findFirst({
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
        if (!emp) throw new NotFoundException('Empleado no encontrado');
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

        const existingDraft = await tx.liquidation.findFirst({
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

        const existingRetirementEvent = await tx.payrollPilaEvent.findFirst({
          where: {
            tenantId,
            employeeId: empleadoId,
            codigo: 'RET',
          },
          select: { id: true },
        });
        if (existingRetirementEvent) {
          throw new ConflictException(
            'Ya existe una novedad RET para este empleado. Retire o corrija esa novedad antes de crear la liquidación laboral.',
          );
        }

        const diasSalarioPendiente = await this.resolveDiasSalarioPendiente(
          tenantId,
          empleadoId,
          emp.fechaIngreso,
          emp.fechaRetiro,
          tx,
        );
        const { input, diasLiquidados } = buildLiquidationInput(
          emp,
          emp.fechaRetiro,
          diasSalarioPendiente,
        );
        const result = calculate(input);
        const liquidation = await tx.liquidation.create({
          data: buildLiquidationCreateData(
            tenantId,
            empleadoId,
            emp.fechaRetiro,
            diasLiquidados,
            result,
          ),
          include: { concepts: true },
        });
        await this.audit.log(
          {
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
          },
          tx,
        );
        return liquidation;
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
  }

  /**
   * Resuelve los días de salario pendiente del mes de retiro (política N2D.4).
   *
   * Regla actualmente implementada (la evidencia de pago queda pendiente):
   *  1. Buscar el PayrollPeriod que contiene fechaRetiro (último día trabajado).
   *  2. Si existe un PayrollRun del empleado en ese período y su estado está en
   *     PERIODOS_PROCESADOS → 0 días. Es un proxy histórico de salario cubierto,
   *     no una comprobación de pago ni de transferencia.
   *  3. En caso contrario → días comerciales (30/360) trabajados dentro del
   *     período de retiro.
   *
   * No se analizan períodos anteriores ni se reconcilian históricos. Si no
   * existe un período que contenga fechaRetiro, la ventana del salario pendiente
   * es el mes calendario de fechaRetiro; se acota desde fechaIngreso y se cuentan
   * los días comerciales hasta el retiro inclusive. Si el intervalo no contiene
   * días trabajados, se retorna 0 y no se emite el concepto.
   *
   * @param fechaRetiro - Último día trabajado (inclusivo) leído de la BD.
   */
  private async resolveDiasSalarioPendiente(
    tenantId: string,
    empleadoId: string,
    fechaIngreso: Date,
    fechaRetiro: Date,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    // 1. Período que contiene fechaRetiro.
    const periodo = await db.payrollPeriod.findFirst({
      where: {
        tenantId,
        fechaInicio: { lte: fechaRetiro },
        fechaFin: { gte: fechaRetiro },
      },
      orderBy: { fechaInicio: 'desc' },
      select: { id: true, status: true, fechaInicio: true },
    });

    // Sin período → usa el mes calendario de fechaRetiro como ventana.
    if (!periodo) {
      const inicioMes = new Date(
        Date.UTC(fechaRetiro.getUTCFullYear(), fechaRetiro.getUTCMonth(), 1),
      );
      const desde = inicioMes > fechaIngreso ? inicioMes : fechaIngreso;
      const dias = diasComerciales(desde, addDays(fechaRetiro, 1));
      return dias > 0 ? dias : 0;
    }

    // 2. The existing rule treats a processed period as covering these days;
    //    it does not verify disbursement. A run in an unprocessed period must
    //    be completed or removed before the liquidation can include the days.
    const run = await db.payrollRun.findFirst({
      where: {
        tenantId,
        employeeId: empleadoId,
        payrollPeriodId: periodo.id,
      },
      select: { id: true },
    });
    if (run) {
      if (PERIODOS_PROCESADOS.includes(periodo.status)) {
        return 0;
      }
      throw new ConflictException(
        'Ya existe una ejecución de nómina sin aprobar en el período de retiro. Apruébela o elimínela antes de generar la liquidación.',
      );
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

    const [data, total] = await this.tenantPrisma.execute((tx) =>
      Promise.all([
        tx.liquidation.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        tx.liquidation.count({ where }),
      ]),
    );

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
    const liquidation = await this.tenantPrisma.execute((tx) =>
      tx.liquidation.findFirst({
        where: { id, tenantId },
        include: { concepts: true },
      }),
    );

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
    // This ADMIN action records a declaration. It is not backed by bank
    // confirmation or payment evidence in the current data model.
    return this.transition(
      tenantId,
      userId,
      liquidationId,
      'PAID',
      'LIQUIDATION_PAID',
      {
        paymentEvidence: 'MANUAL_DECLARATION',
        disbursementVerification: 'NOT_VERIFIED',
      },
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
    auditMetadata: Record<string, unknown> = {},
  ) {
    return this.tenantPrisma.execute(async (tx) => {
      const liq = await tx.liquidation.findFirst({
        where: { id: liquidationId, tenantId },
        select: { id: true, status: true, empleadoId: true },
      });

      if (!liq) {
        throw new NotFoundException('Liquidación no encontrada');
      }

      this.assertTransition(liq.status, target);

      const { count } = await tx.liquidation.updateMany({
        where: { id: liquidationId, tenantId, status: liq.status },
        data: { status: target },
      });

      if (count === 0) {
        throw new ConflictException(
          'La liquidación cambió de estado de forma concurrente. ' +
            'Recargue e intente de nuevo.',
        );
      }

      const liquidation = await tx.liquidation.findFirst({
        where: { id: liquidationId, tenantId },
        include: { concepts: true },
      });
      if (!liquidation) {
        throw new NotFoundException('Liquidación no encontrada');
      }
      await this.audit.log(
        {
          tenantId,
          userId,
          action: auditAction,
          entityType: 'Liquidation',
          entityId: liquidationId,
          metadata: { empleadoId: liq.empleadoId, ...auditMetadata },
        },
        tx,
      );
      return liquidation;
    });
  }
}
