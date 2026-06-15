import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });
    if (!tenant) {
      throw new NotFoundException('Empresa no encontrada.');
    }
    return tenant;
  }

  async ensureActive(id: string) {
    const tenant = await this.findOne(id);
    if (!tenant.activo) {
      throw new BadRequestException(
        'La empresa está inactiva y no puede realizar operaciones.',
      );
    }
    return tenant;
  }
}
