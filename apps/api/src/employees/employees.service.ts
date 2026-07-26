import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { Prisma } from '@prisma/client';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(userId: string, createDto: CreateEmployeeDto) {
    const { employee, tenantId } = await this.tenantPrisma.execute(
      async (prisma, context) => {
        const tenantId = context.tenantId;
        const existing = await prisma.empleado.findUnique({
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
          throw new BadRequestException(
            'Ya existe un empleado con esta cédula',
          );
        }

        if (createDto.sedeId) {
          await this.ensureSedeBelongsToTenant(
            prisma,
            tenantId,
            createDto.sedeId,
          );
        }

        const employee = await prisma.empleado.create({
          data: {
            ...createDto,
            fechaIngreso: new Date(createDto.fechaIngreso),
            tenantId,
          },
        });

        return { employee, tenantId };
      },
    );

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
    return this.tenantPrisma.execute(async (prisma, context) => {
      const { page = 1, limit = 10, search, estado } = query;
      const skip = (page - 1) * limit;

      const where: Prisma.EmpleadoWhereInput = {
        tenantId: context.tenantId,
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
        prisma.empleado.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            sedeRef: { select: { id: true, nombre: true } },
          },
        }),
        prisma.empleado.count({ where }),
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
    });
  }

  async findOne(id: string) {
    return this.tenantPrisma.execute((prisma, context) =>
      this.findOneInTenant(prisma, context.tenantId, id),
    );
  }

  async update(id: string, updateDto: UpdateEmployeeDto) {
    return this.tenantPrisma.execute(async (prisma, context) => {
      const tenantId = context.tenantId;
      await this.findOneInTenant(prisma, tenantId, id);

      if (updateDto.cedula) {
        const existing = await prisma.empleado.findUnique({
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
        await this.ensureSedeBelongsToTenant(
          prisma,
          tenantId,
          updateDto.sedeId,
        );
      }

      const dataToUpdate: Prisma.EmpleadoUpdateInput = { ...updateDto };
      if (updateDto.fechaIngreso) {
        dataToUpdate.fechaIngreso = new Date(updateDto.fechaIngreso);
      }

      return prisma.empleado.update({
        where: { id, tenantId },
        data: dataToUpdate,
      });
    });
  }

  async remove(id: string) {
    return this.tenantPrisma.execute(async (prisma, context) => {
      const tenantId = context.tenantId;
      await this.findOneInTenant(prisma, tenantId, id);

      return prisma.empleado.update({
        where: { id, tenantId },
        data: {
          deletedAt: new Date(),
          estado: 'INACTIVO',
        },
      });
    });
  }

  private async findOneInTenant(
    prisma: TenantPrismaClient,
    tenantId: string,
    id: string,
  ) {
    const employee = await prisma.empleado.findFirst({
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

  private async ensureSedeBelongsToTenant(
    prisma: TenantPrismaClient,
    tenantId: string,
    sedeId: string,
  ) {
    const sede = await prisma.sede.findFirst({
      where: { id: sedeId, tenantId },
    });
    if (!sede) {
      throw new BadRequestException(
        'La sede no existe o no pertenece a esta empresa',
      );
    }
  }
}
