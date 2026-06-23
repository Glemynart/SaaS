import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { calculate, diasComerciales } from './liquidation-calculator';
import {
  addDays,
  buildLiquidationCreateData,
  buildLiquidationInput,
} from './liquidation-mapper';

@Injectable()
export class LiquidationService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

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
    const liquidation = await this.prisma.$transaction(async (tx) => {
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
   *  2. Si existe un PayrollRun del empleado en ese período y el período está
   *     CLOSED → 0 (el salario del mes ya se pagó; CLOSED es proxy temporal de
   *     PAID).
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

    // 2. ¿Existe un PayrollRun CLOSED del empleado para ese período?
    if (periodo.status === 'CLOSED') {
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
}
