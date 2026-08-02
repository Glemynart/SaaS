import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import type { CreateManagedUserDto } from './dto/create-managed-user.dto';
import type { UpdateManagedUserDto } from './dto/update-managed-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private readonly managedUserSelect = {
    id: true,
    createdAt: true,
    updatedAt: true,
    email: true,
    nombre: true,
    apellido: true,
    rol: true,
    activo: true,
    lastLoginAt: true,
  } satisfies Prisma.UserSelect;

  async findByEmail(tenantId: string, email: string) {
    return this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId,
          email: email.toLowerCase(),
        },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: {
    tenantId: string;
    email: string;
    passwordPlain: string;
    nombre: string;
    apellido: string;
    rol: UserRole;
  }) {
    const existing = await this.findByEmail(data.tenantId, data.email);
    if (existing) {
      throw new ConflictException(
        'Ya existe un usuario con este correo electrónico en la empresa.',
      );
    }

    const passwordHash = await bcrypt.hash(data.passwordPlain, 10);

    return this.prisma.user.create({
      data: {
        tenantId: data.tenantId,
        email: data.email.toLowerCase(),
        passwordHash,
        nombre: data.nombre,
        apellido: data.apellido,
        rol: data.rol,
      },
    });
  }

  async findAllManaged(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }, { apellido: 'asc' }],
      select: this.managedUserSelect,
    });
  }

  async createManaged(
    tenantId: string,
    actorId: string,
    data: CreateManagedUserDto,
  ) {
    const email = data.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(data.passwordPlain, 10);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            tenantId,
            email,
            passwordHash,
            nombre: data.nombre.trim(),
            apellido: data.apellido.trim(),
            rol: data.rol,
            activo: true,
          },
          select: this.managedUserSelect,
        });

        await this.auditService.log(
          {
            tenantId,
            userId: actorId,
            action: 'USER_CREATED',
            entityType: 'User',
            entityId: user.id,
            metadata: { rol: user.rol },
          },
          tx,
        );

        return user;
      });
    } catch (error) {
      this.throwUserConflict(error);
    }
  }

  async updateManaged(
    tenantId: string,
    actorId: string,
    id: string,
    data: UpdateManagedUserDto,
  ) {
    const fields = Object.keys(data);
    if (fields.length === 0) {
      throw new BadRequestException('Debe indicar al menos un cambio.');
    }

    if (actorId === id && data.activo === false) {
      throw new BadRequestException('No puedes desactivar tu propio usuario.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.user.findFirst({
          where: { id, tenantId },
          select: { id: true, rol: true, activo: true, email: true },
        });
        if (!current) throw new NotFoundException('Usuario no encontrado.');

        const nextRole = data.rol ?? current.rol;
        const nextActive = data.activo ?? current.activo;
        const removesLastActiveAdmin =
          current.rol === UserRole.ADMIN &&
          current.activo &&
          (nextRole !== UserRole.ADMIN || !nextActive);

        if (removesLastActiveAdmin) {
          const activeAdmins = await tx.user.count({
            where: { tenantId, rol: UserRole.ADMIN, activo: true },
          });
          if (activeAdmins <= 1) {
            throw new BadRequestException(
              'La empresa debe conservar al menos un administrador activo.',
            );
          }
        }

        const user = await tx.user.update({
          where: { id },
          data: {
            ...(data.email !== undefined
              ? { email: data.email.trim().toLowerCase() }
              : {}),
            ...(data.nombre !== undefined
              ? { nombre: data.nombre.trim() }
              : {}),
            ...(data.apellido !== undefined
              ? { apellido: data.apellido.trim() }
              : {}),
            ...(data.rol !== undefined ? { rol: data.rol } : {}),
            ...(data.activo !== undefined ? { activo: data.activo } : {}),
          },
          select: this.managedUserSelect,
        });

        if (data.rol !== undefined || data.activo !== undefined) {
          await tx.refreshToken.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }

        await this.auditService.log(
          {
            tenantId,
            userId: actorId,
            action: 'USER_UPDATED',
            entityType: 'User',
            entityId: user.id,
            metadata: {
              fields,
              previousRole: current.rol,
              nextRole: user.rol,
              previousActive: current.activo,
              nextActive: user.activo,
            },
          },
          tx,
        );

        return user;
      });
    } catch (error) {
      this.throwUserConflict(error);
    }
  }

  private throwUserConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Ya existe un usuario con este correo electrónico en la empresa.',
      );
    }
    throw error;
  }
}
