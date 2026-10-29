import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserInvitationDto } from './dto/create-user-invitation.dto';
import { lockTenantUserEmailIdentity } from './user-email-lock';

const INVITATION_EXPIRY_DAYS = 7;
const INVITATION_EXPIRY_MS = INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
const INVITATION_OPEN_KEY = 'OPEN';
const INVALID_INVITATION_MESSAGE = 'La invitación no es válida o ya expiró.';
const INVITATION_SEND_UNAVAILABLE_MESSAGE =
  'No fue posible enviar el correo. La invitación fue cancelada; inténtalo de nuevo cuando el correo esté disponible.';

const invitationListSelect = {
  id: true,
  createdAt: true,
  email: true,
  nombre: true,
  apellido: true,
  rol: true,
  expiresAt: true,
  lastSentAt: true,
} satisfies Prisma.UserInvitationSelect;

type InvitationListItem = Prisma.UserInvitationGetPayload<{
  select: typeof invitationListSelect;
}>;

type InvitationDelivery = {
  id: string;
  tenantId: string;
  createdByUserId: string | null;
  email: string;
  nombre: string;
  apellido: string;
  rol: UserRole;
  tokenHash: string;
};

@Injectable()
export class UserInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  async findAll(tenantId: string): Promise<InvitationListItem[]> {
    return this.prisma.userInvitation.findMany({
      where: {
        tenantId,
        openKey: INVITATION_OPEN_KEY,
        acceptedAt: null,
        revokedAt: null,
      },
      orderBy: [{ createdAt: 'desc' }],
      select: invitationListSelect,
    });
  }

  async create(
    tenantId: string,
    actorId: string,
    input: CreateUserInvitationDto,
  ): Promise<InvitationListItem> {
    this.assertEmailReady();
    const email = input.email.trim().toLowerCase();
    const secret = randomBytes(32).toString('base64url');
    const tokenHash = this.hashSecret(secret);
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await lockTenantUserEmailIdentity(tx, tenantId, email);
        const existingUser = await tx.user.findUnique({
          where: { tenantId_email: { tenantId, email } },
          select: { id: true },
        });
        if (existingUser) {
          throw new ConflictException(
            'Ya existe un usuario con este correo electrónico en la empresa.',
          );
        }

        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true, nombre: true, nit: true, activo: true },
        });
        if (!tenant || !tenant.activo) {
          throw new NotFoundException('Empresa no encontrada o inactiva.');
        }

        const invitation = await tx.userInvitation.create({
          data: {
            tenantId,
            createdByUserId: actorId,
            email,
            nombre: input.nombre.trim(),
            apellido: input.apellido.trim(),
            rol: input.rol,
            tokenHash,
            expiresAt,
            lastSentAt: new Date(),
            openKey: INVITATION_OPEN_KEY,
          },
        });

        await this.auditService.log(
          {
            tenantId,
            userId: actorId,
            action: 'USER_INVITATION_CREATED',
            entityType: 'UserInvitation',
            entityId: invitation.id,
            metadata: {
              email: this.obfuscate(email),
              rol: invitation.rol,
              expiresAt: invitation.expiresAt.toISOString(),
            },
          },
          tx,
        );

        return { invitation, tenant };
      });

      const token = this.encodeToken(created.invitation.id, secret);
      await this.deliver(created.invitation, token, created.tenant, actorId);
      return this.toListItem(created.invitation);
    } catch (error) {
      this.throwInvitationConflict(error);
    }
  }

  async resend(
    tenantId: string,
    actorId: string,
    invitationId: string,
  ): Promise<InvitationListItem> {
    this.assertEmailReady();
    const current = await this.prisma.userInvitation.findFirst({
      where: {
        id: invitationId,
        tenantId,
        openKey: INVITATION_OPEN_KEY,
        acceptedAt: null,
        revokedAt: null,
      },
      include: {
        tenant: {
          select: { nombre: true, nit: true, activo: true },
        },
      },
    });
    if (!current || !current.tenant.activo) {
      throw new NotFoundException('Invitación no encontrada.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        tenantId_email: { tenantId, email: current.email },
      },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException(
        'Ya existe un usuario con este correo electrónico en la empresa.',
      );
    }

    const secret = randomBytes(32).toString('base64url');
    const tokenHash = this.hashSecret(secret);
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS);
    const sentAt = new Date();

    const rotated = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.userInvitation.updateMany({
        where: {
          id: current.id,
          tenantId,
          tokenHash: current.tokenHash,
          openKey: INVITATION_OPEN_KEY,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { tokenHash, expiresAt, lastSentAt: sentAt },
      });
      if (claim.count !== 1) {
        throw new NotFoundException('Invitación no encontrada.');
      }

      await this.auditService.log(
        {
          tenantId,
          userId: actorId,
          action: 'USER_INVITATION_RESENT',
          entityType: 'UserInvitation',
          entityId: current.id,
          metadata: {
            email: this.obfuscate(current.email),
            expiresAt: expiresAt.toISOString(),
          },
        },
        tx,
      );

      return tx.userInvitation.findUniqueOrThrow({
        where: { id: current.id },
      });
    });

    const token = this.encodeToken(rotated.id, secret);
    await this.deliver(rotated, token, current.tenant, actorId);
    return this.toListItem(rotated);
  }

  async revoke(
    tenantId: string,
    actorId: string,
    invitationId: string,
  ): Promise<{ message: string }> {
    const revokedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.userInvitation.findFirst({
        where: {
          id: invitationId,
          tenantId,
          openKey: INVITATION_OPEN_KEY,
          acceptedAt: null,
          revokedAt: null,
        },
        select: { id: true, email: true },
      });
      if (!invitation) {
        throw new NotFoundException('Invitación no encontrada.');
      }

      const claim = await tx.userInvitation.updateMany({
        where: {
          id: invitation.id,
          tenantId,
          openKey: INVITATION_OPEN_KEY,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt, openKey: null },
      });
      if (claim.count !== 1) {
        throw new NotFoundException('Invitación no encontrada.');
      }

      await this.auditService.log(
        {
          tenantId,
          userId: actorId,
          action: 'USER_INVITATION_REVOKED',
          entityType: 'UserInvitation',
          entityId: invitation.id,
          metadata: { email: this.obfuscate(invitation.email) },
        },
        tx,
      );
    });

    return { message: 'Invitación revocada.' };
  }

  async accept(params: {
    token: string;
    newPassword: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    message: string;
    tenantNit: string;
    tenantName: string;
  }> {
    const { invitationId, secret } = this.decodeToken(params.token);
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { id: invitationId },
      include: {
        tenant: {
          select: { nombre: true, nit: true, activo: true },
        },
      },
    });
    if (
      !invitation ||
      invitation.acceptedAt !== null ||
      invitation.revokedAt !== null ||
      invitation.openKey !== INVITATION_OPEN_KEY ||
      !invitation.tenant.activo ||
      invitation.expiresAt.getTime() <= Date.now() ||
      !this.matchesSecret(secret, invitation.tokenHash)
    ) {
      throw new BadRequestException(INVALID_INVITATION_MESSAGE);
    }

    const passwordHash = await bcrypt.hash(params.newPassword, 10);
    const acceptedAt = new Date();

    try {
      await this.prisma.$transaction(async (tx) => {
        await lockTenantUserEmailIdentity(
          tx,
          invitation.tenantId,
          invitation.email,
        );
        const claim = await tx.userInvitation.updateMany({
          where: {
            id: invitation.id,
            tenantId: invitation.tenantId,
            tokenHash: invitation.tokenHash,
            openKey: INVITATION_OPEN_KEY,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: acceptedAt },
          },
          data: { acceptedAt, openKey: null },
        });
        if (claim.count !== 1) {
          throw new BadRequestException(INVALID_INVITATION_MESSAGE);
        }

        const user = await tx.user.create({
          data: {
            tenantId: invitation.tenantId,
            email: invitation.email,
            passwordHash,
            nombre: invitation.nombre,
            apellido: invitation.apellido,
            rol: invitation.rol,
            activo: true,
          },
          select: { id: true },
        });

        await this.auditService.log(
          {
            tenantId: invitation.tenantId,
            userId: user.id,
            action: 'USER_INVITATION_ACCEPTED',
            entityType: 'UserInvitation',
            entityId: invitation.id,
            metadata: {
              rol: invitation.rol,
              ip: params.ipAddress ?? null,
              userAgent: params.userAgent ?? null,
            },
          },
          tx,
        );
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(INVALID_INVITATION_MESSAGE);
      }
      throw error;
    }

    return {
      message: 'Tu cuenta quedó activada. Ya puedes iniciar sesión.',
      tenantNit: invitation.tenant.nit,
      tenantName: invitation.tenant.nombre,
    };
  }

  private assertEmailReady(): void {
    if (this.emailService.getReadiness().status !== 'up') {
      throw new ServiceUnavailableException(
        'El correo transaccional no está disponible. Inténtalo más tarde.',
      );
    }
  }

  private async deliver(
    invitation: InvitationDelivery,
    token: string,
    tenant: { nombre: string; nit: string },
    actorId: string,
  ): Promise<void> {
    let status: 'sent' | 'degraded' | 'failed' = 'failed';
    try {
      const invitationUrl = new URL(
        '/aceptar-invitacion',
        this.config.get<string>('frontendUrl') ?? 'http://localhost:3000',
      );
      invitationUrl.hash = 'token=' + encodeURIComponent(token);
      status = await this.emailService.send({
        type: 'user-invitation',
        to: invitation.email,
        payload: {
          userName: (invitation.nombre + ' ' + invitation.apellido).trim(),
          tenantName: tenant.nombre,
          tenantNit: tenant.nit,
          roleName:
            invitation.rol === UserRole.ADMIN ? 'Administrador' : 'Operador',
          invitationUrl: invitationUrl.toString(),
          expiresInDays: INVITATION_EXPIRY_DAYS,
        },
        auditContext: { tenantId: invitation.tenantId, userId: actorId },
      });
    } catch {
      status = 'failed';
    }

    if (status === 'sent') return;

    const revokedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const update = await tx.userInvitation.updateMany({
        where: {
          id: invitation.id,
          tenantId: invitation.tenantId,
          tokenHash: invitation.tokenHash,
          openKey: INVITATION_OPEN_KEY,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt, openKey: null },
      });
      if (update.count === 1) {
        await this.auditService.log(
          {
            tenantId: invitation.tenantId,
            userId: actorId,
            action: 'USER_INVITATION_DELIVERY_FAILED',
            entityType: 'UserInvitation',
            entityId: invitation.id,
            metadata: { email: this.obfuscate(invitation.email) },
          },
          tx,
        );
      }
    });
    throw new ServiceUnavailableException(INVITATION_SEND_UNAVAILABLE_MESSAGE);
  }

  private toListItem(invitation: {
    id: string;
    createdAt: Date;
    email: string;
    nombre: string;
    apellido: string;
    rol: UserRole;
    expiresAt: Date;
    lastSentAt: Date;
  }): InvitationListItem {
    return {
      id: invitation.id,
      createdAt: invitation.createdAt,
      email: invitation.email,
      nombre: invitation.nombre,
      apellido: invitation.apellido,
      rol: invitation.rol,
      expiresAt: invitation.expiresAt,
      lastSentAt: invitation.lastSentAt,
    };
  }

  private encodeToken(invitationId: string, secret: string): string {
    return Buffer.from(invitationId + ':' + secret).toString('base64url');
  }

  private decodeToken(token: string): { invitationId: string; secret: string } {
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(token)) throw new Error();
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const separator = decoded.indexOf(':');
      if (separator <= 0 || decoded.indexOf(':', separator + 1) !== -1) {
        throw new Error();
      }
      const invitationId = decoded.slice(0, separator);
      const secret = decoded.slice(separator + 1);
      if (!invitationId || !/^[A-Za-z0-9_-]{43}$/.test(secret)) {
        throw new Error();
      }
      return { invitationId, secret };
    } catch {
      throw new BadRequestException(INVALID_INVITATION_MESSAGE);
    }
  }

  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  private matchesSecret(secret: string, persistedHash: string): boolean {
    const actual = Buffer.from(this.hashSecret(secret), 'hex');
    const expected = Buffer.from(persistedHash, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private obfuscate(email: string): string {
    return email.replace(/^(.).*?(@.*)$/, '$1***$2');
  }

  private throwInvitationConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Ya existe un usuario o una invitación pendiente con este correo en la empresa.',
      );
    }
    throw error;
  }
}
