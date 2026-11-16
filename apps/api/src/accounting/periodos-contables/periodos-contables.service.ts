import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../../tenant-prisma/tenant-prisma.service';
import { CreatePeriodoContableDto } from './dto/create-periodo-contable.dto';
import { GenerarAnioDto } from './dto/generar-anio.dto';
import { PeriodoContableQueryDto } from './dto/periodo-contable-query.dto';

// Límites del mes en UTC para evitar corrimientos de zona horaria en @db.Date.
function rangoMes(anio: number, mes: number) {
  const fechaInicio = new Date(Date.UTC(anio, mes - 1, 1));
  const fechaFin = new Date(Date.UTC(anio, mes, 0)); // día 0 del mes siguiente = último día
  return { fechaInicio, fechaFin };
}

@Injectable()
export class PeriodosContablesService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    dto: CreatePeriodoContableDto,
  ) {
    const periodo = await this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      await this.ensureNoExiste(tx, tenantId, dto.anio, dto.mes);
      const { fechaInicio, fechaFin } = rangoMes(dto.anio, dto.mes);

      const periodo = await tx.periodoContable.create({
        data: { tenantId, anio: dto.anio, mes: dto.mes, fechaInicio, fechaFin },
      });
      await this.audit.log(
        {
          tenantId,
          userId,
          action: 'PERIODO_CONTABLE_CREATE',
          entityType: 'PeriodoContable',
          entityId: periodo.id,
          metadata: { anio: periodo.anio, mes: periodo.mes },
        },
        tx,
      );
      return periodo;
    });
    return periodo;
  }

  /**
   * Crea los 12 meses de un año. Idempotente: omite los que ya existen.
   */
  async generarAnio(tenantId: string, userId: string, dto: GenerarAnioDto) {
    const result = await this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      const existentes = await tx.periodoContable.findMany({
        where: { tenantId, anio: dto.anio },
        select: { mes: true },
      });
      const yaCreados = new Set(existentes.map((periodo) => periodo.mes));

      const faltantes = [];
      for (let mes = 1; mes <= 12; mes += 1) {
        if (yaCreados.has(mes)) continue;
        const { fechaInicio, fechaFin } = rangoMes(dto.anio, mes);
        faltantes.push({
          tenantId,
          anio: dto.anio,
          mes,
          fechaInicio,
          fechaFin,
        });
      }

      if (faltantes.length > 0) {
        await tx.periodoContable.createMany({ data: faltantes });
      }

      const periodos = await tx.periodoContable.findMany({
        where: { tenantId, anio: dto.anio },
        orderBy: { mes: 'asc' },
      });
      if (faltantes.length > 0) {
        await this.audit.log(
          {
            tenantId,
            userId,
            action: 'PERIODO_CONTABLE_GENERAR_ANIO',
            entityType: 'PeriodoContable',
            metadata: { anio: dto.anio, creados: faltantes.length },
          },
          tx,
        );
      }
      return { periodos, creados: faltantes.length };
    });
    return result.periodos;
  }

  async findAll(tenantId: string, query: PeriodoContableQueryDto) {
    const where: Prisma.PeriodoContableWhereInput = {
      tenantId,
      ...(query.anio !== undefined && { anio: query.anio }),
      ...(query.estado && { estado: query.estado }),
    };

    return this.tenantPrisma.execute((tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      return tx.periodoContable.findMany({
        where,
        orderBy: [{ anio: 'desc' }, { mes: 'asc' }],
      });
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      const periodo = await tx.periodoContable.findFirst({
        where: { id, tenantId },
      });
      if (!periodo)
        throw new NotFoundException('Período contable no encontrado');
      return periodo;
    });
  }

  private assertTenantContext(
    requestTenantId: string,
    contextTenantId: string,
  ) {
    if (requestTenantId !== contextTenantId) {
      throw new ForbiddenException('El contexto de tenant no coincide.');
    }
  }

  private async ensureNoExiste(
    tx: TenantPrismaClient,
    tenantId: string,
    anio: number,
    mes: number,
  ) {
    const existing = await tx.periodoContable.findFirst({
      where: { tenantId, anio, mes },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `El período ${anio}-${String(mes).padStart(2, '0')} ya existe`,
      );
    }
  }
}
