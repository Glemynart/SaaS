import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BatchDocumentGenerationPlanStatus,
  Contrato,
  LoteContrato,
  LoteProposito,
  Prisma,
} from '@prisma/client';
import { BatchDocumentGenerationService } from '../batch-document-generation/batch-document-generation.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { ContractsService } from '../contracts/contracts.service';
import { GeneratedDocumentsService } from '../generated-documents/generated-documents.service';
import { ExpedienteDocsService } from '../expediente-docs/expediente-docs.service';
import { CreateContractDto } from '../contracts/dto/create-contract.dto';
import {
  ContractPlanSnapshot,
  parseContractPlanSnapshot,
} from '../contracts/contract-plan-snapshot';

/**
 * Entrada del erroresLog del lote. Una por empleado fallido.
 */
interface LoteErrorEntry {
  empleadoId: string;
  cedula: string | null;
  error: string;
}

interface ConfirmedContractPlan {
  empleadoId: string;
  perfilContractualId: string;
  empleadoSnapshot: Prisma.JsonValue | null;
  contratoSnapshot: Prisma.JsonValue | null;
}

/**
 * LoteEngineService — Motor de reconciliación de lotes de contratos (N3A.4B Fase 1).
 *
 * Reconcilia cada empleado objetivo del lote hacia el estado "procesado":
 *
 *   Contrato existe  +  GeneratedDocument materializado  +  ExpedienteDoc publicado
 *
 * Máquina de estados por empleado:
 *
 *   S0  Contrato ausente                                  → crear contrato (ensureContrato)
 *   S1  Contrato presente                                  → asegurar identidad documental
 *   S2  GeneratedDocument presente                         → materializar PDF canónico
 *   S3  PDF materializado                                  → publicar índice en expediente
 *
 * Reglas: reutilizar servicios existentes, no duplicar lógica.
 *
 * Fuera de alcance en esta fase: ZIP, BullMQ, Redis, R2, StoredFile, migraciones.
 */
@Injectable()
export class LoteEngineService {
  private readonly logger = new Logger(LoteEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly contractsService: ContractsService,
    private readonly generatedDocumentsService: GeneratedDocumentsService,
    private readonly expedienteDocsService: ExpedienteDocsService,
    private readonly batchDocumentGenerationService: BatchDocumentGenerationService,
  ) {}

  /**
   * Procesa (reconcilia) un lote completo. Idempotente: re-ejecutar sobre un
   * lote ya procesado delega en la idempotencia de cada etapa documental.
   */
  async procesarLote(loteId: string) {
    const lote = await this.prisma.loteContrato.findUnique({
      where: { id: loteId },
    });
    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    if (lote.estado === 'EN_PROCESO') {
      this.logger.log(
        `Lote ${loteId} ya está EN_PROCESO, omitiendo re-ejecución`,
      );
      return lote;
    }

    const { empleadoIds, hasDocumentGenerationPlans, plansByEmployee } =
      await this.resolveProcessingTargets(lote);
    const acquired = await this.prisma.loteContrato.updateMany({
      where: { id: loteId, estado: lote.estado },
      data: {
        estado: 'EN_PROCESO',
        total: empleadoIds.length,
        iniciadoAt: new Date(),
        completadoAt: null,
        procesados: 0,
        fallidos: 0,
        erroresLog: [],
      },
    });

    if (acquired.count === 0) {
      this.logger.log(
        `Lote ${loteId} ya está EN_PROCESO, omitiendo re-ejecución`,
      );
      return this.prisma.loteContrato.findUnique({ where: { id: loteId } });
    }

    const userId = lote.creadoPorId ?? 'system';
    const errores: LoteErrorEntry[] = [];

    for (const empleadoId of empleadoIds) {
      try {
        const contrato = await this.ensureContrato(
          lote.tenantId,
          userId,
          lote,
          empleadoId,
          plansByEmployee.get(empleadoId),
        );
        const documentTemplateId = lote.documentTemplateId;
        if (!hasDocumentGenerationPlans && documentTemplateId) {
          await this.ensureDocumento(
            lote.tenantId,
            userId,
            contrato,
            documentTemplateId,
          );
        }

        // Incremento atómico → progreso visible en tiempo real para polling.
        await this.prisma.loteContrato.update({
          where: { id: loteId },
          data: { procesados: { increment: 1 } },
        });
      } catch (error) {
        const mensaje =
          error instanceof Error ? error.message : 'Error desconocido';
        this.logger.warn(
          `Lote ${loteId}: empleado ${empleadoId} falló — ${mensaje}`,
        );
        errores.push({
          empleadoId,
          cedula: await this.safeCedula(lote.tenantId, empleadoId),
          error: mensaje,
        });
        await this.prisma.loteContrato.update({
          where: { id: loteId },
          data: { fallidos: { increment: 1 } },
        });
      }
    }

    if (hasDocumentGenerationPlans && errores.length === 0) {
      try {
        await this.batchDocumentGenerationService.start(loteId);
      } catch (error) {
        const mensaje =
          error instanceof Error ? error.message : 'Error desconocido';
        this.logger.warn(
          `Lote ${loteId}: la generación documental falló — ${mensaje}`,
        );
        return this.prisma.loteContrato.update({
          where: { id: loteId },
          data: {
            estado: 'FALLIDO',
            completadoAt: new Date(),
            procesados: 0,
            fallidos: empleadoIds.length,
            erroresLog: [
              {
                empleadoId: 'BATCH_DOCUMENT_GENERATION',
                cedula: null,
                error: mensaje,
              },
            ],
          },
        });
      }
    }

    const procesados = empleadoIds.length - errores.length;
    const estado =
      errores.length === 0
        ? 'COMPLETADO'
        : procesados > 0
          ? 'COMPLETADO_CON_ERRORES'
          : 'FALLIDO';

    return this.prisma.loteContrato.update({
      where: { id: loteId },
      data: {
        estado,
        completadoAt: new Date(),
        erroresLog: errores as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Determina los objetivos efectivos del procesamiento.
   *
   * Los lotes manuales conservan el snapshot de empleados del lote. Una
   * campaña inteligente, en cambio, sólo puede avanzar sobre los planes que
   * la resolución confirmó: las filas de exclusión no son objetivos de
   * contrato ni de documento.
   */
  private async resolveProcessingTargets(lote: LoteContrato): Promise<{
    empleadoIds: string[];
    hasDocumentGenerationPlans: boolean;
    plansByEmployee: Map<string, ConfirmedContractPlan>;
  }> {
    const plans = await this.prisma.batchDocumentGenerationPlan.findMany({
      where: {
        tenantId: lote.tenantId,
        loteId: lote.id,
        estado: {
          in: [
            BatchDocumentGenerationPlanStatus.CONFIRMADO,
            BatchDocumentGenerationPlanStatus.CONSUMIDO,
          ],
        },
      },
      select: {
        empleadoId: true,
        perfilContractualId: true,
        empleadoSnapshot: true,
        contratoSnapshot: true,
      },
    });

    if (!lote.documentTemplateId) {
      if (lote.proposito !== LoteProposito.CONTRATACION) {
        throw new ConflictException(
          'Las campañas inteligentes requieren confirmación antes de procesarse.',
        );
      }
      if (plans.length === 0) {
        throw new ConflictException(
          'La campaña inteligente no tiene planes confirmados para procesar.',
        );
      }

      return {
        empleadoIds: Array.from(new Set(plans.map((plan) => plan.empleadoId))),
        hasDocumentGenerationPlans: true,
        plansByEmployee: new Map(plans.map((plan) => [plan.empleadoId, plan])),
      };
    }

    return {
      empleadoIds: await this.resolveTargets(lote),
      hasDocumentGenerationPlans: plans.length > 0,
      plansByEmployee: new Map(),
    };
  }

  /**
   * S0 → S1: garantiza que el contrato del empleado dentro del lote exista.
   * find-before-create. Reutiliza ContractsService.create() para construir el
   * variablesSnapshot canónico (requerido luego por generateDocument()).
   */
  async ensureContrato(
    tenantId: string,
    userId: string,
    lote: LoteContrato,
    empleadoId: string,
    plan?: ConfirmedContractPlan,
  ): Promise<Pick<Contrato, 'id' | 'empleadoId'>> {
    const existing = await this.prisma.contrato.findFirst({
      where: { tenantId, loteId: lote.id, empleadoId },
      select: { id: true, empleadoId: true },
    });
    if (existing) {
      return existing;
    }

    const historicalSnapshot: ContractPlanSnapshot | undefined = plan
      ? parseContractPlanSnapshot(plan.empleadoSnapshot, plan.contratoSnapshot)
      : undefined;

    const empleado = await this.tenantPrisma.execute((prisma) =>
      prisma.empleado.findFirst({
        where: { id: empleadoId, tenantId, deletedAt: null },
        select: {
          cargo: true,
          salario: true,
          tipoContrato: true,
          fechaIngreso: true,
        },
      }),
    );
    if (!empleado) {
      throw new NotFoundException(
        `Empleado ${empleadoId} no existe o no pertenece a la empresa`,
      );
    }

    const contractSnapshot = historicalSnapshot?.contrato;
    const fechaInicio = contractSnapshot
      ? new Date(contractSnapshot.fechaInicio)
      : (lote.fechaInicioContrato ?? empleado.fechaIngreso);

    const dto: CreateContractDto = {
      employeeId: empleadoId,
      cargo: contractSnapshot?.cargo ?? empleado.cargo,
      salario: Number(contractSnapshot?.salario ?? empleado.salario),
      tipo: (contractSnapshot?.tipo ??
        lote.tipoContrato ??
        empleado.tipoContrato) as CreateContractDto['tipo'],
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: contractSnapshot
        ? (contractSnapshot.fechaFin ?? undefined)
        : lote.fechaFinContrato?.toISOString(),
      sedeId: contractSnapshot?.sedeId ?? lote.sedeId ?? undefined,
    };

    try {
      const created = await this.contractsService.create(
        tenantId,
        userId,
        dto,
        lote.id,
        plan && historicalSnapshot
          ? {
              perfilContractualId: plan.perfilContractualId,
              historicalSnapshot,
            }
          : undefined,
      );
      return { id: created.id, empleadoId };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrentContract = await this.prisma.contrato.findFirst({
          where: { tenantId, loteId: lote.id, empleadoId },
          select: { id: true, empleadoId: true },
        });
        if (concurrentContract) {
          return concurrentContract;
        }
      }
      throw error;
    }
  }

  /**
   * Orquesta exclusivamente los contratos de dominio de 6C.2–6C.4. La
   * plantilla pertenece al snapshot inmutable del lote; cada servicio conserva
   * su propia idempotencia y responsabilidad.
   */
  async ensureDocumento(
    tenantId: string,
    userId: string,
    contrato: Pick<Contrato, 'id'>,
    templateId: string,
  ): Promise<void> {
    const { document } = await this.contractsService.ensureGeneratedDocument(
      tenantId,
      contrato.id,
      templateId,
    );
    const materialized = await this.generatedDocumentsService.materializePdf(
      tenantId,
      document.id,
    );
    await this.expedienteDocsService.publishGeneratedDocument(
      tenantId,
      userId,
      document.id,
      materialized,
    );
  }

  /**
   * Determina el conjunto de empleados objetivo del lote.
   * Preferencia: configuracion.empleadoIds (snapshot al crear el lote);
   * fallback: empleados de los contratos ya vinculados al lote.
   */
  private async resolveTargets(lote: LoteContrato): Promise<string[]> {
    const config = (lote.configuracion ?? {}) as { empleadoIds?: unknown };
    const fromConfig = Array.isArray(config.empleadoIds)
      ? config.empleadoIds.filter((id): id is string => typeof id === 'string')
      : [];

    if (fromConfig.length > 0) {
      return Array.from(new Set(fromConfig));
    }

    const contratos = await this.prisma.contrato.findMany({
      where: { tenantId: lote.tenantId, loteId: lote.id },
      select: { empleadoId: true },
    });
    return Array.from(new Set(contratos.map((c) => c.empleadoId)));
  }

  private async safeCedula(
    tenantId: string,
    empleadoId: string,
  ): Promise<string | null> {
    const empleado = await this.tenantPrisma
      .execute((prisma) =>
        prisma.empleado.findFirst({
          where: { id: empleadoId, tenantId },
          select: { cedula: true },
        }),
      )
      .catch(() => null);
    return empleado?.cedula ?? null;
  }
}
