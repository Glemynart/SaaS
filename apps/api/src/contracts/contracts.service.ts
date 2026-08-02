import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DocumentTemplate, GeneratedDocument, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { AuditService } from '../audit/audit.service';
import { GeneratedDocumentsService } from '../generated-documents/generated-documents.service';
import { ExpedienteDocsService } from '../expediente-docs/expediente-docs.service';
import { ContractQueryDto } from './dto/contract-query.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import {
  UpdateContractStatusDto,
  ContratoEstado as ContratoEstadoEnum,
} from './dto/update-contract-status.dto';
import { GenerateContractDocumentDto } from './dto/generate-contract-document.dto';
import { ContractPlanSnapshot } from './contract-plan-snapshot';

export interface ContractVariablesSnapshot {
  empleado: {
    nombreCompleto: string;
    primerNombre: string;
    segundoNombre: string | null;
    primerApellido: string;
    segundoApellido: string | null;
    tipoDocumento: string;
    cedula: string;
  };
  contrato: {
    cargo: string;
    salario: string;
    tipo: string;
    fechaInicio: string;
    fechaFin: string | null;
  };
  empresa: {
    nombre: string;
    razonSocial: string;
    nit: string;
    representanteLegal: string | null;
  };
  sede: {
    nombre: string;
  } | null;
  metadata: {
    generatedAt: string;
    version: number;
  };
}

export interface EnsureGeneratedDocumentResult {
  outcome: 'CREATED' | 'EXISTING';
  document: GeneratedDocument;
}

export interface ContractCreationOptions {
  perfilContractualId?: string;
  historicalSnapshot?: ContractPlanSnapshot;
}

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private auditService: AuditService,
    private generatedDocumentsService: GeneratedDocumentsService,
    private expedienteDocsService: ExpedienteDocsService,
  ) {}

  async findAll(tenantId: string, query: ContractQueryDto) {
    const { page = 1, limit = 10, search, employeeId, estado } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ContratoWhereInput = {
      tenantId,
      ...(estado && { estado }),
      ...(employeeId && { empleadoId: employeeId }),
    };

    if (search) {
      where.OR = [
        { cargo: { contains: search, mode: 'insensitive' } },
        {
          empleado: { primerNombre: { contains: search, mode: 'insensitive' } },
        },
        {
          empleado: {
            primerApellido: { contains: search, mode: 'insensitive' },
          },
        },
        { empleado: { cedula: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return this.tenantPrisma.execute(async (prisma) => {
      const [data, total] = await Promise.all([
        prisma.contrato.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            empleado: {
              select: {
                id: true,
                primerNombre: true,
                segundoNombre: true,
                primerApellido: true,
                segundoApellido: true,
                cedula: true,
                cargo: true,
              },
            },
            sede: { select: { id: true, nombre: true } },
          },
        }),
        prisma.contrato.count({ where }),
      ]);

      return {
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    });
  }

  async findOne(tenantId: string, id: string) {
    const contract = await this.tenantPrisma.execute((prisma) =>
      prisma.contrato.findFirst({
        where: { id, tenantId },
        include: {
          empleado: {
            select: {
              id: true,
              primerNombre: true,
              segundoNombre: true,
              primerApellido: true,
              segundoApellido: true,
              cedula: true,
              cargo: true,
              tipoDocumento: true,
            },
          },
          sede: { select: { id: true, nombre: true } },
          plantilla: { select: { id: true, nombre: true } },
          lote: { select: { id: true, estado: true } },
          generatedDocuments: {
            where: { tenantId, tipo: 'CONTRACT' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              nombre: true,
              pdfStorageKey: true,
              pdfUrl: true,
              expedienteDocs: {
                where: { tenantId },
                take: 1,
                select: { id: true },
              },
            },
          },
        },
      }),
    );

    if (!contract) throw new NotFoundException('Contrato no encontrado');
    const { generatedDocuments, ...contractDetail } = contract;
    const generatedDocument = generatedDocuments?.[0];

    return {
      ...contractDetail,
      generatedDocument: generatedDocument
        ? {
            id: generatedDocument.id,
            nombre: generatedDocument.nombre,
            pdfStorageKey: generatedDocument.pdfStorageKey,
            pdfUrl: generatedDocument.pdfUrl,
            expedienteDocId: generatedDocument.expedienteDocs[0]?.id ?? null,
          }
        : null,
    };
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateContractDto,
    loteId?: string,
    options?: ContractCreationOptions,
  ) {
    const employee = await this.validateEmployee(tenantId, dto.employeeId);

    const historicalEmployee = options?.historicalSnapshot?.empleado;
    const historicalContract = options?.historicalSnapshot?.contrato;
    if (historicalEmployee && historicalEmployee.id !== dto.employeeId) {
      throw new BadRequestException(
        'El snapshot del empleado no coincide con el contrato.',
      );
    }

    if (options?.perfilContractualId) {
      const profile = await this.prisma.perfilContractual.findFirst({
        where: { id: options.perfilContractualId, tenantId },
        select: { id: true },
      });
      if (!profile) {
        throw new BadRequestException(
          'El perfil contractual no existe o no pertenece a esta empresa.',
        );
      }
    }

    const effectiveContract = historicalContract ?? {
      cargo: dto.cargo,
      salario: String(dto.salario),
      tipo: dto.tipo,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin ?? null,
      sedeId: dto.sedeId ?? null,
      sede: null,
    };
    const salario = Number(effectiveContract.salario);
    if (!Number.isFinite(salario) || salario < 0) {
      throw new BadRequestException('El salario del contrato no es válido.');
    }

    const fechaInicio = new Date(effectiveContract.fechaInicio);
    const fechaFin = effectiveContract.fechaFin
      ? new Date(effectiveContract.fechaFin)
      : null;
    if (
      Number.isNaN(fechaInicio.getTime()) ||
      (fechaFin && Number.isNaN(fechaFin.getTime()))
    ) {
      throw new BadRequestException('Las fechas del contrato no son válidas.');
    }

    let sede: { id: string; nombre: string } | null = null;
    if (effectiveContract.sedeId) {
      sede = await this.validateSede(tenantId, effectiveContract.sedeId);
    }

    if (fechaFin && fechaFin <= fechaInicio) {
      throw new BadRequestException(
        'La fecha de fin debe ser posterior a la fecha de inicio.',
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        nombre: true,
        razonSocial: true,
        nit: true,
        representanteLegal: true,
      },
    });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');

    const snapshotEmployee = historicalEmployee ?? {
      ...employee,
      segundoNombre: employee.segundoNombre,
      segundoApellido: employee.segundoApellido,
    };
    const snapshotSede =
      historicalContract?.sede ??
      (sede ? { id: sede.id, nombre: sede.nombre } : null);
    const snapshot: ContractVariablesSnapshot = {
      empleado: {
        nombreCompleto: [
          snapshotEmployee.primerNombre,
          snapshotEmployee.segundoNombre,
          snapshotEmployee.primerApellido,
          snapshotEmployee.segundoApellido,
        ]
          .filter((v) => v?.trim())
          .join(' '),
        primerNombre: snapshotEmployee.primerNombre,
        segundoNombre: snapshotEmployee.segundoNombre,
        primerApellido: snapshotEmployee.primerApellido,
        segundoApellido: snapshotEmployee.segundoApellido,
        tipoDocumento: snapshotEmployee.tipoDocumento,
        cedula: snapshotEmployee.cedula,
      },
      contrato: {
        cargo: effectiveContract.cargo,
        salario: String(effectiveContract.salario),
        tipo: effectiveContract.tipo,
        fechaInicio: effectiveContract.fechaInicio,
        fechaFin: effectiveContract.fechaFin,
      },
      empresa: {
        nombre: tenant.nombre,
        razonSocial: tenant.razonSocial,
        nit: tenant.nit,
        representanteLegal: tenant.representanteLegal,
      },
      sede: snapshotSede ? { nombre: snapshotSede.nombre } : null,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: 1,
      },
    };

    const data = {
      tenantId,
      empleadoId: dto.employeeId,
      cargo: effectiveContract.cargo,
      salario,
      tipo: effectiveContract.tipo as CreateContractDto['tipo'],
      fechaInicio,
      fechaFin,
      sedeId: effectiveContract.sedeId,
      loteId: loteId ?? null,
      perfilContractualId: options?.perfilContractualId ?? null,
      estado: 'VIGENTE' as const,
      variablesSnapshot: snapshot as unknown as Prisma.JsonValue,
    } as Prisma.ContratoUncheckedCreateInput;

    const contract = await this.tenantPrisma.execute((prisma) =>
      prisma.contrato.create({
        data,
        include: {
          empleado: {
            select: {
              id: true,
              primerNombre: true,
              primerApellido: true,
              cedula: true,
            },
          },
          sede: { select: { id: true, nombre: true } },
        },
      }),
    );

    this.auditService
      .log({
        tenantId,
        userId,
        action: 'CONTRACT_CREATE',
        entityType: 'Contrato',
        entityId: contract.id,
        metadata: { cargo: contract.cargo, tipo: contract.tipo },
      })
      .catch(() => {});

    return contract;
  }

  async updateStatus(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateContractStatusDto,
  ) {
    const contract = await this.findOne(tenantId, id);

    const estadoAnterior = contract.estado;
    const estadoNuevo = dto.estado;

    if (estadoAnterior === estadoNuevo) {
      throw new BadRequestException(
        'El contrato ya se encuentra en este estado.',
      );
    }

    const VALID_TRANSITIONS: Record<string, string[]> = {
      VIGENTE: ['VENCIDO', 'TERMINADO', 'RENOVADO'],
      VENCIDO: ['RENOVADO'],
    };

    const allowed = VALID_TRANSITIONS[estadoAnterior];
    if (!allowed || !allowed.includes(estadoNuevo)) {
      throw new BadRequestException(
        `No se puede cambiar un contrato de "${estadoAnterior}" a "${estadoNuevo}".`,
      );
    }

    if (
      ['VENCIDO', 'TERMINADO', 'RENOVADO'].includes(estadoNuevo) &&
      !this.isPublishedContractDocument(contract.generatedDocument)
    ) {
      throw new BadRequestException(
        'El contrato debe tener un documento contractual publicado antes de pasar a un estado terminal.',
      );
    }

    const updated = await this.prisma.contrato.update({
      where: { id, tenantId },
      data: {
        estado: estadoNuevo as 'VIGENTE' | 'VENCIDO' | 'TERMINADO' | 'RENOVADO',
      },
    });

    this.auditService
      .log({
        tenantId,
        userId,
        action: 'CONTRACT_STATUS_CHANGE',
        entityType: 'Contrato',
        entityId: id,
        metadata: { estadoAnterior, estadoNuevo },
      })
      .catch(() => {});

    return updated;
  }

  async findByEmployee(tenantId: string, employeeId: string) {
    const employee = await this.tenantPrisma.execute((prisma) =>
      prisma.empleado.findFirst({
        where: { id: employeeId, tenantId, deletedAt: null },
      }),
    );
    if (!employee) throw new NotFoundException('Empleado no encontrado.');

    return this.prisma.contrato.findMany({
      where: { tenantId, empleadoId: employeeId },
      select: {
        id: true,
        tipo: true,
        estado: true,
        cargo: true,
        salario: true,
        fechaInicio: true,
        fechaFin: true,
        createdAt: true,
      },
      orderBy: { fechaInicio: 'desc' },
    });
  }

  /**
   * Orquesta la identidad documental contractual sin materializar archivos.
   * Reintentar devuelve el documento existente del contrato, sin crear otra
   * versión ni invocar el motor PDF.
   */
  async ensureGeneratedDocument(
    tenantId: string,
    contratoId: string,
    templateId?: string,
  ): Promise<EnsureGeneratedDocumentResult> {
    const contract = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId },
      include: { empleado: { select: { deletedAt: true } } },
    });
    if (!contract) {
      throw new NotFoundException('Contrato no encontrado');
    }

    const existing = await this.prisma.generatedDocument.findFirst({
      where: { contratoId: contract.id, tenantId },
    });
    if (existing) {
      return { outcome: 'EXISTING', document: existing };
    }

    this.assertDocumentEligibility(contract);

    const template = await this.resolveTemplate(tenantId, templateId);

    try {
      return {
        outcome: 'CREATED',
        document: await this.createGeneratedDocument(
          tenantId,
          contract,
          template,
        ),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrentDocument =
          await this.prisma.generatedDocument.findFirst({
            where: { contratoId: contract.id, tenantId },
          });
        if (concurrentDocument) {
          return { outcome: 'EXISTING', document: concurrentDocument };
        }
      }
      throw error;
    }
  }

  async generateDocument(
    tenantId: string,
    userId: string,
    contratoId: string,
    dto?: GenerateContractDocumentDto,
  ) {
    const { document } = await this.ensureGeneratedDocument(
      tenantId,
      contratoId,
      dto?.templateId,
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

    return {
      id: document.id,
      pdfUrl: materialized.pdfUrl,
      nombre: document.nombre,
    };
  }

  private async resolveTemplate(tenantId: string, templateId?: string) {
    if (templateId) {
      const template = await this.prisma.documentTemplate.findFirst({
        where: { id: templateId, tenantId, deletedAt: null },
      });
      if (!template) {
        throw new NotFoundException('Plantilla no encontrada');
      }
      if (template.tipo !== 'CONTRACT') {
        throw new BadRequestException('La plantilla debe ser de tipo CONTRACT');
      }
      if (!template.activo) {
        throw new BadRequestException('La plantilla está inactiva');
      }
      return template;
    }

    const templates = await this.prisma.documentTemplate.findMany({
      where: { tenantId, tipo: 'CONTRACT', activo: true, deletedAt: null },
    });
    if (templates.length === 0) {
      throw new NotFoundException(
        'No hay plantilla de contrato activa para esta empresa',
      );
    }
    if (templates.length > 1) {
      throw new BadRequestException(
        `Existen ${templates.length} plantillas CONTRACT activas. Indique templateId para seleccionar una.`,
      );
    }
    return templates[0];
  }

  private async createGeneratedDocument(
    tenantId: string,
    contract: {
      id: string;
      empleadoId: string;
      variablesSnapshot: Prisma.JsonValue;
    },
    template: Pick<DocumentTemplate, 'id' | 'tipo' | 'contenido'>,
  ): Promise<GeneratedDocument> {
    this.validateSnapshot(contract.variablesSnapshot, contract.id);
    const snapshot =
      contract.variablesSnapshot as unknown as ContractVariablesSnapshot;

    return this.prisma.generatedDocument.create({
      data: {
        tenantId,
        employeeId: contract.empleadoId,
        templateId: template.id,
        contratoId: contract.id,
        nombre: `Contrato — ${snapshot.empleado.nombreCompleto}`,
        contenidoFinal: this.buildContentFromSnapshot(
          template.contenido,
          snapshot,
        ),
        tipo: template.tipo,
      },
    });
  }

  private assertDocumentEligibility(contract: {
    estado: string;
    empleado: { deletedAt: Date | null };
  }): void {
    if (contract.estado !== 'VIGENTE') {
      throw new BadRequestException(
        'Solo se puede generar el documento de un contrato VIGENTE.',
      );
    }

    if (contract.empleado.deletedAt !== null) {
      throw new BadRequestException(
        'No se puede generar un documento para un empleado eliminado.',
      );
    }
  }

  private isPublishedContractDocument(
    document: {
      pdfStorageKey: string | null;
      pdfUrl: string | null;
      expedienteDocId: string | null;
    } | null,
  ): boolean {
    return Boolean(
      document?.pdfStorageKey && document.pdfUrl && document.expedienteDocId,
    );
  }

  private buildContentFromSnapshot(
    templateContent: string,
    snapshot: ContractVariablesSnapshot,
  ): string {
    const salarioNum = Number(snapshot.contrato.salario);
    const salarioFormatted = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(salarioNum);

    const tipoLabels: Record<string, string> = {
      TERMINO_FIJO: 'Término Fijo',
      TERMINO_INDEFINIDO: 'Término Indefinido',
      OBRA_LABOR: 'Obra o Labor',
      APRENDIZAJE: 'Aprendizaje',
      PRESTACION_SERVICIOS: 'Prestación de Servicios',
    };

    const fechaIngreso = new Date(
      snapshot.contrato.fechaInicio,
    ).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const variables: Record<string, string> = {
      NOMBRE_COMPLETO: snapshot.empleado.nombreCompleto,
      DOCUMENTO: `${snapshot.empleado.tipoDocumento} ${snapshot.empleado.cedula}`,
      CARGO: snapshot.contrato.cargo,
      SALARIO: salarioFormatted,
      TIPO_CONTRATO:
        tipoLabels[snapshot.contrato.tipo] ??
        snapshot.contrato.tipo.replace(/_/g, ' '),
      FECHA_INGRESO: fechaIngreso,
      SEDE: snapshot.sede?.nombre ?? '',
      EMPRESA: snapshot.empresa.razonSocial ?? snapshot.empresa.nombre,
      NIT: snapshot.empresa.nit,
      REPRESENTANTE_LEGAL: snapshot.empresa.representanteLegal ?? 'No definido',
      LOGO_EMPRESA: '',
      FIRMA_REPRESENTANTE: '',
    };

    let result = templateContent;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }

  private validateSnapshot(snapshot: unknown, contratoId: string): void {
    const s = snapshot as Record<string, unknown> | null | undefined;
    const hasShape =
      s &&
      typeof s === 'object' &&
      typeof (s as any).metadata?.version === 'number' &&
      typeof (s as any).empleado?.nombreCompleto === 'string' &&
      typeof (s as any).empleado?.cedula === 'string' &&
      typeof (s as any).contrato?.cargo === 'string' &&
      typeof (s as any).contrato?.salario === 'string' &&
      typeof (s as any).empresa?.nit === 'string';

    if (!hasShape) {
      throw new BadRequestException(
        `El contrato ${contratoId} tiene un variablesSnapshot incompatible con la generación de documentos. ` +
          'Fue creado antes de N3A.1 o tiene datos corruptos. Contacte soporte.',
      );
    }
  }

  private async validateEmployee(tenantId: string, employeeId: string) {
    const emp = await this.tenantPrisma.execute((prisma) =>
      prisma.empleado.findFirst({
        where: { id: employeeId, tenantId, deletedAt: null },
        select: {
          id: true,
          primerNombre: true,
          segundoNombre: true,
          primerApellido: true,
          segundoApellido: true,
          tipoDocumento: true,
          cedula: true,
        },
      }),
    );
    if (!emp)
      throw new BadRequestException(
        'El empleado no existe o no pertenece a esta empresa.',
      );
    return emp;
  }

  private async validateSede(tenantId: string, sedeId: string) {
    const sede = await this.prisma.sede.findFirst({
      where: { id: sedeId, tenantId },
      select: { id: true, nombre: true },
    });
    if (!sede)
      throw new BadRequestException(
        'La sede no existe o no pertenece a esta empresa.',
      );
    return sede;
  }
}
