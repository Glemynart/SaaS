import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateCentroCostoDto } from './dto/create-centro-costo.dto';
import { UpdateCentroCostoDto } from './dto/update-centro-costo.dto';
import { CentroCostoQueryDto } from './dto/centro-costo-query.dto';

@Injectable()
export class CentrosCostoService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateCentroCostoDto) {
    await this.ensureCodigoDisponible(tenantId, dto.codigo);
    await this.ensureSede(tenantId, dto.sedeId);

    const centro = await this.prisma.centroCosto.create({
      data: {
        tenantId,
        codigo: dto.codigo,
        nombre: dto.nombre,
        sedeId: dto.sedeId,
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
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

    return this.prisma.centroCosto.findMany({
      where,
      orderBy: { codigo: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const centro = await this.prisma.centroCosto.findFirst({
      where: { id, tenantId },
    });
    if (!centro) throw new NotFoundException('Centro de costo no encontrado');
    return centro;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateCentroCostoDto,
  ) {
    const current = await this.findOne(tenantId, id);
    if (dto.sedeId !== undefined) await this.ensureSede(tenantId, dto.sedeId);

    const updated = await this.prisma.centroCosto.update({
      where: { id: current.id },
      data: {
        ...(dto.nombre !== undefined && { nombre: dto.nombre }),
        ...(dto.sedeId !== undefined && { sedeId: dto.sedeId }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
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
    const centro = await this.findOne(tenantId, id);
    if (centro.deletedAt) return centro; // idempotente

    const eliminado = await this.prisma.centroCosto.update({
      where: { id: centro.id },
      data: { deletedAt: new Date(), activo: false },
    });

    this.audit
      .log({
        tenantId,
        userId,
        action: 'CENTRO_COSTO_DELETE',
        entityType: 'CentroCosto',
        entityId: eliminado.id,
      })
      .catch(() => {});

    return eliminado;
  }

  private async ensureCodigoDisponible(tenantId: string, codigo: string) {
    const existing = await this.prisma.centroCosto.findFirst({
      where: { tenantId, codigo },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un centro de costo con el código ${codigo}`,
      );
    }
  }

  private async ensureSede(tenantId: string, sedeId?: string) {
    if (!sedeId) return;
    const sede = await this.prisma.sede.findFirst({
      where: { id: sedeId, tenantId },
      select: { id: true },
    });
    if (!sede)
      throw new BadRequestException('Sede no encontrada en este tenant');
  }
}
