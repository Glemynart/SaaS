import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserInvitationsService } from './user-invitations.service';

const now = new Date('2026-10-29T12:00:00.000Z');
const tenant = {
  id: 'tenant-1',
  nombre: 'Colegio de Prueba',
  nit: '900123456',
  activo: true,
};

describe('UserInvitationsService', () => {
  it('lists only open invitations belonging to the requested tenant', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { userInvitation: { findMany } };
    const service = new UserInvitationsService(
      prisma as unknown as PrismaService,
      {} as ConfigService,
      {} as AuditService,
      {} as EmailService,
    );

    await expect(service.findAll('tenant-a')).resolves.toEqual([]);
    const args = firstMockArg<{
      where: {
        tenantId: string;
        openKey: string;
        acceptedAt: null;
        revokedAt: null;
      };
      select: Record<string, boolean>;
    }>(findMany);
    expect(args.where).toEqual({
      tenantId: 'tenant-a',
      openKey: 'OPEN',
      acceptedAt: null,
      revokedAt: null,
    });
    expect(args.select).not.toHaveProperty('tokenHash');
  });

  it('creates a tenant-scoped invitation, emails the link, and never returns its token hash', async () => {
    const email = {
      getReadiness: jest.fn().mockReturnValue({ status: 'up' }),
      send: jest.fn().mockResolvedValue('sent'),
    };
    const invitation = {
      id: 'invitation-1',
      createdAt: now,
      updatedAt: now,
      tenantId: tenant.id,
      createdByUserId: 'admin-1',
      email: 'ana@example.test',
      nombre: 'Ana',
      apellido: 'Operadora',
      rol: UserRole.OPERADOR,
      tokenHash: 'stored-hash',
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      lastSentAt: now,
      acceptedAt: null,
      revokedAt: null,
      openKey: 'OPEN',
    };
    const tx = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      tenant: { findUnique: jest.fn().mockResolvedValue(tenant) },
      userInvitation: { create: jest.fn().mockResolvedValue(invitation) },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const prisma = {
      $transaction: transactionMock(tx),
    };
    const service = new UserInvitationsService(
      prisma as unknown as PrismaService,
      {
        get: jest.fn().mockReturnValue('https://app.example.test'),
      } as unknown as ConfigService,
      audit as unknown as AuditService,
      email as unknown as EmailService,
    );

    const result = await service.create(tenant.id, 'admin-1', {
      email: ' Ana@Example.Test ',
      nombre: ' Ana ',
      apellido: ' Operadora ',
      rol: UserRole.OPERADOR,
    });

    expect(firstMockArg(tx.user.findUnique)).toEqual({
      where: {
        tenantId_email: { tenantId: tenant.id, email: 'ana@example.test' },
      },
      select: { id: true },
    });
    const createArgs = firstMockArg<{
      data: Record<string, unknown>;
    }>(tx.userInvitation.create);
    expect(createArgs.data).toMatchObject({
      tenantId: tenant.id,
      createdByUserId: 'admin-1',
      email: 'ana@example.test',
      nombre: 'Ana',
      apellido: 'Operadora',
      rol: UserRole.OPERADOR,
      openKey: 'OPEN',
    });
    const emailParams = firstMockArg<{
      type: string;
      to: string;
      auditContext: { tenantId: string; userId: string };
      payload: {
        tenantName: string;
        tenantNit: string;
        roleName: string;
        expiresInDays: number;
        invitationUrl: string;
      };
    }>(email.send);
    expect(emailParams).toMatchObject({
      type: 'user-invitation',
      to: 'ana@example.test',
      auditContext: { tenantId: tenant.id, userId: 'admin-1' },
      payload: {
        tenantName: tenant.nombre,
        tenantNit: tenant.nit,
        roleName: 'Operador',
        expiresInDays: 7,
      },
    });
    const deliveredToken = new URLSearchParams(
      new URL(emailParams.payload.invitationUrl).hash.slice(1),
    ).get('token');
    expect(deliveredToken).toBeTruthy();
    expect(result).toEqual({
      id: invitation.id,
      createdAt: invitation.createdAt,
      email: invitation.email,
      nombre: invitation.nombre,
      apellido: invitation.apellido,
      rol: invitation.rol,
      expiresAt: invitation.expiresAt,
      lastSentAt: invitation.lastSentAt,
    });
    expect(result).not.toHaveProperty('tokenHash');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_INVITATION_CREATED',
        tenantId: tenant.id,
        userId: 'admin-1',
      }),
      tx,
    );
  });

  it('does not persist invitations when email is not configured', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new UserInvitationsService(
      prisma as unknown as PrismaService,
      {} as ConfigService,
      {} as AuditService,
      {
        getReadiness: jest.fn().mockReturnValue({ status: 'degraded' }),
      } as unknown as EmailService,
    );

    await expect(
      service.create(tenant.id, 'admin-1', {
        email: 'ana@example.test',
        nombre: 'Ana',
        apellido: 'Operadora',
        rol: UserRole.OPERADOR,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rotates the token on resend and scopes it to the invitation tenant', async () => {
    const oldSecret = randomBytes(32).toString('base64url');
    const current = invitationForSecret(oldSecret);
    const oldTokenHash = current.tokenHash;
    const updateMany = jest.fn(
      (args: {
        data: { tokenHash: string; expiresAt: Date; lastSentAt: Date };
      }) => {
        Object.assign(current, args.data);
        return Promise.resolve({ count: 1 });
      },
    );
    const findUniqueOrThrow = jest
      .fn()
      .mockImplementation(() => Promise.resolve(current));
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const tx = {
      userInvitation: { updateMany, findUniqueOrThrow },
    };
    const email = {
      getReadiness: jest.fn().mockReturnValue({ status: 'up' }),
      send: jest.fn().mockResolvedValue('sent'),
    };
    const prisma = {
      userInvitation: { findFirst: jest.fn().mockResolvedValue(current) },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: transactionMock(tx),
    };
    const service = new UserInvitationsService(
      prisma as unknown as PrismaService,
      {
        get: jest.fn().mockReturnValue('https://app.example.test'),
      } as unknown as ConfigService,
      audit as unknown as AuditService,
      email as unknown as EmailService,
    );

    const result = await service.resend(tenant.id, 'admin-1', current.id);

    const updateArgs = firstMockArg<{
      where: {
        id: string;
        tenantId: string;
        tokenHash: string;
        openKey: string;
        acceptedAt: null;
        revokedAt: null;
      };
      data: { tokenHash: string; expiresAt: Date; lastSentAt: Date };
    }>(updateMany);
    expect(updateArgs.where).toEqual({
      id: current.id,
      tenantId: tenant.id,
      tokenHash: oldTokenHash,
      openKey: 'OPEN',
      acceptedAt: null,
      revokedAt: null,
    });
    expect(updateArgs.data.tokenHash).not.toBe(oldTokenHash);
    expect(updateArgs.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(updateArgs.data.lastSentAt).toBeInstanceOf(Date);

    const sent = firstMockArg<{
      payload: { invitationUrl: string };
    }>(email.send);
    const token = new URLSearchParams(
      new URL(sent.payload.invitationUrl).hash.slice(1),
    ).get('token');
    expect(token).toBeTruthy();
    const decoded = Buffer.from(token ?? '', 'base64url').toString('utf8');
    const newSecret = decoded.slice(decoded.indexOf(':') + 1);
    expect(createHash('sha256').update(newSecret).digest('hex')).toBe(
      updateArgs.data.tokenHash,
    );
    expect(result).not.toHaveProperty('tokenHash');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_INVITATION_RESENT' }),
      tx,
    );
  });

  it('revokes only an open invitation in the requested tenant', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'invitation-1',
      email: 'ana@example.test',
    });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const tx = {
      userInvitation: { findFirst, updateMany },
    };
    const prisma = { $transaction: transactionMock(tx) };
    const service = new UserInvitationsService(
      prisma as unknown as PrismaService,
      {} as ConfigService,
      audit as unknown as AuditService,
      {} as EmailService,
    );

    await expect(
      service.revoke('tenant-a', 'admin-a', 'invitation-1'),
    ).resolves.toEqual({ message: 'Invitación revocada.' });

    const lookup = firstMockArg<{
      where: {
        id: string;
        tenantId: string;
        openKey: string;
        acceptedAt: null;
        revokedAt: null;
      };
    }>(findFirst);
    expect(lookup.where).toEqual({
      id: 'invitation-1',
      tenantId: 'tenant-a',
      openKey: 'OPEN',
      acceptedAt: null,
      revokedAt: null,
    });
    const revoke = firstMockArg<{
      where: {
        id: string;
        tenantId: string;
        openKey: string;
        acceptedAt: null;
        revokedAt: null;
      };
      data: { revokedAt: Date; openKey: null };
    }>(updateMany);
    expect(revoke.where).toEqual({
      id: 'invitation-1',
      tenantId: 'tenant-a',
      openKey: 'OPEN',
      acceptedAt: null,
      revokedAt: null,
    });
    expect(revoke.data.revokedAt).toBeInstanceOf(Date);
    expect(revoke.data.openKey).toBeNull();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_INVITATION_REVOKED' }),
      tx,
    );
  });

  it('revokes an invitation that SMTP rejects and reports delivery failure', async () => {
    const created = {
      id: 'invitation-1',
      createdAt: now,
      updatedAt: now,
      tenantId: tenant.id,
      createdByUserId: 'admin-1',
      email: 'ana@example.test',
      nombre: 'Ana',
      apellido: 'Operadora',
      rol: UserRole.OPERADOR,
      tokenHash: 'invitation-hash',
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      lastSentAt: now,
      acceptedAt: null,
      revokedAt: null,
      openKey: 'OPEN',
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const tx = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      tenant: { findUnique: jest.fn().mockResolvedValue(tenant) },
      userInvitation: {
        create: jest.fn().mockResolvedValue(created),
        updateMany,
      },
    };
    const prisma = {
      $transaction: transactionMock(tx),
    };
    const service = new UserInvitationsService(
      prisma as unknown as PrismaService,
      {
        get: jest.fn().mockReturnValue('https://app.example.test'),
      } as unknown as ConfigService,
      audit as unknown as AuditService,
      {
        getReadiness: jest.fn().mockReturnValue({ status: 'up' }),
        send: jest.fn().mockResolvedValue('failed'),
      } as unknown as EmailService,
    );

    await expect(
      service.create(tenant.id, 'admin-1', {
        email: 'ana@example.test',
        nombre: 'Ana',
        apellido: 'Operadora',
        rol: UserRole.OPERADOR,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    const revokeArgs = firstMockArg<{
      where: {
        id: string;
        tenantId: string;
        tokenHash: string;
        openKey: string;
      };
      data: { revokedAt: Date; openKey: null };
    }>(updateMany);
    expect(revokeArgs).toMatchObject({
      where: {
        id: created.id,
        tenantId: tenant.id,
        tokenHash: created.tokenHash,
        openKey: 'OPEN',
      },
      data: {
        openKey: null,
      },
    });
    expect(revokeArgs.data.revokedAt).toBeInstanceOf(Date);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_INVITATION_DELIVERY_FAILED',
      }),
      tx,
    );
  });

  it('accepts a valid invitation once, creates the account as active, and carries tenant login details', async () => {
    const secret = randomBytes(32).toString('base64url');
    const invitation = invitationForSecret(secret);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const createUser = jest.fn().mockResolvedValue({ id: 'new-user-1' });
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const tx = {
      userInvitation: { updateMany },
      user: { create: createUser },
    };
    const prisma = {
      userInvitation: {
        findUnique: jest.fn().mockResolvedValue(invitation),
      },
      $transaction: transactionMock(tx),
    };
    const service = new UserInvitationsService(
      prisma as unknown as PrismaService,
      {} as ConfigService,
      audit as unknown as AuditService,
      {} as EmailService,
    );
    const token = Buffer.from(invitation.id + ':' + secret).toString(
      'base64url',
    );

    await expect(
      service.accept({
        token,
        newPassword: 'Secure-password-123!',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      }),
    ).resolves.toEqual({
      message: 'Tu cuenta quedó activada. Ya puedes iniciar sesión.',
      tenantNit: tenant.nit,
      tenantName: tenant.nombre,
    });

    const acceptArgs = firstMockArg<{
      where: {
        id: string;
        tenantId: string;
        tokenHash: string;
        openKey: string;
        acceptedAt: null;
        revokedAt: null;
        expiresAt: { gt: Date };
      };
      data: { acceptedAt: Date; openKey: null };
    }>(updateMany);
    expect(acceptArgs).toMatchObject({
      where: {
        id: invitation.id,
        tenantId: tenant.id,
        tokenHash: invitation.tokenHash,
        openKey: 'OPEN',
        acceptedAt: null,
        revokedAt: null,
      },
      data: { openKey: null },
    });
    expect(acceptArgs.data.acceptedAt).toBeInstanceOf(Date);
    expect(acceptArgs.where.expiresAt.gt).toBeInstanceOf(Date);
    const createUserArgs = firstMockArg<{
      data: {
        tenantId: string;
        email: string;
        nombre: string;
        apellido: string;
        rol: UserRole;
        activo: boolean;
        passwordHash: string;
      };
    }>(createUser);
    expect(createUserArgs).toMatchObject({
      data: {
        tenantId: tenant.id,
        email: invitation.email,
        nombre: invitation.nombre,
        apellido: invitation.apellido,
        rol: invitation.rol,
        activo: true,
      },
    });
    expect(createUserArgs.data.passwordHash).not.toBe('Secure-password-123!');
    const acceptedAudit = firstMockArg<{
      action: string;
      tenantId: string;
      userId: string;
      metadata: { ip: string | null; userAgent: string | null; rol: string };
    }>(audit.log);
    expect(acceptedAudit).toMatchObject({
      action: 'USER_INVITATION_ACCEPTED',
      tenantId: tenant.id,
      userId: 'new-user-1',
    });
    expect(acceptedAudit.metadata).toEqual({
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      rol: 'OPERADOR',
    });
    expect(audit.log).toHaveBeenCalledWith(expect.any(Object), tx);
  });

  it('rejects expired, malformed, and already-claimed invitation links', async () => {
    const secret = randomBytes(32).toString('base64url');
    const expired = invitationForSecret(secret);
    expired.expiresAt = new Date(now.getTime() - 1000);
    const tx = {
      userInvitation: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      user: { create: jest.fn() },
    };
    const prisma = {
      userInvitation: { findUnique: jest.fn().mockResolvedValue(expired) },
      $transaction: transactionMock(tx),
    };
    const service = new UserInvitationsService(
      prisma as unknown as PrismaService,
      {} as ConfigService,
      {} as AuditService,
      {} as EmailService,
    );

    await expect(
      service.accept({
        token: Buffer.from(expired.id + ':' + secret).toString('base64url'),
        newPassword: 'Secure-password-123!',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.accept({
        token: 'not-a-valid-token',
        newPassword: 'Secure-password-123!',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expired.expiresAt = new Date(now.getTime() + 60_000);
    await expect(
      service.accept({
        token: Buffer.from(expired.id + ':' + secret).toString('base64url'),
        newPassword: 'Secure-password-123!',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.create).not.toHaveBeenCalled();
  });
});

function invitationForSecret(secret: string) {
  return {
    id: 'invitation-1',
    createdAt: now,
    updatedAt: now,
    tenantId: tenant.id,
    createdByUserId: 'admin-1',
    email: 'ana@example.test',
    nombre: 'Ana',
    apellido: 'Operadora',
    rol: UserRole.OPERADOR,
    tokenHash: createHash('sha256').update(secret).digest('hex'),
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    lastSentAt: now,
    acceptedAt: null,
    revokedAt: null,
    openKey: 'OPEN',
    tenant,
  };
}

function transactionMock<TTransaction extends object>(
  transaction: TTransaction,
) {
  return jest.fn(async (callback: (tx: TTransaction) => Promise<unknown>) =>
    callback(transaction),
  );
}

function firstMockArg<T>(mock: {
  mock: { calls: readonly (readonly unknown[])[] };
}): T {
  const call = mock.mock.calls[0];
  if (!call) throw new Error('Expected mock to be called at least once');
  return call[0] as T;
}
