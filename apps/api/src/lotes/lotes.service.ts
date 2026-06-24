import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LoteEstado, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoteEngineService } from './lote-engine.service';
import { CreateLoteDto } from './dto/create-lote.dto';
import { LoteQueryDto } from './dto/lote-query.dto';

/**
 * LotesService — Capa de aplicación (API) sobre LoteEngineService (N3A.5).
 *
 * Responsabilidades:
 *   - Persistir el lote (snapshot de empleados objetivo en `configuracion`).
 *   - Listar / obtener / consultar progreso (multi-tenant).
 *   - Disparar el procesamiento y el retry delegando en LoteEngineService.
 *
 * NO contiene lógica de reconciliación: todo el trabajo S0–S4 vive en el
 * motor (procesarLote). Esta capa solo valida tenant + estado y delega.
 */
@Injectable()
export class LotesService {
  private readonly logger = new Logger(LotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly engine: LoteEngineService,
  ) {}

  /**
   * Crea un lote en estado PENDIENTE. Los empleados objetivo se guardan en
   * `configuracion.empleadoIds` (lo que el motor lee vía resolveTargets), y la
   * configuración común se refleja tanto en columnas dedicadas como dentro de
   * `configuracion` para tener un snapshot completo e inmutable.
   */
  async create(tenantId: string, userId: string, dto: CreateLoteDto) {
    const plantilla = await this.prisma.plantilla.findFirst({
      where: { id: dto.templateId, tenantId },
      select: { id: true, tipo: true, activa: true },
    });
    if (!plantilla) {
      throw new BadRequestException(
        'La plantilla no existe o no pertenece a esta empresa.',
      );
    }
    if (plantilla.tipo !== 'CONTRATO') {
      throw new BadRequestException('La plantilla debe ser de tipo CONTRATO.');
    }
    if (!plantilla.activa) {
      throw new BadRequestException('La plantilla está inactiva.');
    }

    if (dto.sedeId) {
      const sede = await this.prisma.sede.findFirst({
        where: { id: dto.sedeId, tenantId },
        select: { id: true },
      });
      if (!sede) {
        throw new BadRequestException(
          'La sede no existe o no pertenece a esta empresa.',
        );
      }
    }

    if (dto.fechaInicio && dto.fechaFin) {
      if (new Date(dto.fechaFin) <= new Date(dto.fechaInicio)) {
        throw new BadRequestException(
          'La fecha de fin debe ser posterior a la fecha de inicio.',
        );
      }
    }

    const empleadoIds = Array.from(new Set(dto.empleadoIds));

    const configuracion = {
      empleadoIds,
      tipoContrato: dto.tipoContrato ?? null,
      fechaInicioContrato: dto.fechaInicio ?? null,
      fechaFinContrato: dto.fechaFin ?? null,
      sedeId: dto.sedeId ?? null,
    };

    const lote = await this.prisma.loteContrato.create({
      data: {
        tenantId,
        plantillaId: dto.templateId,
        creadoPorId: userId,
        nombreLote: dto.nombre,
        tipoContrato: dto.tipoContrato ?? null,
        fechaInicioContrato: dto.fechaInicio ? new Date(dto.fechaInicio) : null,
        fechaFinContrato: dto.fechaFin ? new Date(dto.fechaFin) : null,
        sedeId: dto.sedeId ?? null,
        estado: LoteEstado.PENDIENTE,
        total: empleadoIds.length,
        configuracion: configuracion as unknown as Prisma.InputJsonValue,
      },
    });

    this.auditService
      .log({
        tenantId,
        userId,
        action: 'LOTE_CREATE',
        entityType: 'LoteContrato',
        entityId: lote.id,
        metadata: {
          nombre: dto.nombre,
          plantillaId: dto.templateId,
          total: empleadoIds.length,
        },
      })
      .catch(() => {});

    return lote;
  }

  async findAll(tenantId: string, query: LoteQueryDto) {
    const { page = 1, limit = 10, search, estado } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LoteContratoWhereInput = {
      tenantId,
      ...(estado && { estado }),
      ...(search && {
        nombreLote: { contains: search, mode: 'insensitive' },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.loteContrato.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          plantilla: { select: { id: true, nombre: true } },
          sede: { select: { id: true, nombre: true } },
          _count: { select: { contratos: true } },
        },
      }),
      this.prisma.loteContrato.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const lote = await this.prisma.loteContrato.findFirst({
      where: { id, tenantId },
      include: {
        plantilla: { select: { id: true, nombre: true } },
        sede: { select: { id: true, nombre: true } },
        creadoPor: { select: { id: true, nombre: true, email: true } },
        _count: { select: { contratos: true } },
      },
    });
    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }
    return lote;
  }

  /**
   * Progreso liviano del lote para polling. No incluye relaciones pesadas.
   */
  async getProgress(tenantId: string, id: string) {
    const lote = await this.prisma.loteContrato.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        estado: true,
        total: true,
        procesados: true,
        fallidos: true,
        iniciadoAt: true,
        completadoAt: true,
        erroresLog: true,
      },
    });
    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    const porcentaje =
      lote.total > 0
        ? Math.round(((lote.procesados + lote.fallidos) / lote.total) * 100)
        : 0;

    return { ...lote, porcentaje };
  }

  /**
   * Dispara el procesamiento manual del lote.
   * Carga el lote (multi-tenant), valida que no esté EN_PROCESO y delega en
   * el motor. La reconciliación es idempotente, así que re-disparar un lote ya
   * completado es seguro (los empleados en S3 se omiten).
   */
  async process(tenantId: string, userId: string, id: string) {
    const lote = await this.ensureTenantLote(tenantId, id);

    if (lote.estado === LoteEstado.EN_PROCESO) {
      throw new ConflictException(
        'El lote ya está en proceso. Espere a que finalice.',
      );
    }

    this.auditService
      .log({
        tenantId,
        userId,
        action: 'LOTE_PROCESS',
        entityType: 'LoteContrato',
        entityId: id,
        metadata: { estadoPrevio: lote.estado },
      })
      .catch(() => {});

    return this.engine.procesarLote(id);
  }

  /**
   * Reprocesa un lote fallido o completado con errores. La reconciliación
   * idempotente del motor sólo reintenta los empleados aún no procesados.
   */
  async retry(tenantId: string, userId: string, id: string) {
    const lote = await this.ensureTenantLote(tenantId, id);

    const RETRYABLE: LoteEstado[] = [
      LoteEstado.FALLIDO,
      LoteEstado.COMPLETADO_CON_ERRORES,
    ];

    if (!RETRYABLE.includes(lote.estado)) {
      throw new ConflictException(
        `No se puede reintentar un lote en estado "${lote.estado}". ` +
          'Solo se permite sobre FALLIDO o COMPLETADO_CON_ERRORES.',
      );
    }

    this.auditService
      .log({
        tenantId,
        userId,
        action: 'LOTE_RETRY',
        entityType: 'LoteContrato',
        entityId: id,
        metadata: { estadoPrevio: lote.estado },
      })
      .catch(() => {});

    return this.engine.procesarLote(id);
  }

  /** Carga el lote validando pertenencia al tenant. */
  private async ensureTenantLote(tenantId: string, id: string) {
    const lote = await this.prisma.loteContrato.findFirst({
      where: { id, tenantId },
      select: { id: true, estado: true },
    });
    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }
    return lote;
  }
}
