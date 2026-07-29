import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StorageObjectNotFoundError } from '../storage/storage.types';
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
