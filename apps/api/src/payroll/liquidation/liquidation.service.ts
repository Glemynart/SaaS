import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { calculate } from './liquidation-calculator';
import {
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

    // ── 3. Construir input (mapper adapta semántica inclusivo → exclusivo) ───
    const { input, diasLiquidados } = buildLiquidationInput(
      emp,
      emp.fechaRetiro,
    );

    // ── 4. Calcular ──────────────────────────────────────────────────────────
    const result = calculate(input);

    // ── 5. Persistir en transacción ──────────────────────────────────────────
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

    // ── 6. Auditoría ─────────────────────────────────────────────────────────
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
}
