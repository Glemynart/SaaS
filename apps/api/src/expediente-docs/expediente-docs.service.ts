import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ExpedienteCategoria, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { AuditService } from '../audit/audit.service';
import type { PdfMaterializationResult } from '../generated-documents/generated-documents.service';

const TIPO_TO_CATEGORIA: Record<string, ExpedienteCategoria> = {
  CONTRACT: ExpedienteCategoria.CONTRATO,
  CERTIFICATION: ExpedienteCategoria.CERTIFICADO,
  LETTER: ExpedienteCategoria.OTRO,
  MEMO: ExpedienteCategoria.OTRO,
};

export interface PublishGeneratedDocumentResult {
  outcome: 'CREATED' | 'EXISTING';
  expedienteDocId: string;
  generatedDocumentId: string;
}

@Injectable()
export class ExpedienteDocsService {
  private readonly logger = new Logger(ExpedienteDocsService.name);

  constructor(
    private prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly auditService: AuditService,
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
    if (doc.generatedDocument?.tipo === 'CONTRACT') {
      throw new BadRequestException(
        'Los documentos CONTRACT publicados son inmutables y no se pueden eliminar del expediente.',
      );
    }
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

  /**
   * Publica un contrato ya materializado como índice de expediente. El PDF
   * permanece bajo la identidad de GeneratedDocument; aquí sólo se registra
   * su referencia canónica y la auditoría en la misma transacción.
   */
  async publishGeneratedDocument(
    tenantId: string,
    userId: string,
    generatedDocumentId: string,
    materialization: PdfMaterializationResult,
  ): Promise<PublishGeneratedDocumentResult> {
    const generatedDocument = await this.prisma.generatedDocument.findFirst({
      where: { id: generatedDocumentId, tenantId },
      select: {
        id: true,
        tenantId: true,
        employeeId: true,
        contratoId: true,
        nombre: true,
        tipo: true,
      },
    });
    if (!generatedDocument) {
      throw new NotFoundException('Documento generado no encontrado');
    }

    if (
      generatedDocument.tipo !== 'CONTRACT' ||
      generatedDocument.contratoId === null
    ) {
      throw new BadRequestException(
        'Solo se pueden publicar documentos contractuales en esta fase.',
      );
    }

    if (materialization.id !== generatedDocument.id) {
      throw new BadRequestException(
        'La materialización no corresponde al documento a publicar.',
      );
    }

    const { pdfStorageKey, pdfSizeBytes, pdfUrl } = materialization;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.expedienteDoc.findFirst({
          where: { tenantId, generatedDocumentId },
          select: { id: true },
        });
        if (existing) {
          return {
            outcome: 'EXISTING',
            expedienteDocId: existing.id,
            generatedDocumentId,
          };
        }

        await tx.generatedDocument.update({
          where: { id: generatedDocument.id },
          data: { pdfStorageKey, pdfSizeBytes, pdfUrl },
        });

        const expedienteDoc = await tx.expedienteDoc.create({
          data: {
            tenantId,
            empleadoId: generatedDocument.employeeId,
            contratoId: generatedDocument.contratoId,
            generatedDocumentId: generatedDocument.id,
            categoria: ExpedienteCategoria.CONTRATO,
            nombre: generatedDocument.nombre,
            storageKey: pdfStorageKey,
            mimeType: 'application/pdf',
            tamanoBytes: pdfSizeBytes,
            subidoPorId: userId,
            subidoPorNombre: 'sistema',
          },
          select: { id: true },
        });

        await this.auditService.log(
          {
            tenantId,
            userId,
            action: 'CONTRACT_DOCUMENT_PUBLISHED',
            entityType: 'ExpedienteDoc',
            entityId: expedienteDoc.id,
            metadata: {
              generatedDocumentId: generatedDocument.id,
              contratoId: generatedDocument.contratoId,
              pdfStorageKey,
              pdfSizeBytes,
            },
          },
          tx,
        );

        return {
          outcome: 'CREATED',
          expedienteDocId: expedienteDoc.id,
          generatedDocumentId,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.expedienteDoc.findFirst({
          where: { tenantId, generatedDocumentId },
          select: { id: true },
        });
        if (existing) {
          return {
            outcome: 'EXISTING',
            expedienteDocId: existing.id,
            generatedDocumentId,
          };
        }
      }
      throw error;
    }
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
