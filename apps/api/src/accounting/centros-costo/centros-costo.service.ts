import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../../tenant-prisma/tenant-prisma.service';
import { CreateCentroCostoDto } from './dto/create-centro-costo.dto';
import { UpdateCentroCostoDto } from './dto/update-centro-costo.dto';
import { CentroCostoQueryDto } from './dto/centro-costo-query.dto';

@Injectable()
export class CentrosCostoService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateCentroCostoDto) {
    const centro = await this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      await this.ensureCodigoDisponible(tx, tenantId, dto.codigo);
      await this.ensureSede(tx, tenantId, dto.sedeId);

      return tx.centroCosto.create({
        data: {
          tenantId,
          codigo: dto.codigo,
          nombre: dto.nombre,
          sedeId: dto.sedeId,
          ...(dto.activo !== undefined && { activo: dto.activo }),
        },
      });
    });

    this.audit
      .log({
        tenantId,
        userId,
        action: 'CENTRO_COSTO_CREATE',
        entityType: 'CentroCosto',
        entityId: centro.id,
        metadata: { codigo: centro.codigo },
      })
      .catch(() => {});

    return centro;
  }

  async findAll(tenantId: string, query: CentroCostoQueryDto) {
    return this.tenantPrisma.execute((tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      const where: Prisma.CentroCostoWhereInput = {
        tenantId,
        ...(query.includeDeleted ? {} : { deletedAt: null }),
        ...(query.activo !== undefined && { activo: query.activo }),
      };

      if (query.search) {
        where.OR = [
          { codigo: { contains: query.search, mode: 'insensitive' } },
          { nombre: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      return tx.centroCosto.findMany({
        where,
        orderBy: { codigo: 'asc' },
      });
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      const centro = await tx.centroCosto.findFirst({
        where: { id, tenantId },
      });
      if (!centro) throw new NotFoundException('Centro de costo no encontrado');
      return centro;
    });
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateCentroCostoDto,
  ) {
    const updated = await this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      const current = await tx.centroCosto.findFirst({
        where: { id, tenantId },
      });
      if (!current)
        throw new NotFoundException('Centro de costo no encontrado');
      if (dto.sedeId !== undefined)
        await this.ensureSede(tx, tenantId, dto.sedeId);

      return tx.centroCosto.update({
        where: { id: current.id },
        data: {
          ...(dto.nombre !== undefined && { nombre: dto.nombre }),
          ...(dto.sedeId !== undefined && { sedeId: dto.sedeId }),
          ...(dto.activo !== undefined && { activo: dto.activo }),
        },
      });
    });

    this.audit
      .log({
        tenantId,
        userId,
        action: 'CENTRO_COSTO_UPDATE',
        entityType: 'CentroCosto',
        entityId: updated.id,
      })
      .catch(() => {});

    return updated;
  }

  async remove(tenantId: string, userId: string, id: string) {
    const result = await this.tenantPrisma.execute(async (tx, context) => {
      this.assertTenantContext(tenantId, context.tenantId);
      const centro = await tx.centroCosto.findFirst({
        where: { id, tenantId },
      });
      if (!centro) throw new NotFoundException('Centro de costo no encontrado');
      if (centro.deletedAt) return { centro, changed: false };

      return {
        centro: await tx.centroCosto.update({
          where: { id: centro.id },
          data: { deletedAt: new Date(), activo: false },
        }),
        changed: true,
      };
    });

    if (result.changed) {
      this.audit
        .log({
          tenantId,
          userId,
          action: 'CENTRO_COSTO_DELETE',
          entityType: 'CentroCosto',
          entityId: result.centro.id,
        })
        .catch(() => {});
    }

    return result.centro;
  }

  private assertTenantContext(
    requestTenantId: string,
    contextTenantId: string,
  ) {
    if (requestTenantId !== contextTenantId) {
      throw new ForbiddenException('El contexto de tenant no coincide.');
    }
  }

  private async ensureCodigoDisponible(
    tx: TenantPrismaClient,
    tenantId: string,
    codigo: string,
  ) {
    const existing = await tx.centroCosto.findFirst({
      where: { tenantId, codigo },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un centro de costo con el código ${codigo}`,
      );
    }
  }

  private async ensureSede(
    tx: TenantPrismaClient,
    tenantId: string,
    sedeId?: string,
  ) {
    if (!sedeId) return;
    const sede = await tx.sede.findFirst({
      where: { id: sedeId, tenantId },
      select: { id: true },
    });
    if (!sede)
      throw new BadRequestException('Sede no encontrada en este tenant');
  }
}
