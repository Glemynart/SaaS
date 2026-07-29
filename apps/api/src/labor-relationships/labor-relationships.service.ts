import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';
import { CreateLaborRelationshipDto } from './dto/create-labor-relationship.dto';
import { LaborRelationshipQueryDto } from './dto/labor-relationship-query.dto';
import { UpdateLaborRelationshipDto } from './dto/update-labor-relationship.dto';

@Injectable()
export class LaborRelationshipsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(userId: string, dto: CreateLaborRelationshipDto) {
    this.validateDates(dto.vigenteDesde, dto.vigenteHasta);
    const { relationship, tenantId } = await this.tenantPrisma.execute(
      async (prisma, context) => {
        await this.ensureEmployeeInTenant(
          prisma,
          context.tenantId,
          dto.empleadoId,
        );
        await this.ensureActiveProfileInTenant(
          prisma,
          context.tenantId,
          dto.perfilContractualId,
        );
        const activo = dto.activo ?? true;
        if (activo) {
          await this.ensureNoActiveRelationship(
            prisma,
            context.tenantId,
            dto.empleadoId,
          );
        }
        const relationship = await prisma.vinculoLaboral.create({
          data: {
            tenantId: context.tenantId,
            empleadoId: dto.empleadoId,
            perfilContractualId: dto.perfilContractualId,
            vigenteDesde: new Date(dto.vigenteDesde),
            ...(dto.vigenteHasta && {
              vigenteHasta: new Date(dto.vigenteHasta),
            }),
            activo,
          },
          include: { perfilContractual: true },
        });
        return { relationship, tenantId: context.tenantId };
      },
    );
    this.log(userId, tenantId, 'LABOR_RELATIONSHIP_CREATE', relationship.id, {
      empleadoId: relationship.empleadoId,
      perfilContractualId: relationship.perfilContractualId,
    });
    return relationship;
  }

  async findAll(query: LaborRelationshipQueryDto) {
    return this.tenantPrisma.execute((prisma, context) =>
      prisma.vinculoLaboral.findMany({
        where: {
          tenantId: context.tenantId,
          ...(query.empleadoId && { empleadoId: query.empleadoId }),
          ...(query.activo !== undefined && { activo: query.activo }),
        },
        include: { perfilContractual: true },
        orderBy: [{ empleadoId: 'asc' }, { vigenteDesde: 'desc' }],
      }),
    );
  }

  async findOne(id: string) {
    return this.tenantPrisma.execute((prisma, context) =>
      this.findOneInTenant(prisma, context.tenantId, id),
    );
  }

  // Punto de consulta para fases posteriores; no es usado por lotes ni contratos.
  async findCurrentByEmployee(employeeId: string, at = new Date()) {
    return this.tenantPrisma.execute((prisma, context) =>
      prisma.vinculoLaboral.findFirst({
        where: {
          tenantId: context.tenantId,
          empleadoId: employeeId,
          activo: true,
          vigenteDesde: { lte: at },
          OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: at } }],
        },
        include: { perfilContractual: true },
      }),
    );
  }

  async update(userId: string, id: string, dto: UpdateLaborRelationshipDto) {
    const { relationship, tenantId } = await this.tenantPrisma.execute(
      async (prisma, context) => {
        const current = await this.findOneInTenant(
          prisma,
          context.tenantId,
          id,
        );
        const vigenteDesde = dto.vigenteDesde ?? current.vigenteDesde;
        const vigenteHasta = dto.vigenteHasta ?? current.vigenteHasta;
        this.validateDates(vigenteDesde, vigenteHasta);
        if (dto.perfilContractualId) {
          await this.ensureActiveProfileInTenant(
            prisma,
            context.tenantId,
            dto.perfilContractualId,
          );
        }
        if (dto.activo ?? current.activo) {
          await this.ensureNoActiveRelationship(
            prisma,
            context.tenantId,
            current.empleadoId,
            id,
          );
        }
        const relationship = await prisma.vinculoLaboral.update({
          where: { id },
          data: {
            ...(dto.perfilContractualId && {
              perfilContractualId: dto.perfilContractualId,
            }),
            ...(dto.vigenteDesde && {
              vigenteDesde: new Date(dto.vigenteDesde),
            }),
            ...(dto.vigenteHasta && {
              vigenteHasta: new Date(dto.vigenteHasta),
            }),
            ...(dto.activo !== undefined && { activo: dto.activo }),
          },
          include: { perfilContractual: true },
        });
        return { relationship, tenantId: context.tenantId };
      },
    );
    this.log(userId, tenantId, 'LABOR_RELATIONSHIP_UPDATE', id, {
      fields: Object.keys(dto),
    });
    return relationship;
  }

  private async findOneInTenant(
    prisma: TenantPrismaClient,
    tenantId: string,
    id: string,
  ) {
    const relationship = await prisma.vinculoLaboral.findFirst({
      where: { id, tenantId },
      include: { perfilContractual: true },
    });
    if (!relationship)
      throw new NotFoundException('Vínculo laboral no encontrado');
    return relationship;
  }

  private async ensureEmployeeInTenant(
    prisma: TenantPrismaClient,
    tenantId: string,
    employeeId: string,
  ) {
    const employee = await prisma.empleado.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) {
      throw new BadRequestException(
        'El empleado no existe o no pertenece a la empresa activa.',
      );
    }
  }

  private async ensureActiveProfileInTenant(
    prisma: TenantPrismaClient,
    tenantId: string,
    profileId: string,
  ) {
    const profile = await prisma.perfilContractual.findFirst({
      where: { id: profileId, tenantId, activo: true },
      select: { id: true },
    });
    if (!profile) {
      throw new BadRequestException(
        'El perfil contractual no existe, no pertenece a la empresa o está inactivo.',
      );
    }
  }

  private async ensureNoActiveRelationship(
    prisma: TenantPrismaClient,
    tenantId: string,
    employeeId: string,
    excludeId?: string,
  ) {
    const relationship = await prisma.vinculoLaboral.findFirst({
      where: {
        tenantId,
        empleadoId: employeeId,
        activo: true,
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    if (relationship) {
      throw new BadRequestException(
        'El empleado ya tiene un vínculo laboral precontractual activo.',
      );
    }
  }

  private validateDates(
    vigenteDesde: string | Date,
    vigenteHasta?: string | Date | null,
  ) {
    if (vigenteHasta && new Date(vigenteHasta) < new Date(vigenteDesde)) {
      throw new BadRequestException(
        'La vigencia final no puede ser anterior a la vigencia inicial.',
      );
    }
  }

  private log(
    userId: string,
    tenantId: string,
    action: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    this.auditService
      .log({
        tenantId,
        userId,
        action,
        entityType: 'VinculoLaboral',
        entityId,
        metadata,
      })
      .catch(() => {});
  }
}
