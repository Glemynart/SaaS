import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BatchDocumentGenerationPlanStatus, LoteEstado } from '@prisma/client';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';

/**
 * Puerta de entrada para la generación documental basada en planes ya
 * confirmados. PR8A solo prepara los planes; no materializa documentos ni
 * modifica su estado.
 */
@Injectable()
export class BatchDocumentGenerationService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async start(loteId: string) {
    return this.tenantPrisma.execute(async (prisma, context) => {
      const lote = await prisma.loteContrato.findFirst({
        where: { id: loteId, tenantId: context.tenantId },
        select: { estado: true },
      });
      if (!lote) throw new NotFoundException('Lote no encontrado');

      if (lote.estado !== LoteEstado.PENDIENTE) {
        throw new ConflictException(
          `El lote no puede iniciar generación en estado "${lote.estado}".`,
        );
      }

      const plans = await prisma.batchDocumentGenerationPlan.findMany({
        where: {
          tenantId: context.tenantId,
          loteId,
          estado: BatchDocumentGenerationPlanStatus.CONFIRMADO,
        },
        select: { id: true, estado: true },
      });
      if (plans.length === 0) {
        throw new BadRequestException(
          'El lote no tiene planes confirmados disponibles para generar.',
        );
      }

      return {
        loteId,
        total: plans.length,
        plans,
      };
    });
  }
}
