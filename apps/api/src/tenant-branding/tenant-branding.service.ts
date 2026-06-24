import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpdateTenantBrandingDto } from './dto/update-tenant-branding.dto';
import * as path from 'path';

@Injectable()
export class TenantBrandingService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
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
}
