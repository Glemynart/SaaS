import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GeneratedDocumentsService } from '../generated-documents/generated-documents.service';
import { ContractQueryDto } from './dto/contract-query.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import {
  UpdateContractStatusDto,
  ContratoEstado as ContratoEstadoEnum,
} from './dto/update-contract-status.dto';
import { GenerateContractDocumentDto } from './dto/generate-contract-document.dto';

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

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private generatedDocumentsService: GeneratedDocumentsService,
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

    const [data, total] = await Promise.all([
      this.prisma.contrato.findMany({
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
      this.prisma.contrato.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const contract = await this.prisma.contrato.findFirst({
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
      },
    });

    if (!contract) throw new NotFoundException('Contrato no encontrado');
    return contract;
  }

  async create(tenantId: string, userId: string, dto: CreateContractDto) {
    const employee = await this.validateEmployee(tenantId, dto.employeeId);

    let sede: { id: string; nombre: string } | null = null;
    if (dto.sedeId) {
      sede = await this.validateSede(tenantId, dto.sedeId);
    }

    if (dto.fechaFin) {
      const inicio = new Date(dto.fechaInicio);
      const fin = new Date(dto.fechaFin);
      if (fin <= inicio) {
        throw new BadRequestException(
          'La fecha de fin debe ser posterior a la fecha de inicio.',
        );
      }
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

    const snapshot: ContractVariablesSnapshot = {
      empleado: {
        nombreCompleto: [
          employee.primerNombre,
          employee.segundoNombre,
          employee.primerApellido,
          employee.segundoApellido,
        ]
          .filter((v) => v?.trim())
          .join(' '),
        primerNombre: employee.primerNombre,
        segundoNombre: employee.segundoNombre,
        primerApellido: employee.primerApellido,
        segundoApellido: employee.segundoApellido,
        tipoDocumento: employee.tipoDocumento,
        cedula: employee.cedula,
      },
      contrato: {
        cargo: dto.cargo,
        salario: String(dto.salario),
        tipo: dto.tipo,
        fechaInicio: dto.fechaInicio,
        fechaFin: dto.fechaFin ?? null,
      },
      empresa: {
        nombre: tenant.nombre,
        razonSocial: tenant.razonSocial,
        nit: tenant.nit,
        representanteLegal: tenant.representanteLegal,
      },
      sede: sede ? { nombre: sede.nombre } : null,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: 1,
      },
    };

    const data = {
      tenantId,
      empleadoId: dto.employeeId,
      cargo: dto.cargo,
      salario: dto.salario,
      tipo: dto.tipo,
      fechaInicio: new Date(dto.fechaInicio),
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
      sedeId: dto.sedeId ?? null,
      estado: 'VIGENTE' as const,
      variablesSnapshot: snapshot as unknown as Prisma.JsonValue,
    } as Prisma.ContratoUncheckedCreateInput;

    const contract = await this.prisma.contrato.create({
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
    });

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
    const employee = await this.prisma.empleado.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
    });
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

  async generateDocument(
    tenantId: string,
    userId: string,
    contratoId: string,
    dto?: GenerateContractDocumentDto,
  ) {
    const contract = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId },
    });
    if (!contract) {
      throw new NotFoundException('Contrato no encontrado');
    }

    const template = await this.resolveTemplate(tenantId, dto?.templateId);

    const existing = await this.prisma.generatedDocument.findFirst({
      where: { contratoId: contract.id, tenantId },
    });
    if (existing) {
      throw new BadRequestException(
        'Este contrato ya tiene un documento generado. Elimine el existente antes de generar uno nuevo.',
      );
    }

    const snapshot = contract.variablesSnapshot;
    this.validateSnapshot(snapshot, contract.id);
    const validSnapshot = snapshot as unknown as ContractVariablesSnapshot;
    const contenidoFinal = this.buildContentFromSnapshot(
      template.contenido,
      validSnapshot,
    );

    let genDoc: { id: string };
    try {
      genDoc = await this.prisma.generatedDocument.create({
        data: {
          tenantId,
          employeeId: contract.empleadoId,
          templateId: template.id,
          contratoId: contract.id,
          nombre: `Contrato — ${validSnapshot.empleado.nombreCompleto}`,
          contenidoFinal,
          tipo: template.tipo,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un documento generado para este contrato (conflicto de concurrencia).',
        );
      }
      throw error;
    }

    try {
      return await this.generatedDocumentsService.generatePdf(
        tenantId,
        userId,
        genDoc.id,
      );
    } catch (error) {
      this.logger.warn(
        `generatePdf falló para GeneratedDocument ${genDoc.id}, eliminando documento huérfano`,
      );
      await this.prisma.generatedDocument
        .delete({ where: { id: genDoc.id } })
        .catch((deleteErr) =>
          this.logger.error(
            `No se pudo eliminar GeneratedDocument huérfano ${genDoc.id}`,
            deleteErr,
          ),
        );
      throw error;
    }
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
    const emp = await this.prisma.empleado.findFirst({
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
    });
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
