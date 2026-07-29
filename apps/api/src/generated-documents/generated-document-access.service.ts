import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StorageObjectNotFoundError } from '../storage/storage.types';

export interface GeneratedDocumentMetadata {
  id: string;
  employeeId: string;
  templateId: string;
  nombre: string;
  tipo: string;
  estado: string;
  pdfSizeBytes: number | null;
  pdfAvailable: boolean;
  createdAt: Date;
  employee: {
    id: string;
    primerNombre: string;
    segundoNombre: string | null;
    primerApellido: string;
    segundoApellido: string | null;
    cedula: string;
    cargo: string;
    tipoDocumento: string;
    sedeRef: { id: string; nombre: string } | null;
  };
  template: { id: string; nombre: string; tipo: string };
}

export interface GeneratedDocumentDownload {
  nombre: string;
  body: Buffer;
}

const DOCUMENT_READ_ROLES = new Set<string>([
  UserRole.ADMIN,
  UserRole.OPERADOR,
]);

/** Caso de uso de lectura de documentos generados. */
@Injectable()
export class GeneratedDocumentAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly auditService: AuditService,
  ) {}

  async getMetadata(
    user: CurrentUserPayload,
    id: string,
  ): Promise<GeneratedDocumentMetadata> {
    this.assertReadPermission(user);

    const document = await this.prisma.generatedDocument.findFirst({
      where: { id, tenantId: user.tenantId },
      select: {
        id: true,
        employeeId: true,
        templateId: true,
        nombre: true,
        tipo: true,
        estado: true,
        pdfStorageKey: true,
        pdfUrl: true,
        pdfSizeBytes: true,
        createdAt: true,
        employee: {
          select: {
            id: true,
            primerNombre: true,
            segundoNombre: true,
            primerApellido: true,
            segundoApellido: true,
            cedula: true,
            cargo: true,
            tipoDocumento: true,
            sedeRef: { select: { id: true, nombre: true } },
          },
        },
        template: { select: { id: true, nombre: true, tipo: true } },
      },
    });

    if (!document) {
      throw new NotFoundException('Documento generado no encontrado');
    }

    return {
      id: document.id,
      employeeId: document.employeeId,
      templateId: document.templateId,
      nombre: document.nombre,
      tipo: document.tipo,
      estado: document.estado,
      pdfSizeBytes: document.pdfSizeBytes,
      pdfAvailable: Boolean(document.pdfStorageKey || document.pdfUrl),
      createdAt: document.createdAt,
      employee: document.employee,
      template: document.template,
    };
  }

  async getDownload(
    user: CurrentUserPayload,
    id: string,
  ): Promise<GeneratedDocumentDownload> {
    this.assertReadPermission(user);

    const document = await this.prisma.generatedDocument.findFirst({
      where: { id, tenantId: user.tenantId },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        pdfStorageKey: true,
        pdfUrl: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Documento generado no encontrado');
    }
    if (!document.pdfStorageKey && !document.pdfUrl) {
      throw new NotFoundException('PDF no generado aún');
    }

    const body = await this.readPdf(user.tenantId, document);

    await this.auditService.log({
      tenantId: user.tenantId,
      userId: user.userId,
      action: 'GENERATED_DOCUMENT_ACCESS_GRANTED',
      entityType: 'GeneratedDocument',
      entityId: document.id,
      metadata: { delivery: 'DOWNLOAD', documentType: document.tipo },
    });

    return { nombre: document.nombre, body };
  }

  private assertReadPermission(user: CurrentUserPayload): void {
    if (!DOCUMENT_READ_ROLES.has(user.rol)) {
      throw new ForbiddenException(
        'Acceso denegado: no tienes permisos para leer documentos generados.',
      );
    }
  }

  private async readPdf(
    tenantId: string,
    document: {
      id: string;
      pdfStorageKey: string | null;
      pdfUrl: string | null;
    },
  ): Promise<Buffer> {
    const candidates = new Set<string>();
    if (document.pdfStorageKey) candidates.add(document.pdfStorageKey);
    candidates.add(`pdfs/${tenantId}-${document.id}.pdf`);

    const legacyStorageKey = this.getStorageKeyFromLegacyUrl(document.pdfUrl);
    if (legacyStorageKey) candidates.add(legacyStorageKey);

    for (const storageKey of candidates) {
      try {
        return await this.storage.getObject(storageKey);
      } catch (error) {
        if (!(error instanceof StorageObjectNotFoundError)) throw error;
      }
    }

    throw new NotFoundException('Archivo PDF no encontrado');
  }

  private getStorageKeyFromLegacyUrl(pdfUrl: string | null): string | null {
    const prefix = '/uploads/';
    if (!pdfUrl?.startsWith(prefix)) return null;

    const storageKey = pdfUrl.slice(prefix.length);
    return storageKey || null;
  }
}
