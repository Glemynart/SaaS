import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { Prisma } from '@prisma/client';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private tenantContext: TenantContextBoundary,
  ) {}

  async create(userId: string, createDto: CreateEmployeeDto) {
    const tenantId = this.tenantContext.require().tenantId;
    const existing = await this.prisma.empleado.findUnique({
      where: {
        tenantId_cedula: {
          tenantId,
          cedula: createDto.cedula,
        },
      },
    });

    if (existing) {
      if (existing.deletedAt) {
        throw new BadRequestException(
          'Ya existe un empleado inactivo con este documento. Por favor, reactive el empleado.',
        );
      }
      throw new BadRequestException('Ya existe un empleado con esta cédula');
    }

    if (createDto.sedeId) {
      await this.ensureSedeBelongsToTenant(tenantId, createDto.sedeId);
    }

    const employee = await this.prisma.empleado.create({
      data: {
        ...createDto,
        fechaIngreso: new Date(createDto.fechaIngreso),
        tenantId,
      },
    });
    this.auditService
      .log({
        tenantId,
        userId,
        action: 'EMPLOYEE_CREATE',
        entityType: 'Employee',
        entityId: employee.id,
        metadata: { cedula: employee.cedula },
      })
      .catch(() => {});
    return employee;
  }

  async findAll(query: EmployeeQueryDto) {
    const tenantId = this.tenantContext.require().tenantId;
    const { page = 1, limit = 10, search, estado } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.EmpleadoWhereInput = {
      tenantId,
      deletedAt: null,
      ...(estado && { estado }),
    };

    if (search) {
      where.OR = [
        { primerNombre: { contains: search, mode: 'insensitive' } },
        { segundoNombre: { contains: search, mode: 'insensitive' } },
        { primerApellido: { contains: search, mode: 'insensitive' } },
        { segundoApellido: { contains: search, mode: 'insensitive' } },
        { cedula: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.empleado.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sedeRef: { select: { id: true, nombre: true } },
        },
      }),
      this.prisma.empleado.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const tenantId = this.tenantContext.require().tenantId;
    const employee = await this.prisma.empleado.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        sedeRef: { select: { id: true, nombre: true } },
      },
    });

    if (!employee) {
      throw new NotFoundException('Empleado no encontrado');
    }

    return employee;
  }

  async update(id: string, updateDto: UpdateEmployeeDto) {
    const tenantId = this.tenantContext.require().tenantId;
    // Verificar si existe y pertenece al tenant
    await this.findOne(id);

    if (updateDto.cedula) {
      const existing = await this.prisma.empleado.findUnique({
        where: {
          tenantId_cedula: {
            tenantId,
            cedula: updateDto.cedula,
          },
        },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException(
          'Ya existe otro empleado con esta cédula',
        );
      }
    }

    if (updateDto.sedeId) {
      await this.ensureSedeBelongsToTenant(tenantId, updateDto.sedeId);
    }

    const dataToUpdate: Prisma.EmpleadoUpdateInput = { ...updateDto };
    if (updateDto.fechaIngreso) {
      dataToUpdate.fechaIngreso = new Date(updateDto.fechaIngreso);
    }

    return this.prisma.empleado.update({
      where: { id, tenantId },
      data: dataToUpdate,
    });
  }

  async remove(id: string) {
    const tenantId = this.tenantContext.require().tenantId;
    await this.findOne(id);

    return this.prisma.empleado.update({
      where: { id, tenantId },
      data: {
        deletedAt: new Date(),
        estado: 'INACTIVO',
      },
    });
  }

  private async ensureSedeBelongsToTenant(tenantId: string, sedeId: string) {
    const sede = await this.prisma.sede.findFirst({
      where: { id: sedeId, tenantId },
    });
    if (!sede) {
      throw new BadRequestException(
        'La sede no existe o no pertenece a esta empresa',
      );
    }
  }
}
