import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BatchDocumentGenerationPlanStatus,
  GeneratedDocumentStatus,
  LoteEstado,
  Prisma,
} from '@prisma/client';
import { formatNombreCompleto } from '@saas/types';
import { PdfRenderService } from '../pdf-render/pdf-render.service';
import { StorageService } from '../storage/storage.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { parseContractPlanSnapshot } from '../contracts/contract-plan-snapshot';
import { ExpedienteDocsService } from '../expediente-docs/expediente-docs.service';

type PlanTemplateSnapshot = {
  id: string;
  nombre?: string;
  contenido: string;
};

type ContractCompanySnapshot = {
  nombre: string;
  razonSocial: string | null;
  nit: string;
  representanteLegal: string | null;
};

type PreparedDocument = {
  planId: string;
  planStatus: BatchDocumentGenerationPlanStatus;
  tenantId: string;
  document: {
    id: string;
    estado: GeneratedDocumentStatus;
    contenidoFinal: string;
    contratoId: string | null;
    pdfStorageKey: string | null;
    pdfSizeBytes: number | null;
    pdfUrl: string | null;
  };
  contratoId: string;
};

/**
 * Orquesta la materialización de planes documentales ya confirmados.
 *
 * Las transacciones tenant-aware se limitan a reclamar/persistir estado. El
 * render y la escritura externa se ejecutan entre ambas transacciones para no
 * mantener bloqueos de base de datos durante operaciones lentas.
 */
@Injectable()
export class BatchDocumentGenerationService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly pdfRender: PdfRenderService,
    private readonly storage: StorageService,
    private readonly expedienteDocsService: ExpedienteDocsService,
  ) {}

  async start(
    loteId: string,
    userId = 'system',
    employeeIds?: readonly string[],
  ) {
    const plans = await this.tenantPrisma.execute(async (prisma, context) => {
      const lote = await prisma.loteContrato.findFirst({
        where: { id: loteId, tenantId: context.tenantId },
        select: { estado: true },
      });
      if (!lote) throw new NotFoundException('Lote no encontrado');

      if (lote.estado !== LoteEstado.EN_PROCESO) {
        throw new ConflictException(
          `El lote no puede iniciar generación en estado "${lote.estado}".`,
        );
      }

      const plans = await prisma.batchDocumentGenerationPlan.findMany({
        where: {
          tenantId: context.tenantId,
          loteId,
          ...(employeeIds ? { empleadoId: { in: [...employeeIds] } } : {}),
          estado: {
            in: [
              BatchDocumentGenerationPlanStatus.CONFIRMADO,
              BatchDocumentGenerationPlanStatus.CONSUMIDO,
            ],
          },
        },
        select: { id: true },
      });
      if (plans.length === 0) {
        throw new BadRequestException(
          'El lote no tiene planes disponibles para generar.',
        );
      }
      return plans;
    });

    const documents = [];
    for (const plan of plans) {
      documents.push(await this.generatePlan(plan.id, userId));
    }

    return { loteId, total: documents.length, documents };
  }

  private async generatePlan(planId: string, userId: string) {
    const prepared = await this.prepareDocument(planId);
    const wasMaterialized = this.hasMaterializedPdf(prepared.document);

    if (wasMaterialized) {
      try {
        await this.ensureDocumentLinkedToContract(prepared);
        await this.publishDocument(prepared, userId, {
          pdfStorageKey: prepared.document.pdfStorageKey!,
          pdfSizeBytes: prepared.document.pdfSizeBytes!,
          pdfUrl: prepared.document.pdfUrl!,
        });
        if (
          prepared.planStatus !== BatchDocumentGenerationPlanStatus.CONSUMIDO
        ) {
          await this.markPlanConsumed(prepared.planId, prepared.tenantId);
        }
        return {
          planId: prepared.planId,
          documentId: prepared.document.id,
          outcome: 'EXISTING',
        };
      } catch (error) {
        await this.markDocumentFailed(
          prepared.tenantId,
          prepared.document.id,
        ).catch(() => undefined);
        throw error;
      }
    }

    const storageKey = this.getStorageKey(
      prepared.tenantId,
      prepared.document.id,
    );
    const pdfUrl = this.getPdfUrl(storageKey);

    try {
      await this.ensureDocumentLinkedToContract(prepared);
      const pdfSizeBytes = await this.ensureStoredPdf(
        storageKey,
        prepared.document.contenidoFinal,
      );
      await this.completeMaterialization({
        planId: prepared.planId,
        tenantId: prepared.tenantId,
        documentId: prepared.document.id,
        contratoId: prepared.contratoId,
        storageKey,
        pdfUrl,
        pdfSizeBytes,
      });
      await this.publishDocument(prepared, userId, {
        pdfStorageKey: storageKey,
        pdfSizeBytes,
        pdfUrl,
      });

      return {
        planId: prepared.planId,
        documentId: prepared.document.id,
        outcome: 'MATERIALIZED',
      };
    } catch (error) {
      await this.markDocumentFailed(
        prepared.tenantId,
        prepared.document.id,
      ).catch(() => undefined);
      throw error;
    }
  }

  private async prepareDocument(planId: string): Promise<PreparedDocument> {
    return this.tenantPrisma.execute(async (prisma, context) => {
      const plan = await prisma.batchDocumentGenerationPlan.findFirst({
        where: { id: planId, tenantId: context.tenantId },
        select: {
          id: true,
          tenantId: true,
          empleadoId: true,
          loteId: true,
          plantillaId: true,
          plantillaSnapshot: true,
          empleadoSnapshot: true,
          contratoSnapshot: true,
          tipoDocumental: true,
          estado: true,
        },
      });
      if (!plan)
        throw new NotFoundException('Plan de generación no encontrado');
      if (plan.estado === BatchDocumentGenerationPlanStatus.ANULADO) {
        throw new ConflictException('El plan de generación está anulado.');
      }

      const contract = await prisma.contrato.findFirst({
        where: {
          tenantId: context.tenantId,
          loteId: plan.loteId,
          empleadoId: plan.empleadoId,
        },
        select: { id: true, variablesSnapshot: true },
      });
      if (!contract) {
        throw new NotFoundException(
          'El plan confirmado no tiene un contrato asociado.',
        );
      }

      const existing = await prisma.generatedDocument.findFirst({
        where: {
          tenantId: context.tenantId,
          batchDocumentGenerationPlanId: plan.id,
        },
        select: {
          id: true,
          estado: true,
          contenidoFinal: true,
          contratoId: true,
          pdfStorageKey: true,
          pdfSizeBytes: true,
          pdfUrl: true,
        },
      });
      if (existing) {
        return {
          planId: plan.id,
          planStatus: plan.estado,
          tenantId: context.tenantId,
          document: existing,
          contratoId: contract.id,
        };
      }
      const companySnapshot = this.resolveContractCompanySnapshot(
        contract.variablesSnapshot,
        contract.id,
      );

      const [template, employee] = await Promise.all([
        prisma.documentTemplate.findFirst({
          where: { id: plan.plantillaId, tenantId: context.tenantId },
          select: { id: true, nombre: true, tipo: true },
        }),
        prisma.empleado.findFirst({
          where: {
            id: plan.empleadoId,
            tenantId: context.tenantId,
            deletedAt: null,
          },
          include: { sedeRef: { select: { nombre: true } } },
        }),
      ]);
      if (!template) throw new NotFoundException('Plantilla no encontrada');
      if (!employee) throw new NotFoundException('Empleado no encontrado');

      const snapshot = this.resolveTemplateSnapshot(
        plan.plantillaSnapshot,
        {
          id: template.id,
          tipo: template.tipo,
          nombre: template.nombre,
        },
        plan.plantillaId,
        plan.tipoDocumental,
      );
      const contractPlanSnapshot = parseContractPlanSnapshot(
        plan.empleadoSnapshot,
        plan.contratoSnapshot,
      );
      const nombreCompleto = formatNombreCompleto({
        primerNombre: contractPlanSnapshot.empleado.primerNombre,
        segundoNombre: contractPlanSnapshot.empleado.segundoNombre,
        primerApellido: contractPlanSnapshot.empleado.primerApellido,
        segundoApellido: contractPlanSnapshot.empleado.segundoApellido,
      });
      const documentData = {
        tenantId: context.tenantId,
        employeeId: employee.id,
        templateId: template.id,
        batchDocumentGenerationPlanId: plan.id,
        contratoId: contract.id,
        nombre: `${snapshot.nombre ?? template.nombre} — ${nombreCompleto}`,
        contenidoFinal: this.replaceVariables(snapshot.contenido, {
          NOMBRE_COMPLETO: nombreCompleto,
          DOCUMENTO: `${contractPlanSnapshot.empleado.tipoDocumento} ${contractPlanSnapshot.empleado.cedula}`,
          CARGO: contractPlanSnapshot.contrato.cargo,
          SALARIO: new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(Number(contractPlanSnapshot.contrato.salario)),
          TIPO_CONTRATO: this.formatTipoContrato(
            contractPlanSnapshot.contrato.tipo,
          ),
          FECHA_INGRESO: new Date(
            contractPlanSnapshot.contrato.fechaInicio,
          ).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          SEDE: contractPlanSnapshot.contrato.sede?.nombre ?? '',
          EMPRESA: companySnapshot.razonSocial ?? companySnapshot.nombre,
          NIT: companySnapshot.nit,
          REPRESENTANTE_LEGAL:
            companySnapshot.representanteLegal ?? 'No definido',
          LOGO_EMPRESA: '',
          FIRMA_REPRESENTANTE: '',
        }),
        tipo: plan.tipoDocumental,
      };

      try {
        const document = await prisma.generatedDocument.create({
          data: documentData,
          select: {
            id: true,
            estado: true,
            contenidoFinal: true,
            contratoId: true,
            pdfStorageKey: true,
            pdfSizeBytes: true,
            pdfUrl: true,
          },
        });
        return {
          planId: plan.id,
          planStatus: plan.estado,
          tenantId: context.tenantId,
          document,
          contratoId: contract.id,
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const concurrent = await prisma.generatedDocument.findFirst({
            where: {
              tenantId: context.tenantId,
              batchDocumentGenerationPlanId: plan.id,
            },
            select: {
              id: true,
              estado: true,
              contenidoFinal: true,
              contratoId: true,
              pdfStorageKey: true,
              pdfSizeBytes: true,
              pdfUrl: true,
            },
          });
          if (concurrent) {
            return {
              planId: plan.id,
              planStatus: plan.estado,
              tenantId: context.tenantId,
              document: concurrent,
              contratoId: contract.id,
            };
          }
        }
        throw error;
      }
    });
  }

  private async ensureStoredPdf(
    storageKey: string,
    contenidoFinal: string,
  ): Promise<number> {
    if (await this.storage.objectExists(storageKey)) {
      return (await this.storage.getObject(storageKey)).length;
    }

    const pdf = await this.pdfRender.renderPdf(
      this.buildPdfHtml(contenidoFinal),
    );
    const stored = await this.storage.putObject({
      key: storageKey,
      body: Buffer.from(pdf),
      contentType: 'application/pdf',
    });
    return stored.size;
  }

  private async completeMaterialization(input: {
    planId: string;
    tenantId: string;
    documentId: string;
    contratoId: string;
    storageKey: string;
    pdfUrl: string;
    pdfSizeBytes: number;
  }): Promise<void> {
    await this.tenantPrisma.execute(async (prisma) => {
      const documentUpdate = await prisma.generatedDocument.updateMany({
        where: { id: input.documentId, tenantId: input.tenantId },
        data: {
          pdfStorageKey: input.storageKey,
          pdfUrl: input.pdfUrl,
          pdfSizeBytes: input.pdfSizeBytes,
          contratoId: input.contratoId,
          estado: GeneratedDocumentStatus.MATERIALIZADO,
        },
      });
      if (documentUpdate.count !== 1) {
        throw new ConflictException(
          'No se pudo materializar exactamente un documento generado.',
        );
      }

      const planUpdate = await prisma.batchDocumentGenerationPlan.updateMany({
        where: { id: input.planId, tenantId: input.tenantId },
        data: { estado: BatchDocumentGenerationPlanStatus.CONSUMIDO },
      });
      if (planUpdate.count !== 1) {
        throw new ConflictException(
          'No se pudo consumir exactamente un plan de generación.',
        );
      }
    });
  }

  private async markPlanConsumed(
    planId: string,
    tenantId: string,
  ): Promise<void> {
    await this.tenantPrisma.execute((prisma) =>
      prisma.batchDocumentGenerationPlan.updateMany({
        where: { id: planId, tenantId },
        data: { estado: BatchDocumentGenerationPlanStatus.CONSUMIDO },
      }),
    );
  }

  private async markDocumentFailed(
    tenantId: string,
    documentId: string,
  ): Promise<void> {
    await this.tenantPrisma.execute((prisma) =>
      prisma.generatedDocument.updateMany({
        where: { id: documentId, tenantId },
        data: { estado: GeneratedDocumentStatus.FALLIDO },
      }),
    );
  }

  private hasMaterializedPdf(document: PreparedDocument['document']): boolean {
    return Boolean(
      document.estado === GeneratedDocumentStatus.MATERIALIZADO &&
      document.pdfStorageKey &&
      document.pdfUrl &&
      document.pdfSizeBytes !== null,
    );
  }

  private async ensureDocumentLinkedToContract(
    prepared: PreparedDocument,
  ): Promise<void> {
    if (prepared.document.contratoId === prepared.contratoId) return;

    await this.tenantPrisma.execute(async (prisma, context) => {
      const document = await prisma.generatedDocument.findFirst({
        where: { id: prepared.document.id, tenantId: context.tenantId },
        select: { contratoId: true },
      });
      if (!document) {
        throw new NotFoundException('Documento generado no encontrado');
      }
      if (document.contratoId === prepared.contratoId) return;
      if (document.contratoId) {
        throw new ConflictException(
          'El documento generado ya estÃ¡ vinculado a otro contrato.',
        );
      }

      const updated = await prisma.generatedDocument.updateMany({
        where: {
          id: prepared.document.id,
          tenantId: context.tenantId,
          contratoId: null,
        },
        data: { contratoId: prepared.contratoId },
      });
      if (updated.count === 1) return;

      const concurrent = await prisma.generatedDocument.findFirst({
        where: { id: prepared.document.id, tenantId: context.tenantId },
        select: { contratoId: true },
      });
      if (concurrent?.contratoId !== prepared.contratoId) {
        throw new ConflictException(
          'No se pudo vincular el documento al contrato confirmado.',
        );
      }
    });
  }

  private async publishDocument(
    prepared: PreparedDocument,
    userId: string,
    materialization: {
      pdfStorageKey: string;
      pdfSizeBytes: number;
      pdfUrl: string;
    },
  ): Promise<void> {
    await this.expedienteDocsService.publishGeneratedDocument(
      prepared.tenantId,
      userId,
      prepared.document.id,
      {
        id: prepared.document.id,
        ...materialization,
        materialized: false,
      },
    );
  }

  private resolveTemplateSnapshot(
    value: Prisma.JsonValue,
    template: { id: string; nombre: string; tipo: string },
    templateId: string,
    type: string,
  ): PlanTemplateSnapshot {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      typeof (value as PlanTemplateSnapshot).id !== 'string' ||
      typeof (value as PlanTemplateSnapshot).contenido !== 'string'
    ) {
      throw new BadRequestException(
        'El plan no contiene un snapshot de plantilla compatible.',
      );
    }
    const snapshot = value as PlanTemplateSnapshot;
    if (snapshot.id !== templateId || template.id !== templateId) {
      throw new BadRequestException(
        'La plantilla del plan no coincide con su snapshot confirmado.',
      );
    }
    if (template.tipo !== type) {
      throw new BadRequestException(
        'La plantilla del plan no coincide con el tipo documental confirmado.',
      );
    }
    return snapshot;
  }

  private resolveContractCompanySnapshot(
    value: Prisma.JsonValue,
    contractId: string,
  ): ContractCompanySnapshot {
    const snapshot = asRecord(value);
    const company = snapshot && asRecord(snapshot.empresa);
    const razonSocial = company?.razonSocial ?? null;
    const representanteLegal = company?.representanteLegal ?? null;

    if (
      !company ||
      typeof company.nombre !== 'string' ||
      typeof company.nit !== 'string' ||
      (company.razonSocial !== null &&
        company.razonSocial !== undefined &&
        typeof company.razonSocial !== 'string') ||
      (company.representanteLegal !== null &&
        company.representanteLegal !== undefined &&
        typeof company.representanteLegal !== 'string')
    ) {
      throw new BadRequestException(
        `El contrato ${contractId} tiene un variablesSnapshot incompatible con la generación de documentos. Contacte soporte.`,
      );
    }

    return {
      nombre: company.nombre,
      razonSocial: razonSocial as string | null,
      nit: company.nit,
      representanteLegal: representanteLegal as string | null,
    };
  }

  private buildPdfHtml(content: string): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 12pt; line-height: 1.7; color: #1a1a1a; }
img { max-width: 100%; height: auto; }
</style></head><body>${content}</body></html>`;
  }

  private getStorageKey(tenantId: string, documentId: string): string {
    return `pdfs/${tenantId}-${documentId}.pdf`;
  }

  private getPdfUrl(storageKey: string): string {
    return `/uploads/${storageKey}`;
  }

  private replaceVariables(
    template: string,
    variables: Record<string, string>,
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }

  private formatTipoContrato(tipo: string): string {
    const labels: Record<string, string> = {
      TERMINO_FIJO: 'Término Fijo',
      TERMINO_INDEFINIDO: 'Término Indefinido',
      OBRA_LABOR: 'Obra o Labor',
      APRENDIZAJE: 'Aprendizaje',
      PRESTACION_SERVICIOS: 'Prestación de Servicios',
    };
    return labels[tipo] ?? tipo.replace(/_/g, ' ');
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
