import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TipoComprobanteQueryDto } from './dto/tipo-comprobante-query.dto';

// TipoComprobante es un catálogo GLOBAL de plataforma (sin tenantId). Se expone
// solo en lectura: su escritura se gestiona vía seed hasta que exista un rol de
// administrador de plataforma. Permitir que un tenant lo edite afectaría a todos.
@Injectable()
export class TiposComprobanteService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: TipoComprobanteQueryDto) {
    const where: Prisma.TipoComprobanteWhereInput = {
      ...(query.activo !== undefined && { activo: query.activo }),
    };

    if (query.search) {
      where.OR = [
        { codigo: { contains: query.search, mode: 'insensitive' } },
        { nombre: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.tipoComprobante.findMany({
      where,
      orderBy: { codigo: 'asc' },
    });
  }

  async findOne(id: string) {
    const tipo = await this.prisma.tipoComprobante.findUnique({
      where: { id },
    });
    if (!tipo) throw new NotFoundException('Tipo de comprobante no encontrado');
    return tipo;
  }
}
