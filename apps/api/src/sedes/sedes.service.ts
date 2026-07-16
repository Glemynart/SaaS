import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { SedeQueryDto } from './dto/sede-query.dto';
import { Prisma } from '@prisma/client';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';

const municipioSelect = {
  select: { id: true, nombre: true, departamento: true },
} as const;

@Injectable()
export class SedesService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(userId: string, dto: CreateSedeDto) {
    const { sede, tenantId } = await this.tenantPrisma.execute(
      async (prisma, context) => {
        const tenantId = context.tenantId;
        await this.ensureMunicipioExists(prisma, dto.municipioId);

        const willBeActive = dto.activo ?? true;
        if (willBeActive) {
          await this.ensureNombreDisponible(prisma, tenantId, dto.nombre);
        }

        const sede = await prisma.sede.create({
          data: {
            tenantId,
            nombre: dto.nombre,
            direccion: dto.direccion,
            municipioId: dto.municipioId,
            ...(dto.activo !== undefined && { activo: dto.activo }),
          },
          include: { municipio: municipioSelect },
        });

        return { sede, tenantId };
      },
    );

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
    return this.tenantPrisma.execute(async (prisma, context) => {
      const where: Prisma.SedeWhereInput = {
        tenantId: context.tenantId,
        ...(query.activo !== undefined && { activo: query.activo }),
      };

      if (query.search) {
        where.nombre = { contains: query.search, mode: 'insensitive' };
      }

      return prisma.sede.findMany({
        where,
        orderBy: { nombre: 'asc' },
        include: { municipio: municipioSelect },
      });
    });
  }

  async findOne(id: string) {
    return this.tenantPrisma.execute((prisma, context) =>
      this.findOneInTenant(prisma, context.tenantId, id),
    );
  }

  async update(id: string, dto: UpdateSedeDto) {
    return this.tenantPrisma.execute(async (prisma, context) => {
      const tenantId = context.tenantId;
      const current = await this.findOneInTenant(prisma, tenantId, id);

      if (dto.municipioId) {
        await this.ensureMunicipioExists(prisma, dto.municipioId);
      }

      const nextNombre = dto.nombre ?? current.nombre;
      const nextActivo = dto.activo ?? current.activo;
      if (
        nextActivo &&
        (dto.nombre !== undefined || dto.activo !== undefined)
      ) {
        await this.ensureNombreDisponible(prisma, tenantId, nextNombre, id);
      }

      return prisma.sede.update({
        where: { id, tenantId },
        data: {
          ...(dto.nombre !== undefined && { nombre: dto.nombre }),
          ...(dto.direccion !== undefined && { direccion: dto.direccion }),
          ...(dto.municipioId !== undefined && {
            municipioId: dto.municipioId,
          }),
          ...(dto.activo !== undefined && { activo: dto.activo }),
        },
        include: { municipio: municipioSelect },
      });
    });
  }

  private async findOneInTenant(
    prisma: TenantPrismaClient,
    tenantId: string,
    id: string,
  ) {
    const sede = await prisma.sede.findFirst({
      where: { id, tenantId },
      include: { municipio: municipioSelect },
    });

    if (!sede) {
      throw new NotFoundException('Sede no encontrada');
    }

    return sede;
  }

  private async ensureMunicipioExists(
    prisma: TenantPrismaClient,
    municipioId: string,
  ) {
    const municipio = await prisma.municipioDane.findUnique({
      where: { id: municipioId },
    });
    if (!municipio) {
      throw new BadRequestException('Municipio no encontrado');
    }
  }

  private async ensureNombreDisponible(
    prisma: TenantPrismaClient,
    tenantId: string,
    nombre: string,
    excludeId?: string,
  ) {
    const existing = await prisma.sede.findFirst({
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
