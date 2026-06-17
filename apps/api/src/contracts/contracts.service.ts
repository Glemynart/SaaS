import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ContractQueryDto } from './dto/contract-query.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import {
  UpdateContractStatusDto,
  ContratoEstado as ContratoEstadoEnum,
} from './dto/update-contract-status.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
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
    await this.validateEmployee(tenantId, dto.employeeId);

    if (dto.sedeId) {
      await this.validateSede(tenantId, dto.sedeId);
    }

    if (dto.plantillaId) {
      await this.validatePlantilla(tenantId, dto.plantillaId);
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

    const data = {
      tenantId,
      empleadoId: dto.employeeId,
      cargo: dto.cargo,
      salario: dto.salario,
      tipo: dto.tipo,
      fechaInicio: new Date(dto.fechaInicio),
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
      sedeId: dto.sedeId ?? null,
      plantillaId: dto.plantillaId ?? null,
      estado: 'VIGENTE' as const,
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

  private async validateEmployee(tenantId: string, employeeId: string) {
    const emp = await this.prisma.empleado.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
    });
    if (!emp)
      throw new BadRequestException(
        'El empleado no existe o no pertenece a esta empresa.',
      );
  }

  private async validateSede(tenantId: string, sedeId: string) {
    const sede = await this.prisma.sede.findFirst({
      where: { id: sedeId, tenantId },
    });
    if (!sede)
      throw new BadRequestException(
        'La sede no existe o no pertenece a esta empresa.',
      );
  }

  private async validatePlantilla(tenantId: string, plantillaId: string) {
    const plantilla = await this.prisma.plantilla.findFirst({
      where: { id: plantillaId, tenantId },
    });
    if (!plantilla)
      throw new BadRequestException(
        'La plantilla no existe o no pertenece a esta empresa.',
      );
  }
}
