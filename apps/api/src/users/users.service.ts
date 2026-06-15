import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
}
