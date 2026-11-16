import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { SYSTEM_AUDIT_ACTORS } from '../audit/audit-actor';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordResetService } from './password-reset.service';

type PasswordResetAuditCall = [
  {
    actor: { kind: string; id: string };
    action: string;
    metadata: Record<string, unknown>;
  },
  unknown,
];

describe('PasswordResetService reset link delivery', () => {
  it('does not send a reset email if the token audit fails', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const create = jest.fn().mockResolvedValue({ id: 'reset-token-id' });
    const tx = { passwordResetToken: { updateMany, create } };
    const sendEmail = jest.fn().mockResolvedValue(undefined);
    const auditLog = jest
      .fn()
      .mockRejectedValue(new Error('audit unavailable'));
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          nit: '900123456',
          activo: true,
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          tenantId: 'tenant-1',
          email: 'admin@example.test',
          nombre: 'Ada',
          apellido: 'Lovelace',
          activo: true,
        }),
      },
      $transaction: jest.fn((work: (client: unknown) => Promise<unknown>) =>
        work(tx),
      ),
    };
    const service = new PasswordResetService(
      prisma as unknown as PrismaService,
      {
        get: jest.fn().mockReturnValue('https://staging.example.test'),
      } as unknown as ConfigService,
      { log: auditLog } as unknown as AuditService,
      { send: sendEmail } as unknown as EmailService,
    );

    await expect(
      service.requestReset({
        tenantNit: '900123456',
        email: 'admin@example.test',
      }),
    ).rejects.toThrow('audit unavailable');

    const [auditInput, auditTransaction] = auditLog.mock
      .calls[0] as unknown as PasswordResetAuditCall;
    expect(auditInput).toMatchObject({
      actor: { kind: 'SYSTEM', id: SYSTEM_AUDIT_ACTORS.PASSWORD_RESET },
      action: 'PASSWORD_RESET_REQUESTED',
      metadata: {
        requester: 'UNAUTHENTICATED',
        subjectUserId: 'user-1',
      },
    });
    expect(auditTransaction).toBe(tx);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('puts new reset tokens in a URL fragment and keeps the generic response', async () => {
    const tx = {
      passwordResetToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'reset-token-id' }),
      },
    };
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          nit: '900123456',
          activo: true,
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          tenantId: 'tenant-1',
          email: 'admin@example.test',
          nombre: 'Ada',
          apellido: 'Lovelace',
          activo: true,
        }),
      },
      $transaction: jest.fn((work: (client: unknown) => Promise<unknown>) =>
        work(tx),
      ),
    };
    let sentResetUrl: string | undefined;
    const sendEmail = jest.fn((params: { payload: { resetUrl: string } }) => {
      sentResetUrl = params.payload.resetUrl;
      return Promise.resolve();
    });
    const auditLog = jest.fn().mockResolvedValue(undefined);
    const service = new PasswordResetService(
      prisma as unknown as PrismaService,
      {
        get: jest.fn().mockReturnValue('https://staging.example.test'),
      } as unknown as ConfigService,
      { log: auditLog } as unknown as AuditService,
      { send: sendEmail } as unknown as EmailService,
    );

    const result = await service.requestReset({
      tenantNit: '900123456',
      email: 'admin@example.test',
    });

    expect(result.message).toBe(
      'Si el correo existe, recibirás instrucciones para restablecer tu contraseña.',
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [auditInput, auditTransaction] = auditLog.mock
      .calls[0] as unknown as PasswordResetAuditCall;
    expect(auditInput).toMatchObject({
      actor: { kind: 'SYSTEM', id: SYSTEM_AUDIT_ACTORS.PASSWORD_RESET },
      action: 'PASSWORD_RESET_REQUESTED',
      metadata: {
        requester: 'UNAUTHENTICATED',
        subjectUserId: 'user-1',
      },
    });
    expect(auditTransaction).toBe(tx);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        auditContext: {
          tenantId: 'tenant-1',
          actor: {
            kind: 'SYSTEM',
            id: SYSTEM_AUDIT_ACTORS.PASSWORD_RESET,
          },
        },
      }),
    );
    expect(sentResetUrl).toBeDefined();
    if (!sentResetUrl) throw new Error('Reset email was not sent');

    const resetUrl = new URL(sentResetUrl);
    expect(resetUrl.pathname).toBe('/restablecer');
    expect(resetUrl.searchParams.has('token')).toBe(false);

    const token = new URLSearchParams(resetUrl.hash.slice(1)).get('token');
    expect(token).toBeTruthy();
    if (!token) throw new Error('Reset token is missing from the URL fragment');
    expect(Buffer.from(token, 'base64').toString('utf8')).toMatch(
      /^reset-token-id:/,
    );
  });
});

describe('PasswordResetService reset token validation', () => {
  const tokenId = 'reset-token-id';
  const secret = 'reset-secret';
  const token = Buffer.from(`${tokenId}:${secret}`).toString('base64');
  let service: PasswordResetService;
  let findToken: jest.Mock;
  let updateToken: jest.Mock;
  let transaction: jest.Mock;
  let updateUser: jest.Mock;
  let revokeSessions: jest.Mock;
  let auditLog: jest.Mock;
  let transactionClient: Record<string, unknown>;
  let validRecord: {
    id: string;
    userId: string;
    tenantId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
  };

  beforeEach(async () => {
    const tokenHash = await bcrypt.hash(secret, 1);
    validRecord = {
      id: tokenId,
      userId: 'user-1',
      tenantId: 'tenant-1',
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    };
    findToken = jest.fn().mockResolvedValue(validRecord);
    updateToken = jest.fn();
    transaction = jest.fn();
    updateUser = jest.fn();
    revokeSessions = jest.fn();
    auditLog = jest.fn().mockResolvedValue(undefined);
    transactionClient = {
      passwordResetToken: { updateMany: updateToken },
      user: { update: updateUser },
      refreshToken: { updateMany: revokeSessions },
    };
    const prisma = {
      passwordResetToken: {
        findUnique: findToken,
        updateMany: updateToken,
      },
      user: { update: updateUser },
      refreshToken: { updateMany: revokeSessions },
      $transaction: transaction,
    };

    service = new PasswordResetService(
      prisma as unknown as PrismaService,
      {} as ConfigService,
      {
        log: auditLog,
      } as unknown as AuditService,
      {} as EmailService,
    );
  });

  it('validates a live token without consuming it or changing account state', async () => {
    await expect(service.validateResetToken(token)).resolves.toEqual({
      valid: true,
    });
    expect(findToken).toHaveBeenCalledWith({ where: { id: tokenId } });
    expect(updateToken).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(revokeSessions).not.toHaveBeenCalled();
  });

  async function expectInvalid(
    record: typeof validRecord | null,
    value: string,
  ) {
    findToken.mockResolvedValue(record);
    await expect(service.validateResetToken(value)).resolves.toEqual({
      valid: false,
    });
    expect(updateToken).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  }

  it('returns invalid for expired tokens', async () => {
    await expectInvalid(
      { ...validRecord, expiresAt: new Date(Date.now() - 1_000) },
      token,
    );
  });

  it('returns invalid for used tokens', async () => {
    await expectInvalid({ ...validRecord, usedAt: new Date() }, token);
  });

  it('returns invalid for unknown token ids', async () => {
    await expectInvalid(
      null,
      Buffer.from('unknown-id:secret').toString('base64'),
    );
  });

  it('returns invalid for an incorrect secret', async () => {
    await expectInvalid(
      validRecord,
      Buffer.from(`${tokenId}:wrong-secret`).toString('base64'),
    );
  });

  it('rejects malformed or oversized token values before a database lookup', async () => {
    await expect(service.validateResetToken('malformed')).resolves.toEqual({
      valid: false,
    });
    await expect(service.validateResetToken('a'.repeat(257))).resolves.toEqual({
      valid: false,
    });
    await expect(service.validateResetToken({ token })).resolves.toEqual({
      valid: false,
    });
    expect(findToken).not.toHaveBeenCalled();
  });

  it('scopes the password update to the tenant recorded on the reset token', async () => {
    updateToken.mockResolvedValue({ count: 1 });
    let userUpdateWhere: { id: string; tenantId?: string } | undefined;
    updateUser.mockImplementation(
      (args: {
        where: { id: string; tenantId?: string };
        data: { passwordHash: string };
      }) => {
        userUpdateWhere = args.where;
        return Promise.resolve({ id: args.where.id });
      },
    );
    revokeSessions.mockResolvedValue({ count: 1 });
    transaction.mockImplementation(
      async (work: (tx: unknown) => Promise<unknown>) =>
        work(transactionClient),
    );

    await expect(
      service.consumeReset({ token, newPassword: 'new secure password' }),
    ).resolves.toEqual({ message: 'Contraseña actualizada exitosamente.' });

    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(userUpdateWhere).toEqual({
      id: validRecord.userId,
      tenantId: validRecord.tenantId,
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PASSWORD_RESET_COMPLETED' }),
      transactionClient,
    );
  });

  it('rejects password reset when its audit event cannot be recorded', async () => {
    updateToken.mockResolvedValue({ count: 1 });
    updateUser.mockResolvedValue({ id: validRecord.userId });
    revokeSessions.mockResolvedValue({ count: 1 });
    transaction.mockImplementation(
      async (work: (tx: unknown) => Promise<unknown>) =>
        work(transactionClient),
    );
    auditLog.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      service.consumeReset({ token, newPassword: 'new secure password' }),
    ).rejects.toThrow('audit unavailable');
  });
});
