import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Contrato, LoteContrato, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { ContractsService } from '../contracts/contracts.service';
import { GeneratedDocumentsService } from '../generated-documents/generated-documents.service';
import { ExpedienteDocsService } from '../expediente-docs/expediente-docs.service';
import { CreateContractDto } from '../contracts/dto/create-contract.dto';

/**
 * Entrada del erroresLog del lote. Una por empleado fallido.
 */
interface LoteErrorEntry {
  empleadoId: string;
  cedula: string | null;
  error: string;
}

/**
 * LoteEngineService — Motor de reconciliación de lotes de contratos (N3A.4B Fase 1).
 *
 * Reconcilia cada empleado objetivo del lote hacia el estado "procesado":
 *
 *   Contrato existe  +  GeneratedDocument.pdfUrl != null  +  ExpedienteDoc existe
 *
 * Máquina de estados por empleado:
 *
 *   S0  Contrato ausente                                  → crear contrato (ensureContrato)
 *   S1  Contrato presente / GeneratedDocument ausente     → generar documento + PDF + expediente
 *   S2  GeneratedDocument presente / pdfUrl null           → limpiar y regenerar
 *   S3  pdfUrl != null / ExpedienteDoc presente            → skip (ya procesado)
 *   S4  pdfUrl != null / ExpedienteDoc ausente             → reparar sin regenerar PDF
 *
 * Reglas: find-before-create, reutilizar servicios existentes, no duplicar lógica.
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
  ) {}

  /**
   * Procesa (reconcilia) un lote completo. Idempotente: re-ejecutar sobre un
   * lote ya procesado no regenera PDFs (los empleados en S3 se omiten).
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

    const empleadoIds = await this.resolveTargets(lote);
    const userId = lote.creadoPorId ?? 'system';

    await this.prisma.loteContrato.update({
      where: { id: loteId },
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

    const errores: LoteErrorEntry[] = [];

    for (const empleadoId of empleadoIds) {
      try {
        const contrato = await this.ensureContrato(
          lote.tenantId,
          userId,
          lote,
          empleadoId,
        );
        await this.ensureDocumento(lote.tenantId, userId, contrato);

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
        erroresLog: errores as unknown as object[],
      },
    });
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
  ): Promise<Pick<Contrato, 'id' | 'empleadoId'>> {
    const existing = await this.prisma.contrato.findFirst({
      where: { tenantId, loteId: lote.id, empleadoId },
      select: { id: true, empleadoId: true },
    });
    if (existing) {
      return existing;
    }

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

    const fechaInicio = lote.fechaInicioContrato ?? empleado.fechaIngreso;

    const dto: CreateContractDto = {
      employeeId: empleadoId,
      cargo: empleado.cargo,
      salario: Number(empleado.salario),
      tipo: (lote.tipoContrato ??
        empleado.tipoContrato) as CreateContractDto['tipo'],
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: lote.fechaFinContrato?.toISOString(),
      sedeId: lote.sedeId ?? undefined,
    };

    const created = await this.contractsService.create(
      tenantId,
      userId,
      dto,
      lote.id,
    );
    return { id: created.id, empleadoId };
  }

  /**
   * Reconcilia el GeneratedDocument + ExpedienteDoc del contrato según la
   * máquina de estados (S1–S4).
   */
  async ensureDocumento(
    tenantId: string,
    userId: string,
    contrato: Pick<Contrato, 'id'>,
  ): Promise<void> {
    const genDoc = await this.prisma.generatedDocument.findFirst({
      where: { tenantId, contratoId: contrato.id },
      select: {
        id: true,
        pdfUrl: true,
        employeeId: true,
        nombre: true,
        tipo: true,
        contratoId: true,
      },
    });

    // S1: GeneratedDocument ausente → generar documento + PDF + expediente.
    if (!genDoc) {
      try {
        await this.contractsService.generateDocument(
          tenantId,
          userId,
          contrato.id,
        );
      } catch (error) {
        if (error instanceof ConflictException) {
          this.logger.log(
            `Contrato ${contrato.id}: GeneratedDocument ya creado por otro proceso, omitiendo`,
          );
          return;
        }
        throw error;
      }
      return;
    }

    // S2: GeneratedDocument presente con pdfUrl null (PDF incompleto) →
    // limpiar el documento huérfano y regenerar desde cero.
    if (genDoc.pdfUrl == null) {
      await this.generatedDocumentsService.remove(tenantId, genDoc.id);
      try {
        await this.contractsService.generateDocument(
          tenantId,
          userId,
          contrato.id,
        );
      } catch (error) {
        if (error instanceof ConflictException) {
          this.logger.log(
            `Contrato ${contrato.id}: GeneratedDocument ya creado por otro proceso, omitiendo`,
          );
          return;
        }
        throw error;
      }
      return;
    }

    // pdfUrl != null → comprobar expediente.
    const expediente = await this.prisma.expedienteDoc.findFirst({
      where: { tenantId, generatedDocumentId: genDoc.id },
      select: { id: true },
    });

    // S3: ExpedienteDoc presente → ya procesado, skip.
    if (expediente) {
      return;
    }

    // S4: pdfUrl != null pero ExpedienteDoc ausente → reparar SIN regenerar PDF.
    try {
      await this.expedienteDocsService.createFromGeneratedDoc(
        tenantId,
        genDoc.id,
        genDoc.employeeId,
        genDoc.nombre,
        genDoc.tipo,
        undefined,
        genDoc.contratoId,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.log(
          `GenDoc ${genDoc.id}: ExpedienteDoc ya creado por otro proceso, omitiendo`,
        );
        return;
      }
      throw error;
    }
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
