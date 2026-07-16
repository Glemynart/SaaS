import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { SedeQueryDto } from './dto/sede-query.dto';
import { Prisma } from '@prisma/client';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';

const municipioSelect = {
  select: { id: true, nombre: true, departamento: true },
} as const;

@Injectable()
export class SedesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private tenantContext: TenantContextBoundary,
  ) {}

  async create(userId: string, dto: CreateSedeDto) {
    const tenantId = this.tenantContext.require().tenantId;
    await this.ensureMunicipioExists(dto.municipioId);

    const willBeActive = dto.activo ?? true;
    if (willBeActive) {
      await this.ensureNombreDisponible(tenantId, dto.nombre);
    }

    const sede = await this.prisma.sede.create({
      data: {
        tenantId,
        nombre: dto.nombre,
        direccion: dto.direccion,
        municipioId: dto.municipioId,
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
      include: { municipio: municipioSelect },
    });

    this.auditService
      .log({
        tenantId,
        userId,
        action: 'SEDE_CREATE',
        entityType: 'Sede',
        entityId: sede.id,
        metadata: { nombre: sede.nombre },
      })
      .catch(() => {});

    return sede;
  }

  async findAll(query: SedeQueryDto) {
    const tenantId = this.tenantContext.require().tenantId;
    const where: Prisma.SedeWhereInput = {
      tenantId,
      ...(query.activo !== undefined && { activo: query.activo }),
    };

    if (query.search) {
      where.nombre = { contains: query.search, mode: 'insensitive' };
    }

    return this.prisma.sede.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: { municipio: municipioSelect },
    });
  }

  async findOne(id: string) {
    const tenantId = this.tenantContext.require().tenantId;
    const sede = await this.prisma.sede.findFirst({
      where: { id, tenantId },
      include: { municipio: municipioSelect },
    });

    if (!sede) {
      throw new NotFoundException('Sede no encontrada');
    }

    return sede;
  }

  async update(id: string, dto: UpdateSedeDto) {
    const tenantId = this.tenantContext.require().tenantId;
    const current = await this.findOne(id);

    if (dto.municipioId) {
      await this.ensureMunicipioExists(dto.municipioId);
    }

    const nextNombre = dto.nombre ?? current.nombre;
    const nextActivo = dto.activo ?? current.activo;
    if (nextActivo && (dto.nombre !== undefined || dto.activo !== undefined)) {
      await this.ensureNombreDisponible(tenantId, nextNombre, id);
    }

    return this.prisma.sede.update({
      where: { id, tenantId },
      data: {
        ...(dto.nombre !== undefined && { nombre: dto.nombre }),
        ...(dto.direccion !== undefined && { direccion: dto.direccion }),
        ...(dto.municipioId !== undefined && { municipioId: dto.municipioId }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
      include: { municipio: municipioSelect },
    });
  }

  private async ensureMunicipioExists(municipioId: string) {
    const municipio = await this.prisma.municipioDane.findUnique({
      where: { id: municipioId },
    });
    if (!municipio) {
      throw new BadRequestException('Municipio no encontrado');
    }
  }

  private async ensureNombreDisponible(
    tenantId: string,
    nombre: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.sede.findFirst({
      where: {
        tenantId,
        activo: true,
        nombre: { equals: nombre, mode: 'insensitive' },
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Ya existe una sede activa con este nombre',
      );
    }
  }
}
