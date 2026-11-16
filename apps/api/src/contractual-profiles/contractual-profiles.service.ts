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
import { AssignContractualProfileDto } from './dto/assign-contractual-profile.dto';
import { ContractualProfileQueryDto } from './dto/contractual-profile-query.dto';
import { CreateContractualProfileDto } from './dto/create-contractual-profile.dto';
import { UpdateContractualProfileStatusDto } from './dto/update-contractual-profile-status.dto';
import { UpdateContractualProfileDto } from './dto/update-contractual-profile.dto';

@Injectable()
export class ContractualProfilesService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(userId: string, dto: CreateContractualProfileDto) {
    return this.tenantPrisma.execute(async (prisma, context) => {
      const existing = await prisma.perfilContractual.findFirst({
        where: { tenantId: context.tenantId, codigo: dto.codigo },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException(
          'Ya existe un perfil contractual con este código.',
        );
      }

      const profile = await prisma.perfilContractual.create({
        data: { ...dto, tenantId: context.tenantId },
      });
      await this.auditService.log(
        {
          tenantId: context.tenantId,
          userId,
          action: 'CONTRACTUAL_PROFILE_CREATE',
          entityType: 'PerfilContractual',
          entityId: profile.id,
          metadata: { codigo: profile.codigo },
        },
        prisma,
      );
      return profile;
    });
  }

  async findAll(query: ContractualProfileQueryDto) {
    return this.tenantPrisma.execute((prisma, context) =>
      prisma.perfilContractual.findMany({
        where: {
          tenantId: context.tenantId,
          ...(query.activo !== undefined && { activo: query.activo }),
          ...(query.search && {
            OR: [
              { codigo: { contains: query.search, mode: 'insensitive' } },
              { nombre: { contains: query.search, mode: 'insensitive' } },
            ],
          }),
        },
        orderBy: { nombre: 'asc' },
      }),
    );
  }

  async findOne(id: string) {
    return this.tenantPrisma.execute((prisma, context) =>
      this.findOneInTenant(prisma, context.tenantId, id),
    );
  }

  async update(userId: string, id: string, dto: UpdateContractualProfileDto) {
    return this.tenantPrisma.execute(async (prisma, context) => {
      await this.findOneInTenant(prisma, context.tenantId, id);
      const profile = await prisma.perfilContractual.update({
        where: { id },
        data: dto,
      });
      await this.auditService.log(
        {
          tenantId: context.tenantId,
          userId,
          action: 'CONTRACTUAL_PROFILE_UPDATE',
          entityType: 'PerfilContractual',
          entityId: id,
          metadata: { fields: Object.keys(dto) },
        },
        prisma,
      );
      return profile;
    });
  }

  async updateStatus(
    userId: string,
    id: string,
    dto: UpdateContractualProfileStatusDto,
  ) {
    return this.tenantPrisma.execute(async (prisma, context) => {
      const current = await this.findOneInTenant(prisma, context.tenantId, id);
      const profile = await prisma.perfilContractual.update({
        where: { id },
        data: { activo: dto.activo },
      });
      await this.auditService.log(
        {
          tenantId: context.tenantId,
          userId,
          action: 'CONTRACTUAL_PROFILE_STATUS_CHANGE',
          entityType: 'PerfilContractual',
          entityId: id,
          metadata: { previousActive: current.activo, active: profile.activo },
        },
        prisma,
      );
      return profile;
    });
  }

  async assignToContract(
    userId: string,
    contractId: string,
    dto: AssignContractualProfileDto,
  ) {
    return this.tenantPrisma.execute(async (prisma, context) => {
      const profile = await prisma.perfilContractual.findFirst({
        where: {
          id: dto.perfilContractualId,
          tenantId: context.tenantId,
          activo: true,
        },
        select: { id: true },
      });
      if (!profile) {
        throw new BadRequestException(
          'El perfil contractual no existe, no pertenece a la empresa o está inactivo.',
        );
      }

      const contract = await prisma.contrato.findFirst({
        where: { id: contractId, tenantId: context.tenantId },
        select: { id: true, perfilContractualId: true },
      });
      if (!contract) throw new NotFoundException('Contrato no encontrado');

      const updated = await prisma.contrato.update({
        where: { id: contract.id },
        data: { perfilContractualId: profile.id },
      });
      await this.auditService.log(
        {
          tenantId: context.tenantId,
          userId,
          action: 'CONTRACTUAL_PROFILE_ASSIGN',
          entityType: 'PerfilContractual',
          entityId: updated.id,
          metadata: { perfilContractualId: dto.perfilContractualId },
        },
        prisma,
      );
      return updated;
    });
  }

  private async findOneInTenant(
    prisma: TenantPrismaClient,
    tenantId: string,
    id: string,
  ) {
    const profile = await prisma.perfilContractual.findFirst({
      where: { id, tenantId },
    });
    if (!profile)
      throw new NotFoundException('Perfil contractual no encontrado');
    return profile;
  }
}
