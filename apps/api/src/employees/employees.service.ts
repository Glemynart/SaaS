import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { CreateEmployeeDto, TipoSalarioPila } from './dto/create-employee.dto';
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
    if (!createDto.sedeId) {
      throw new BadRequestException('La sede del empleado es requerida.');
    }

    if (
      createDto.tipoSalarioPila &&
      createDto.salarioIntegral !== undefined &&
      (createDto.tipoSalarioPila === TipoSalarioPila.INTEGRAL) !==
        createDto.salarioIntegral
    ) {
      throw new BadRequestException(
        'El tipo de salario PILA no coincide con la opción de salario integral.',
      );
    }

    const tipoSalarioPila =
      createDto.tipoSalarioPila ??
      (createDto.salarioIntegral ? TipoSalarioPila.INTEGRAL : null);
    const salarioIntegral = tipoSalarioPila
      ? tipoSalarioPila === TipoSalarioPila.INTEGRAL
      : (createDto.salarioIntegral ?? false);

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
            salarioIntegral,
            tipoSalarioPila,
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

      const searchTerms = search?.trim().split(/\s+/).filter(Boolean) ?? [];

      if (searchTerms.length > 0) {
        where.AND = searchTerms.map((term) => ({
          OR: [
            { primerNombre: { contains: term, mode: 'insensitive' } },
            { segundoNombre: { contains: term, mode: 'insensitive' } },
            { primerApellido: { contains: term, mode: 'insensitive' } },
            { segundoApellido: { contains: term, mode: 'insensitive' } },
            { cedula: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
          ],
        }));
      }

      const [data, total] = await Promise.all([
        prisma.empleado.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            sedeRef: { select: { id: true, nombre: true, activo: true } },
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

  async update(userId: string, id: string, updateDto: UpdateEmployeeDto) {
    const { employee, tenantId } = await this.tenantPrisma.execute(
      async (prisma, context) => {
        const tenantId = context.tenantId;
        const currentEmployee = await this.findOneInTenant(
          prisma,
          tenantId,
          id,
        );

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

        const dataToUpdate: Prisma.EmpleadoUncheckedUpdateInput = {
          ...updateDto,
        };
        if (
          updateDto.tipoSalarioPila &&
          updateDto.salarioIntegral !== undefined &&
          (updateDto.tipoSalarioPila === TipoSalarioPila.INTEGRAL) !==
            updateDto.salarioIntegral
        ) {
          throw new BadRequestException(
            'El tipo de salario PILA no coincide con la opción de salario integral.',
          );
        }
        if (updateDto.tipoSalarioPila !== undefined) {
          const tipoSalarioPila =
            updateDto.tipoSalarioPila ??
            (updateDto.salarioIntegral === true
              ? TipoSalarioPila.INTEGRAL
              : null);
          dataToUpdate.tipoSalarioPila = tipoSalarioPila;
          dataToUpdate.salarioIntegral =
            tipoSalarioPila === TipoSalarioPila.INTEGRAL;
        } else if (updateDto.salarioIntegral !== undefined) {
          dataToUpdate.salarioIntegral = updateDto.salarioIntegral;
          dataToUpdate.tipoSalarioPila = updateDto.salarioIntegral
            ? TipoSalarioPila.INTEGRAL
            : currentEmployee.tipoSalarioPila === TipoSalarioPila.INTEGRAL
              ? null
              : currentEmployee.tipoSalarioPila;
        }
        if (updateDto.fechaIngreso) {
          dataToUpdate.fechaIngreso = new Date(updateDto.fechaIngreso);
        }
        if (updateDto.fechaRetiro !== undefined) {
          dataToUpdate.fechaRetiro = updateDto.fechaRetiro
            ? new Date(updateDto.fechaRetiro)
            : null;
        }
        if (updateDto.municipioExpedicionDocId !== undefined) {
          dataToUpdate.municipioExpedicionDocId =
            updateDto.municipioExpedicionDocId || null;
        }

        const employee = await prisma.empleado.update({
          where: { id, tenantId },
          data: dataToUpdate,
        });
        return { employee, tenantId };
      },
    );

    this.auditService
      .log({
        tenantId,
        userId,
        action: 'EMPLOYEE_UPDATE',
        entityType: 'Employee',
        entityId: employee.id,
        metadata: { fields: Object.keys(updateDto) },
      })
      .catch(() => {});
    return employee;
  }

  async remove(userId: string, id: string) {
    const { employee, tenantId } = await this.tenantPrisma.execute(
      async (prisma, context) => {
        const tenantId = context.tenantId;
        await this.findOneInTenant(prisma, tenantId, id);

        const employee = await prisma.empleado.update({
          where: { id, tenantId },
          data: {
            deletedAt: new Date(),
            estado: 'INACTIVO',
          },
        });
        return { employee, tenantId };
      },
    );

    this.auditService
      .log({
        tenantId,
        userId,
        action: 'EMPLOYEE_DELETE',
        entityType: 'Employee',
        entityId: employee.id,
      })
      .catch(() => {});
    return employee;
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
        sedeRef: { select: { id: true, nombre: true, activo: true } },
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
      where: { id: sedeId, tenantId, activo: true },
    });
    if (!sede) {
      throw new BadRequestException(
        'La sede no existe, no está activa o no pertenece a esta empresa',
      );
    }
  }
}
