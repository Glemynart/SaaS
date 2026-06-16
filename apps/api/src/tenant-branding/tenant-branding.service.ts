import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTenantBrandingDto } from './dto/update-tenant-branding.dto';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class TenantBrandingService {
  constructor(private prisma: PrismaService) {}

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
    const uploadsDir = path.join(process.cwd(), '..', '..', 'uploads', 'logos');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(uploadsDir, filename), buffer);
    const logoUrl = `/uploads/logos/${filename}`;

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
    const uploadsDir = path.join(
      process.cwd(),
      '..',
      '..',
      'uploads',
      'firmas',
    );

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(uploadsDir, filename), buffer);
    const firmaUrl = `/uploads/firmas/${filename}`;

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { firmaRepresentanteUrl: firmaUrl },
      select: { firmaRepresentanteUrl: true },
    });
  }
}
