import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformTenantResponseDto } from './dto/platform-tenant-response.dto';

export const PLATFORM_TENANT_SELECT = {
  id: true,
  nombre: true,
  razonSocial: true,
  nit: true,
  activo: true,
  plan: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TenantSelect;

@Injectable()
export class PlatformTenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(tenantId: string): Promise<PlatformTenantResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: PLATFORM_TENANT_SELECT,
    });

    if (!tenant) {
      throw new NotFoundException('Empresa no encontrada.');
    }

    return {
      id: tenant.id,
      nombre: tenant.nombre,
      razonSocial: tenant.razonSocial,
      nit: tenant.nit,
      activo: tenant.activo,
      plan: tenant.plan,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }
}
