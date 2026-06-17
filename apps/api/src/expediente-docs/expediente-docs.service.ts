import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ExpedienteCategoria } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const TIPO_TO_CATEGORIA: Record<string, ExpedienteCategoria> = {
  CONTRACT: ExpedienteCategoria.CONTRATO,
  CERTIFICATION: ExpedienteCategoria.CERTIFICADO,
  LETTER: ExpedienteCategoria.OTRO,
  MEMO: ExpedienteCategoria.OTRO,
};

@Injectable()
export class ExpedienteDocsService {
  private readonly logger = new Logger(ExpedienteDocsService.name);

  constructor(private prisma: PrismaService) {}

  async findByEmployee(tenantId: string, employeeId: string) {
    const employee = await this.prisma.empleado.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado');

    const docs = await this.prisma.expedienteDoc.findMany({
      where: { tenantId, empleadoId: employeeId },
      orderBy: { createdAt: 'desc' },
      include: {
        generatedDocument: { select: { id: true, nombre: true, tipo: true } },
      },
    });

    const stats = await this.buildStats(tenantId, employeeId);

    return { docs, stats };
  }

  async findOne(tenantId: string, id: string) {
    const doc = await this.prisma.expedienteDoc.findFirst({
      where: { id, tenantId },
      include: {
        empleado: {
          select: {
            id: true,
            primerNombre: true,
            segundoNombre: true,
            primerApellido: true,
            segundoApellido: true,
          },
        },
        generatedDocument: { select: { id: true, nombre: true, tipo: true } },
      },
    });
    if (!doc)
      throw new NotFoundException('Documento no encontrado en el expediente');
    return doc;
  }

  async createFromGeneratedDoc(
    tenantId: string,
    generatedDocId: string,
    employeeId: string,
    nombre: string,
    tipo: string,
  ) {
    const categoria = TIPO_TO_CATEGORIA[tipo] ?? ExpedienteCategoria.OTRO;
    const storageKey = `${tenantId}/expediente/${employeeId}/${categoria}/gen_${generatedDocId}_v1.pdf`;

    return this.prisma.expedienteDoc.create({
      data: {
        tenantId,
        empleadoId: employeeId,
        generatedDocumentId: generatedDocId,
        categoria,
        nombre,
        storageKey,
        mimeType: 'application/pdf',
        tamanoBytes: 0,
        subidoPorNombre: 'sistema',
      },
    });
  }

  private async buildStats(tenantId: string, employeeId: string) {
    const docs = await this.prisma.expedienteDoc.findMany({
      where: { tenantId, empleadoId: employeeId },
      select: { categoria: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const byCategory: Record<string, number> = {};
    for (const d of docs) {
      byCategory[d.categoria] = (byCategory[d.categoria] ?? 0) + 1;
    }

    return {
      total: docs.length,
      byCategory,
      ultimoDocumento: docs[0]?.createdAt?.toISOString() ?? null,
    };
  }
}
