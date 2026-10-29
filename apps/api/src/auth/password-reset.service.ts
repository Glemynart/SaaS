import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const RESET_EXPIRY_HOURS = 1;
const GENERIC_RESPONSE =
  'Si el correo existe, recibirás instrucciones para restablecer tu contraseña.';
const INVALID_TOKEN_MSG = 'Token inválido o expirado.';

@Injectable()
export class PasswordResetService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private auditService: AuditService,
    private emailService: EmailService,
  ) {}

  async requestReset(params: {
    tenantNit: string;
    email: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ message: string }> {
    const { tenantNit, email, ipAddress, userAgent } = params;

    const tenant = await this.prisma.tenant.findUnique({
      where: { nit: tenantNit },
    });

    if (!tenant || !tenant.activo) {
      return { message: GENERIC_RESPONSE };
    }

    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: { tenantId: tenant.id, email: email.toLowerCase() },
      },
    });

    if (!user || !user.activo) {
      return { message: GENERIC_RESPONSE };
    }

    // Invalidar tokens pendientes anteriores del mismo usuario
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Crear token nuevo — mismo patrón que RefreshToken
    const secret = crypto.randomUUID();
    const tokenHash = await bcrypt.hash(secret, 10);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + RESET_EXPIRY_HOURS);

    const dbToken = await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tenantId: tenant.id, tokenHash, expiresAt },
    });

    const tokenEncoded = Buffer.from(`${dbToken.id}:${secret}`).toString(
      'base64',
    );

    const frontendUrl =
      this.config.get<string>('frontendUrl') ?? 'http://localhost:3000';
    const resetUrl = new URL(`${frontendUrl.replace(/\/+$/, '')}/restablecer`);
    resetUrl.hash = new URLSearchParams({ token: tokenEncoded }).toString();

    await this.emailService.send({
      type: 'password-reset',
      to: email,
      payload: {
        userName: `${user.nombre} ${user.apellido}`.trim(),
        resetUrl: resetUrl.toString(),
        expiresInHours: RESET_EXPIRY_HOURS,
      },
      auditContext: { tenantId: tenant.id, userId: user.id },
    });

    const emailObfuscated = email.replace(/^(.).*?(@.*)$/, '$1***$2');
    await this.auditService
      .log({
        tenantId: tenant.id,
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'Auth',
        entityId: user.id,
        metadata: {
          ip: ipAddress ?? null,
          userAgent: userAgent ?? null,
          email: emailObfuscated,
        },
      })
      .catch(() => {});

    return { message: GENERIC_RESPONSE };
  }

  async consumeReset(params: {
    token: string;
    newPassword: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ message: string }> {
    const { token, newPassword, ipAddress, userAgent } = params;
    const dbToken = await this.findValidResetToken(token);
    if (!dbToken) throw new BadRequestException(INVALID_TOKEN_MSG);

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      const consumedAt = new Date();
      const claim = await tx.passwordResetToken.updateMany({
        where: {
          id: dbToken.id,
          usedAt: null,
          expiresAt: { gte: consumedAt },
        },
        data: { usedAt: consumedAt },
      });

      if (claim.count !== 1) {
        throw new BadRequestException(INVALID_TOKEN_MSG);
      }

      await tx.user.update({
        where: { id: dbToken.userId },
        data: { passwordHash: newPasswordHash },
      });
      await tx.refreshToken.updateMany({
        where: { userId: dbToken.userId, revokedAt: null },
        data: { revokedAt: consumedAt },
      });
    });

    await this.auditService
      .log({
        tenantId: dbToken.tenantId,
        userId: dbToken.userId,
        action: 'PASSWORD_RESET_COMPLETED',
        entityType: 'Auth',
        entityId: dbToken.userId,
        metadata: { ip: ipAddress ?? null, userAgent: userAgent ?? null },
      })
      .catch(() => {});

    return { message: 'Contraseña actualizada exitosamente.' };
  }

  async validateResetToken(token: unknown): Promise<{ valid: boolean }> {
    return { valid: Boolean(await this.findValidResetToken(token)) };
  }

  private async findValidResetToken(token: unknown) {
    const parsed = this.parseResetToken(token);
    if (!parsed) return null;

    const dbToken = await this.prisma.passwordResetToken.findUnique({
      where: { id: parsed.tokenId },
    });
    if (
      !dbToken ||
      dbToken.usedAt !== null ||
      dbToken.expiresAt <= new Date()
    ) {
      return null;
    }

    return (await bcrypt.compare(parsed.secret, dbToken.tokenHash))
      ? dbToken
      : null;
  }

  private parseResetToken(
    token: unknown,
  ): { tokenId: string; secret: string } | null {
    if (
      typeof token !== 'string' ||
      token.length === 0 ||
      token.length > 256 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(token)
    ) {
      return null;
    }

    const decoded = Buffer.from(token, 'base64').toString('utf8');
    if (Buffer.from(decoded, 'utf8').toString('base64') !== token) return null;

    const separator = decoded.indexOf(':');
    if (
      separator <= 0 ||
      separator === decoded.length - 1 ||
      decoded.indexOf(':', separator + 1) !== -1
    ) {
      return null;
    }

    return {
      tokenId: decoded.slice(0, separator),
      secret: decoded.slice(separator + 1),
    };
  }
}
