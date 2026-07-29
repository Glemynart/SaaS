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
    const { profile, tenantId } = await this.tenantPrisma.execute(
      async (prisma, context) => {
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
        return { profile, tenantId: context.tenantId };
      },
    );

    this.log(userId, tenantId, 'CONTRACTUAL_PROFILE_CREATE', profile.id, {
      codigo: profile.codigo,
    });
    return profile;
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
    const { profile, tenantId } = await this.tenantPrisma.execute(
      async (prisma, context) => {
        await this.findOneInTenant(prisma, context.tenantId, id);
        const profile = await prisma.perfilContractual.update({
          where: { id },
          data: dto,
        });
        return { profile, tenantId: context.tenantId };
      },
    );

    this.log(userId, tenantId, 'CONTRACTUAL_PROFILE_UPDATE', id, {
      fields: Object.keys(dto),
    });
    return profile;
  }

  async updateStatus(
    userId: string,
    id: string,
    dto: UpdateContractualProfileStatusDto,
  ) {
    const { profile, tenantId, previousActive } =
      await this.tenantPrisma.execute(async (prisma, context) => {
        const current = await this.findOneInTenant(
          prisma,
          context.tenantId,
          id,
        );
        const profile = await prisma.perfilContractual.update({
          where: { id },
          data: { activo: dto.activo },
        });
        return {
          profile,
          tenantId: context.tenantId,
          previousActive: current.activo,
        };
      });

    this.log(userId, tenantId, 'CONTRACTUAL_PROFILE_STATUS_CHANGE', id, {
      previousActive,
      active: profile.activo,
    });
    return profile;
  }

  async assignToContract(
    userId: string,
    contractId: string,
    dto: AssignContractualProfileDto,
  ) {
    const { contract, tenantId } = await this.tenantPrisma.execute(
      async (prisma, context) => {
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
        return { contract: updated, tenantId: context.tenantId };
      },
    );

    this.log(userId, tenantId, 'CONTRACTUAL_PROFILE_ASSIGN', contract.id, {
      perfilContractualId: dto.perfilContractualId,
    });
    return contract;
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
        entityType: 'PerfilContractual',
        entityId,
        metadata,
      })
      .catch(() => {});
  }
}
