import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private jwtService: JwtService,
  ) {}

  async register(data: {
    nombreTenant: string;
    nit: string;
    digitoVerif: string;
    razonSocial: string;
    email: string;
    passwordPlain: string;
    nombre: string;
    apellido: string;
  }) {
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { nit: data.nit },
    });
    if (existingTenant) {
      throw new ConflictException(
        'Ya existe una empresa registrada con este NIT.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          nombre: data.nombreTenant,
          nit: data.nit,
          digitoVerif: data.digitoVerif,
          razonSocial: data.razonSocial,
          activo: true,
        },
      });

      const passwordHash = await bcrypt.hash(data.passwordPlain, 10);

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: data.email.toLowerCase(),
          passwordHash,
          nombre: data.nombre,
          apellido: data.apellido,
          rol: UserRole.ADMIN,
          activo: true,
        },
      });

      return {
        tenant: {
          id: tenant.id,
          nombre: tenant.nombre,
          nit: tenant.nit,
        },
        user: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          apellido: user.apellido,
          rol: user.rol,
        },
      };
    });
  }

  async login(data: {
    tenantNit: string;
    email: string;
    passwordPlain: string;
    userAgent?: string;
    ipAddress?: string;
  }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { nit: data.tenantNit },
    });
    if (!tenant) {
      throw new UnauthorizedException(
        'Credenciales inválidas (empresa no encontrada).',
      );
    }

    if (!tenant.activo) {
      throw new BadRequestException(
        'La empresa está inactiva y no puede iniciar sesión.',
      );
    }

    const user = await this.usersService.findByEmail(tenant.id, data.email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    if (!user.activo) {
      throw new UnauthorizedException('El usuario está inactivo.');
    }

    const isPasswordValid = await bcrypt.compare(
      data.passwordPlain,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(
      user.id,
      tenant.id,
      user.rol,
      user.email,
      data.userAgent,
      data.ipAddress,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        rol: user.rol,
        tenantId: tenant.id,
        tenantNombre: tenant.nombre,
      },
    };
  }

  async refresh(
    refreshTokenStr: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    let tokenId: string;
    let secret: string;
    try {
      const decoded = Buffer.from(refreshTokenStr, 'base64').toString('ascii');
      const parts = decoded.split(':');
      if (parts.length !== 2) throw new Error();
      [tokenId, secret] = parts;
    } catch {
      throw new UnauthorizedException('Token de renovación inválido.');
    }

    const dbToken = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      include: { user: true },
    });

    if (!dbToken) {
      throw new UnauthorizedException('Token de renovación no encontrado.');
    }

    if (dbToken.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: dbToken.userId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Token de renovación ya utilizado y revocado. Sesión terminada por seguridad.',
      );
    }

    if (new Date() > dbToken.expiresAt) {
      throw new UnauthorizedException('Token de renovación expirado.');
    }

    const isSecretValid = await bcrypt.compare(secret, dbToken.tokenHash);
    if (!isSecretValid) {
      throw new UnauthorizedException('Token de renovación inválido.');
    }

    const user = dbToken.user;
    if (!user.activo) {
      throw new UnauthorizedException('Usuario inactivo.');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });
    if (!tenant || !tenant.activo) {
      throw new UnauthorizedException('Empresa inactiva o no encontrada.');
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.generateTokens(
      user.id,
      user.tenantId,
      user.rol,
      user.email,
      userAgent,
      ipAddress,
    );

    return tokens;
  }

  async logout(refreshTokenStr: string) {
    try {
      const decoded = Buffer.from(refreshTokenStr, 'base64').toString('ascii');
      const parts = decoded.split(':');
      const tokenId = parts[0];
      if (tokenId) {
        await this.prisma.refreshToken.update({
          where: { id: tokenId },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // Silent error
    }
  }

  private async generateTokens(
    userId: string,
    tenantId: string,
    rol: UserRole,
    email: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const payload = {
      sub: userId,
      tenantId,
      rol,
      email,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as '15m',
    });

    const secret = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const tokenHash = await bcrypt.hash(secret, 10);

    const dbToken = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });

    const refreshToken = Buffer.from(`${dbToken.id}:${secret}`).toString(
      'base64',
    );

    return {
      accessToken,
      refreshToken,
    };
  }
}
