import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ExpedienteCategoria, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';

const TIPO_TO_CATEGORIA: Record<string, ExpedienteCategoria> = {
  CONTRACT: ExpedienteCategoria.CONTRATO,
  CERTIFICATION: ExpedienteCategoria.CERTIFICADO,
  LETTER: ExpedienteCategoria.OTRO,
  MEMO: ExpedienteCategoria.OTRO,
};

@Injectable()
export class ExpedienteDocsService {
  private readonly logger = new Logger(ExpedienteDocsService.name);

  constructor(
    private prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  async findByEmployee(tenantId: string, employeeId: string) {
    const employee = await this.tenantPrisma.execute((prisma) =>
      prisma.empleado.findFirst({
        where: { id: employeeId, tenantId, deletedAt: null },
      }),
    );
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
    const doc = await this.tenantPrisma.execute((prisma) =>
      prisma.expedienteDoc.findFirst({
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
      }),
    );
    if (!doc)
      throw new NotFoundException('Documento no encontrado en el expediente');
    return doc;
  }

  async remove(tenantId: string, id: string) {
    const doc = await this.findOne(tenantId, id);
    return this.prisma.expedienteDoc.delete({ where: { id: doc.id } });
  }

  async createFromGeneratedDoc(
    tenantId: string,
    generatedDocId: string,
    employeeId: string,
    nombre: string,
    tipo: string,
    tx: Prisma.TransactionClient = this.prisma,
    contratoId?: string | null,
  ) {
    const categoria = TIPO_TO_CATEGORIA[tipo] ?? ExpedienteCategoria.OTRO;
    const storageKey = `${tenantId}/expediente/${employeeId}/${categoria}/gen_${generatedDocId}_v1.pdf`;

    return tx.expedienteDoc.create({
      data: {
        tenantId,
        empleadoId: employeeId,
        generatedDocumentId: generatedDocId,
        contratoId: contratoId ?? undefined,
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
