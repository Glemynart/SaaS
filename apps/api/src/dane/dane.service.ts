import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DIVIPOLA_MGN_2025_MUNICIPALITIES } from './divipola-mgn-2025';

@Injectable()
export class DaneService implements OnModuleInit {
  private readonly logger = new Logger(DaneService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const { count } = await this.prisma.municipioDane.createMany({
      data: DIVIPOLA_MGN_2025_MUNICIPALITIES.map(
        ({ codigo, nombre, departamento }) => ({
          codigo,
          nombre,
          departamento,
        }),
      ),
      skipDuplicates: true,
    });

    if (count > 0) {
      this.logger.log(`${count} municipios DANE MGN 2025 creados.`);
    }
  }

  async findAllMunicipios(search?: string) {
    return this.prisma.municipioDane.findMany({
      where: search
        ? {
            OR: [
              { nombre: { contains: search, mode: 'insensitive' } },
              { departamento: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { nombre: 'asc' },
    });
  }
}
