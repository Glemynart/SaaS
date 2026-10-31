import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StorageObjectNotFoundError } from '../storage/storage.types';
import { UpdateTenantBrandingDto } from './dto/update-tenant-branding.dto';
import { UpdatePilaEmployerProfileDto } from './dto/update-pila-employer-profile.dto';
import { AuditService } from '../audit/audit.service';
import * as path from 'path';

const PILA_PROFILE_FIELDS = [
  'pilaTipoDocumentoAportante',
  'pilaNaturalezaJuridica',
  'pilaTipoPersona',
  'pilaFormaPresentacion',
  'pilaCodigoSucursal',
  'pilaNombreSucursal',
  'pilaCodigoActividadEconomica',
  'pilaCodigoArlAportante',
  'pilaTipoAportante',
  'pilaFax',
  'pilaRepresentanteTipoDocumento',
  'pilaRepresentanteNumeroDocumento',
  'pilaRepresentantePrimerApellido',
  'pilaRepresentanteSegundoApellido',
  'pilaRepresentantePrimerNombre',
  'pilaRepresentanteSegundoNombre',
  'pilaFechaMatriculaMercantil',
  'pilaBeneficioLey1429',
  'pilaBeneficioCcfLey1429',
  'pilaAportesExoneradosConfirmado',
  'pilaSinAccionEspecial',
] as const;

@Injectable()
export class TenantBrandingService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private audit: AuditService,
  ) {}

  async getBranding(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        razonSocial: true,
        nit: true,
        logoUrl: true,
        representanteLegal: true,
        firmaRepresentanteUrl: true,
        nombre: true,
      },
    });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');
    return tenant;
  }

  async updateBranding(tenantId: string, dto: UpdateTenantBrandingDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: dto,
      select: {
        razonSocial: true,
        nit: true,
        logoUrl: true,
        representanteLegal: true,
        firmaRepresentanteUrl: true,
        nombre: true,
      },
    });
  }

  async getPilaEmployerProfile(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        razonSocial: true,
        nit: true,
        aportesExonerados: true,
        ...this.pilaProfileSelect(),
      },
    });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');
    return tenant;
  }

  async updatePilaEmployerProfile(
    tenantId: string,
    userId: string,
    dto: UpdatePilaEmployerProfileDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, aportesExonerados: true },
    });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');

    if (
      dto.pilaAportesExoneradosConfirmado !== undefined &&
      dto.pilaAportesExoneradosConfirmado !== null &&
      dto.pilaAportesExoneradosConfirmado !== tenant.aportesExonerados
    ) {
      throw new BadRequestException(
        'La confirmación de exoneración debe coincidir con la configuración vigente de nómina.',
      );
    }

    const { pilaFechaMatriculaMercantil, ...rest } = dto;
    const data = {
      ...rest,
      ...(pilaFechaMatriculaMercantil !== undefined && {
        pilaFechaMatriculaMercantil: pilaFechaMatriculaMercantil
          ? new Date(`${pilaFechaMatriculaMercantil}T00:00:00.000Z`)
          : null,
      }),
    };
    const changedPilaFields = PILA_PROFILE_FIELDS.filter(
      (field) => dto[field] !== undefined,
    );

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.tenant.update({
        where: { id: tenantId },
        data,
        select: {
          razonSocial: true,
          nit: true,
          aportesExonerados: true,
          ...this.pilaProfileSelect(),
        },
      });
      if (changedPilaFields.length > 0) {
        await this.audit.log(
          {
            tenantId,
            userId,
            action: 'PILA_EMPLOYER_PROFILE_UPDATED',
            entityType: 'Tenant',
            entityId: tenantId,
            metadata: { fields: [...changedPilaFields] },
          },
          tx,
        );
      }
      return result;
    });
  }

  private pilaProfileSelect() {
    return {
      pilaTipoDocumentoAportante: true,
      pilaNaturalezaJuridica: true,
      pilaTipoPersona: true,
      pilaFormaPresentacion: true,
      pilaCodigoSucursal: true,
      pilaNombreSucursal: true,
      pilaCodigoActividadEconomica: true,
      pilaCodigoArlAportante: true,
      pilaTipoAportante: true,
      pilaFax: true,
      pilaRepresentanteTipoDocumento: true,
      pilaRepresentanteNumeroDocumento: true,
      pilaRepresentantePrimerApellido: true,
      pilaRepresentanteSegundoApellido: true,
      pilaRepresentantePrimerNombre: true,
      pilaRepresentanteSegundoNombre: true,
      pilaFechaMatriculaMercantil: true,
      pilaBeneficioLey1429: true,
      pilaBeneficioCcfLey1429: true,
      pilaAportesExoneradosConfirmado: true,
      pilaSinAccionEspecial: true,
    } as const;
  }

  async getFirma(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { firmaRepresentanteUrl: true },
    });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');

    const storageKey = this.getStorageKeyFromPrivateUrl(
      tenant.firmaRepresentanteUrl,
    );
    if (!storageKey) throw new NotFoundException('Firma no configurada');

    try {
      const body = await this.storage.getObject(storageKey);
      return { body, contentType: this.getImageContentType(storageKey) };
    } catch (error) {
      if (error instanceof StorageObjectNotFoundError) {
        throw new NotFoundException('Archivo de firma no encontrado');
      }
      throw error;
    }
  }

  async getLogo(filename: string) {
    if (!filename || filename.includes('/') || filename.includes('\\')) {
      throw new NotFoundException('Logo no encontrado');
    }

    const storageKey = `logos/${filename}`;
    try {
      const body = await this.storage.getObject(storageKey);
      return { body, contentType: this.getImageContentType(storageKey) };
    } catch (error) {
      if (error instanceof StorageObjectNotFoundError) {
        throw new NotFoundException('Logo no encontrado');
      }
      throw error;
    }
  }

  async uploadLogo(tenantId: string, originalname: string, buffer: Buffer) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');

    const ext = path.extname(originalname);
    const filename = `${tenantId}-logo-${Date.now()}${ext}`;
    const storageKey = `logos/${filename}`;

    await this.storage.putObject({ key: storageKey, body: buffer });
    const logoUrl = `/uploads/${storageKey}`;

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl },
      select: { logoUrl: true },
    });
  }

  async uploadFirma(tenantId: string, originalname: string, buffer: Buffer) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');

    const ext = path.extname(originalname);
    const filename = `${tenantId}-firma-${Date.now()}${ext}`;
    const storageKey = `firmas/${filename}`;

    await this.storage.putObject({ key: storageKey, body: buffer });
    const firmaUrl = `/uploads/${storageKey}`;

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { firmaRepresentanteUrl: firmaUrl },
      select: { firmaRepresentanteUrl: true },
    });
  }

  private getStorageKeyFromPrivateUrl(url: string | null): string | null {
    const prefix = '/uploads/';
    if (!url?.startsWith(prefix)) return null;

    const storageKey = url.slice(prefix.length);
    return storageKey || null;
  }

  private getImageContentType(storageKey: string): string {
    switch (path.extname(storageKey).toLowerCase()) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      case '.svg':
        return 'image/svg+xml';
      default:
        return 'application/octet-stream';
    }
  }
}
