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
import { CreateDocumentProfileConfigurationDto } from './dto/create-document-profile-configuration.dto';
import { UpdateDocumentProfileConfigurationDto } from './dto/update-document-profile-configuration.dto';

@Injectable()
export class DocumentProfileConfigurationsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(userId: string, dto: CreateDocumentProfileConfigurationDto) {
    this.validateDates(dto.vigenteDesde, dto.vigenteHasta);
    const { configuration, tenantId } = await this.tenantPrisma.execute(
      async (prisma, context) => {
        await this.ensureActiveProfile(
          prisma,
          context.tenantId,
          dto.perfilContractualId,
        );
        await this.ensureCompatibleTemplate(
          prisma,
          context.tenantId,
          dto.plantillaId,
          dto.tipoDocumental,
        );
        await this.ensureNoOverlappingConfiguration(
          prisma,
          context.tenantId,
          dto.perfilContractualId,
          dto.tipoDocumental,
          dto.vigenteDesde,
          dto.vigenteHasta,
          dto.activo ?? true,
        );
        const configuration = await prisma.configuracionDocumentalPerfil.create(
          {
            data: {
              tenantId: context.tenantId,
              perfilContractualId: dto.perfilContractualId,
              tipoDocumental: dto.tipoDocumental,
              plantillaId: dto.plantillaId,
              vigenteDesde: new Date(dto.vigenteDesde),
              ...(dto.vigenteHasta && {
                vigenteHasta: new Date(dto.vigenteHasta),
              }),
              activo: dto.activo ?? true,
            },
            include: { perfilContractual: true, plantilla: true },
          },
        );
        return { configuration, tenantId: context.tenantId };
      },
    );
    this.log(
      userId,
      tenantId,
      'DOCUMENT_PROFILE_CONFIGURATION_CREATE',
      configuration.id,
      {
        perfilContractualId: configuration.perfilContractualId,
        plantillaId: configuration.plantillaId,
        tipoDocumental: configuration.tipoDocumental,
      },
    );
    return configuration;
  }

  async findAll() {
    return this.tenantPrisma.execute((prisma, context) =>
      prisma.configuracionDocumentalPerfil.findMany({
        where: { tenantId: context.tenantId },
        include: { perfilContractual: true, plantilla: true },
        orderBy: [
          { perfilContractualId: 'asc' },
          { tipoDocumental: 'asc' },
          { vigenteDesde: 'desc' },
        ],
      }),
    );
  }

  async findOne(id: string) {
    return this.tenantPrisma.execute((prisma, context) =>
      this.findOneInTenant(prisma, context.tenantId, id),
    );
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateDocumentProfileConfigurationDto,
  ) {
    const { configuration, tenantId } = await this.tenantPrisma.execute(
      async (prisma, context) => {
        const current = await this.findOneInTenant(
          prisma,
          context.tenantId,
          id,
        );
        const vigenteDesde = dto.vigenteDesde ?? current.vigenteDesde;
        const vigenteHasta = dto.vigenteHasta ?? current.vigenteHasta;
        this.validateDates(vigenteDesde, vigenteHasta);
        if (dto.plantillaId)
          await this.ensureCompatibleTemplate(
            prisma,
            context.tenantId,
            dto.plantillaId,
            current.tipoDocumental,
          );
        await this.ensureNoOverlappingConfiguration(
          prisma,
          context.tenantId,
          current.perfilContractualId,
          current.tipoDocumental,
          vigenteDesde,
          vigenteHasta,
          dto.activo ?? current.activo,
          id,
        );
        const configuration = await prisma.configuracionDocumentalPerfil.update(
          {
            where: { id },
            data: {
              ...(dto.plantillaId && { plantillaId: dto.plantillaId }),
              ...(dto.vigenteDesde && {
                vigenteDesde: new Date(dto.vigenteDesde),
              }),
              ...(dto.vigenteHasta && {
                vigenteHasta: new Date(dto.vigenteHasta),
              }),
              ...(dto.activo !== undefined && { activo: dto.activo }),
            },
            include: { perfilContractual: true, plantilla: true },
          },
        );
        return { configuration, tenantId: context.tenantId };
      },
    );
    this.log(userId, tenantId, 'DOCUMENT_PROFILE_CONFIGURATION_UPDATE', id, {
      fields: Object.keys(dto),
    });
    return configuration;
  }

  private async findOneInTenant(
    prisma: TenantPrismaClient,
    tenantId: string,
    id: string,
  ) {
    const configuration = await prisma.configuracionDocumentalPerfil.findFirst({
      where: { id, tenantId },
      include: { perfilContractual: true, plantilla: true },
    });
    if (!configuration)
      throw new NotFoundException('Configuración documental no encontrada');
    return configuration;
  }

  private async ensureActiveProfile(
    prisma: TenantPrismaClient,
    tenantId: string,
    profileId: string,
  ) {
    const profile = await prisma.perfilContractual.findFirst({
      where: { id: profileId, tenantId, activo: true },
      select: { id: true },
    });
    if (!profile)
      throw new BadRequestException(
        'El perfil contractual no existe, no pertenece a la empresa o está inactivo.',
      );
  }

  private async ensureCompatibleTemplate(
    prisma: TenantPrismaClient,
    tenantId: string,
    templateId: string,
    tipoDocumental: string,
  ) {
    const template = await prisma.documentTemplate.findFirst({
      where: {
        id: templateId,
        tenantId,
        activo: true,
        deletedAt: null,
        tipo: tipoDocumental as never,
      },
      select: { id: true },
    });
    if (!template)
      throw new BadRequestException(
        'La plantilla no existe, no pertenece a la empresa, está inactiva o no corresponde al tipo documental.',
      );
  }

  private async ensureNoOverlappingConfiguration(
    prisma: TenantPrismaClient,
    tenantId: string,
    profileId: string,
    tipoDocumental: string,
    desde: string | Date,
    hasta: string | Date | null | undefined,
    activo: boolean,
    excludeId?: string,
  ) {
    if (!activo) return;
    const configuration = await prisma.configuracionDocumentalPerfil.findFirst({
      where: {
        tenantId,
        perfilContractualId: profileId,
        tipoDocumental: tipoDocumental as never,
        activo: true,
        ...(excludeId && { id: { not: excludeId } }),
        vigenteDesde: { lte: hasta ? new Date(hasta) : new Date('9999-12-31') },
        OR: [
          { vigenteHasta: null },
          { vigenteHasta: { gte: new Date(desde) } },
        ],
      },
      select: { id: true },
    });
    if (configuration)
      throw new BadRequestException(
        'Ya existe una configuración documental vigente para este perfil y tipo documental.',
      );
  }

  private validateDates(desde: string | Date, hasta?: string | Date | null) {
    if (hasta && new Date(hasta) < new Date(desde))
      throw new BadRequestException(
        'La vigencia final no puede ser anterior a la vigencia inicial.',
      );
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
        entityType: 'ConfiguracionDocumentalPerfil',
        entityId,
        metadata,
      })
      .catch(() => {});
  }
}
