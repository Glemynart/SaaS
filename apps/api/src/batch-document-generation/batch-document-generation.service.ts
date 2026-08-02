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

type PlanTemplateSnapshot = {
  id: string;
  nombre?: string;
  contenido: string;
};

type PreparedDocument = {
  planId: string;
  planStatus: BatchDocumentGenerationPlanStatus;
  tenantId: string;
  document: {
    id: string;
    estado: GeneratedDocumentStatus;
    contenidoFinal: string;
  };
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
  ) {}

  async start(loteId: string) {
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
      documents.push(await this.generatePlan(plan.id));
    }

    return { loteId, total: documents.length, documents };
  }

  private async generatePlan(planId: string) {
    const prepared = await this.prepareDocument(planId);
    const wasMaterialized =
      prepared.document.estado === GeneratedDocumentStatus.MATERIALIZADO;

    if (wasMaterialized) {
      if (prepared.planStatus !== BatchDocumentGenerationPlanStatus.CONSUMIDO) {
        await this.markPlanConsumed(prepared.planId, prepared.tenantId);
      }
      return {
        planId: prepared.planId,
        documentId: prepared.document.id,
        outcome: 'EXISTING',
      };
    }

    const storageKey = this.getStorageKey(
      prepared.tenantId,
      prepared.document.id,
    );
    const pdfUrl = this.getPdfUrl(storageKey);

    try {
      const pdfSizeBytes = await this.ensureStoredPdf(
        storageKey,
        prepared.document.contenidoFinal,
      );
      await this.completeMaterialization({
        planId: prepared.planId,
        tenantId: prepared.tenantId,
        documentId: prepared.document.id,
        storageKey,
        pdfUrl,
        pdfSizeBytes,
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

      const existing = await prisma.generatedDocument.findFirst({
        where: {
          tenantId: context.tenantId,
          batchDocumentGenerationPlanId: plan.id,
        },
        select: { id: true, estado: true, contenidoFinal: true },
      });
      if (existing) {
        return {
          planId: plan.id,
          planStatus: plan.estado,
          tenantId: context.tenantId,
          document: existing,
        };
      }

      const [template, employee, tenant] = await Promise.all([
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
        prisma.tenant.findFirst({
          where: { id: context.tenantId },
          select: {
            nombre: true,
            razonSocial: true,
            nit: true,
            representanteLegal: true,
            logoUrl: true,
            firmaRepresentanteUrl: true,
          },
        }),
      ]);
      if (!template) throw new NotFoundException('Plantilla no encontrada');
      if (!employee) throw new NotFoundException('Empleado no encontrado');
      if (!tenant) throw new NotFoundException('Empresa no encontrada');

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
          EMPRESA: tenant.razonSocial ?? tenant.nombre,
          NIT: tenant.nit,
          REPRESENTANTE_LEGAL: tenant.representanteLegal ?? 'No definido',
          LOGO_EMPRESA: tenant.logoUrl
            ? `<img src="${tenant.logoUrl}" alt="Logo ${tenant.nombre}" />`
            : '',
          FIRMA_REPRESENTANTE: tenant.firmaRepresentanteUrl
            ? `<img src="${tenant.firmaRepresentanteUrl}" alt="Firma representante legal" />`
            : '',
        }),
        tipo: plan.tipoDocumental,
      };

      try {
        const document = await prisma.generatedDocument.create({
          data: documentData,
          select: { id: true, estado: true, contenidoFinal: true },
        });
        return {
          planId: plan.id,
          planStatus: plan.estado,
          tenantId: context.tenantId,
          document,
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
            select: { id: true, estado: true, contenidoFinal: true },
          });
          if (concurrent) {
            return {
              planId: plan.id,
              planStatus: plan.estado,
              tenantId: context.tenantId,
              document: concurrent,
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
