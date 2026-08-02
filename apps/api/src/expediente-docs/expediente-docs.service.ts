import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ExpedienteCategoria, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { StorageObjectNotFoundError } from '../storage/storage.types';
import type { PdfMaterializationResult } from '../generated-documents/generated-documents.service';
import { validateManualDocument } from './manual-document-validation';
import { randomUUID } from 'node:crypto';

const TIPO_TO_CATEGORIA: Record<string, ExpedienteCategoria> = {
  CONTRACT: ExpedienteCategoria.CONTRATO,
  CERTIFICATION: ExpedienteCategoria.CERTIFICADO,
  LETTER: ExpedienteCategoria.OTRO,
  MEMO: ExpedienteCategoria.OTRO,
};

const PUBLISHABLE_DOCUMENT_TYPES = new Set(['CONTRACT', 'CERTIFICATION']);

const PUBLISH_AUDIT_ACTION: Record<string, string> = {
  CONTRACT: 'CONTRACT_DOCUMENT_PUBLISHED',
  CERTIFICATION: 'CERTIFICATION_DOCUMENT_PUBLISHED',
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
    private readonly storage: StorageService,
  ) {}

  async findByEmployee(tenantId: string, employeeId: string) {
    const employee = await this.tenantPrisma.execute((prisma) =>
      prisma.empleado.findFirst({
        where: { id: employeeId, tenantId, deletedAt: null },
      }),
    );
    if (!employee) throw new NotFoundException('Empleado no encontrado');

    const docs = await this.prisma.expedienteDoc.findMany({
      where: { tenantId, empleadoId: employeeId, vigente: true },
      orderBy: { version: 'desc' },
      include: {
        familia: {
          select: { id: true, nombre: true, categoria: true },
        },
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
          familia: {
            select: { id: true, nombre: true, categoria: true },
          },
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

  async findHistory(tenantId: string, id: string) {
    const document = await this.prisma.expedienteDoc.findFirst({
      where: { id, tenantId },
      select: { familiaId: true, empleadoId: true },
    });
    if (!document) {
      throw new NotFoundException('Documento no encontrado en el expediente');
    }

    const family = await this.prisma.expedienteDocFamily.findFirst({
      where: {
        id: document.familiaId,
        tenantId,
        empleadoId: document.empleadoId,
      },
      select: {
        id: true,
        tenantId: true,
        empleadoId: true,
        categoria: true,
        nombre: true,
        descripcion: true,
      },
    });
    if (!family) {
      throw new NotFoundException('Familia documental no encontrada');
    }

    const revisions = await this.prisma.expedienteDoc.findMany({
      where: { tenantId, familiaId: family.id },
      orderBy: { version: 'desc' },
      include: {
        generatedDocument: { select: { id: true, nombre: true, tipo: true } },
      },
    });

    return { family, revisions };
  }

  async download(tenantId: string, userId: string, id: string) {
    const document = await this.prisma.expedienteDoc.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        nombre: true,
        mimeType: true,
        storageKey: true,
        familiaId: true,
        version: true,
        categoria: true,
        generatedDocumentId: true,
        contratoId: true,
      },
    });
    if (!document) {
      throw new NotFoundException('Documento no encontrado en el expediente');
    }

    let body: Buffer;
    try {
      body = await this.storage.getObject(document.storageKey);
    } catch (error) {
      if (error instanceof StorageObjectNotFoundError) {
        throw new NotFoundException('Archivo de expediente no encontrado');
      }
      throw error;
    }

    this.auditService
      .log({
        tenantId,
        userId,
        action: 'EXPEDIENTE_DOCUMENT_ACCESS_GRANTED',
        entityType: 'ExpedienteDoc',
        entityId: document.id,
        metadata: {
          delivery: 'DOWNLOAD',
          familiaId: document.familiaId,
          version: document.version,
          categoria: document.categoria,
          generatedDocumentId: document.generatedDocumentId,
          contratoId: document.contratoId,
        },
      })
      .catch(() => {});

    return { nombre: document.nombre, mimeType: document.mimeType, body };
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    throw new BadRequestException(
      'Los documentos publicados son inmutables y no se pueden eliminar del expediente.',
    );
  }

  async uploadManual(
    tenantId: string,
    userId: string,
    userEmail: string,
    employeeId: string,
    categoria: ExpedienteCategoria,
    file: { originalname: string; buffer: Buffer },
    familiaId?: string | null,
  ) {
    const employee = await this.tenantPrisma.execute((prisma) =>
      prisma.empleado.findFirst({
        where: { id: employeeId, tenantId, deletedAt: null },
        select: { id: true },
      }),
    );
    if (!employee) throw new NotFoundException('Empleado no encontrado');

    const family = familiaId
      ? await this.prisma.expedienteDocFamily.findFirst({
          where: { id: familiaId, tenantId, empleadoId: employeeId },
          select: { id: true, categoria: true },
        })
      : null;
    if (familiaId && !family) {
      throw new NotFoundException('Familia documental no encontrada');
    }
    if (family && family.categoria !== categoria) {
      throw new BadRequestException(
        'Una revisión debe conservar la familia documental y su categoría.',
      );
    }

    const currentRevision = family
      ? await this.prisma.expedienteDoc.findFirst({
          where: {
            tenantId,
            empleadoId: employeeId,
            familiaId: family.id,
            vigente: true,
          },
          select: { id: true, version: true, generatedDocumentId: true },
        })
      : null;
    if (family && !currentRevision) {
      throw new ConflictException(
        'La familia documental no tiene una revisión vigente.',
      );
    }
    if (currentRevision?.generatedDocumentId) {
      throw new BadRequestException(
        'Los documentos generados requieren una nueva emisión para crear otra revisión.',
      );
    }

    const validated = validateManualDocument(file);
    const documentId = randomUUID();
    const resolvedFamilyId = family?.id ?? randomUUID();
    const version = (currentRevision?.version ?? 0) + 1;
    const safeName = (
      validated.originalName || `documento.${validated.extension}`
    )
      .replace(/[\\/]/g, '_')
      .slice(0, 180);
    const storageKey = `${tenantId}/expediente/${employeeId}/${categoria}/${resolvedFamilyId}_v${version}.${validated.extension}`;

    const stored = await this.storage.putObject({
      key: storageKey,
      body: file.buffer,
      contentType: validated.mimeType,
    });

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!family) {
          await tx.expedienteDocFamily.create({
            data: {
              id: resolvedFamilyId,
              tenantId,
              empleadoId: employeeId,
              categoria,
              nombre: safeName,
            },
          });
        } else {
          await tx.expedienteDoc.update({
            where: { id: currentRevision!.id },
            data: { vigente: false },
          });
        }

        const document = await tx.expedienteDoc.create({
          data: {
            id: documentId,
            tenantId,
            empleadoId: employeeId,
            familiaId: resolvedFamilyId,
            reemplazaId: currentRevision?.id,
            categoria,
            nombre: safeName,
            version,
            vigente: true,
            storageKey,
            mimeType: validated.mimeType,
            tamanoBytes: stored.size,
            subidoPorId: userId,
            subidoPorNombre: userEmail,
          },
        });

        await this.auditService.log(
          {
            tenantId,
            userId,
            action: 'EXPEDIENTE_DOCUMENT_UPLOADED',
            entityType: 'ExpedienteDoc',
            entityId: document.id,
            metadata: {
              empleadoId: employeeId,
              familiaId: resolvedFamilyId,
              version,
              reemplazaId: currentRevision?.id ?? null,
              categoria,
              storageKey,
              mimeType: validated.mimeType,
              tamanoBytes: stored.size,
            },
          },
          tx,
        );

        return document;
      });
    } catch (error) {
      await this.storage.deleteObject(storageKey).catch((cleanupError) => {
        this.logger.warn(
          `No se pudo limpiar el archivo manual ${storageKey}: ${String(cleanupError)}`,
        );
      });
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'La familia documental cambió mientras se creaba la revisión.',
        );
      }
      throw error;
    }
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
    const familiaId = randomUUID();
    const storageKey = `${tenantId}/expediente/${employeeId}/${categoria}/gen_${generatedDocId}_v1.pdf`;

    await tx.expedienteDocFamily.create({
      data: {
        id: familiaId,
        tenantId,
        empleadoId: employeeId,
        categoria,
        nombre,
      },
    });

    return tx.expedienteDoc.create({
      data: {
        tenantId,
        empleadoId: employeeId,
        familiaId,
        generatedDocumentId: generatedDocId,
        contratoId: contratoId ?? undefined,
        categoria,
        nombre,
        version: 1,
        vigente: true,
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

    if (!PUBLISHABLE_DOCUMENT_TYPES.has(generatedDocument.tipo)) {
      throw new BadRequestException(
        'Solo se pueden publicar documentos CONTRACT o CERTIFICATION en esta fase.',
      );
    }

    if (
      generatedDocument.tipo === 'CONTRACT' &&
      generatedDocument.contratoId === null
    ) {
      throw new BadRequestException(
        'Los documentos CONTRACT requieren un contrato para publicarse.',
      );
    }

    if (materialization.id !== generatedDocument.id) {
      throw new BadRequestException(
        'La materialización no corresponde al documento a publicar.',
      );
    }

    const { pdfStorageKey, pdfSizeBytes, pdfUrl } = materialization;
    const categoria = TIPO_TO_CATEGORIA[generatedDocument.tipo];
    const auditAction = PUBLISH_AUDIT_ACTION[generatedDocument.tipo];
    const familiaId = randomUUID();

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
          data: {
            pdfStorageKey,
            pdfSizeBytes,
            pdfUrl,
            estado: 'MATERIALIZADO',
          },
        });

        await tx.expedienteDocFamily.create({
          data: {
            id: familiaId,
            tenantId,
            empleadoId: generatedDocument.employeeId,
            categoria,
            nombre: generatedDocument.nombre,
          },
        });

        const expedienteDoc = await tx.expedienteDoc.create({
          data: {
            tenantId,
            empleadoId: generatedDocument.employeeId,
            familiaId,
            contratoId: generatedDocument.contratoId,
            generatedDocumentId: generatedDocument.id,
            categoria,
            nombre: generatedDocument.nombre,
            version: 1,
            vigente: true,
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
            action: auditAction,
            entityType: 'ExpedienteDoc',
            entityId: expedienteDoc.id,
            metadata: {
              familiaId,
              version: 1,
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
      where: { tenantId, empleadoId: employeeId, vigente: true },
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
