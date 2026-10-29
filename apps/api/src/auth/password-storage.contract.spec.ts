import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { PasswordResetService } from './password-reset.service';
import { ConfigService } from '@nestjs/config';

const APPROVED_BCRYPT_ROUNDS = 10;

describe('Password storage security contracts', () => {
  it('UsersService persists only a bcrypt hash with the approved factor', async () => {
    const passwordPlain = 'UserCreationPassword!';
    let persistedPassword:
      | {
          passwordHash: string;
          passwordPlain?: string;
        }
      | undefined;
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(
          (args: {
            data: { passwordHash: string; passwordPlain?: string };
          }) => {
            persistedPassword = args.data;
            return Promise.resolve({ id: 'user-1' });
          },
        ),
      },
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new UsersService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );

    await service.create({
      tenantId: 'tenant-1',
      email: 'USER@example.com',
      passwordPlain,
      nombre: 'Grace',
      apellido: 'Hopper',
      rol: UserRole.ADMIN,
    });

    expect(persistedPassword).toBeDefined();
    if (!persistedPassword) throw new Error('Password hash not persisted');
    expect(persistedPassword.passwordPlain).toBeUndefined();
    await expectSecureHash(passwordPlain, persistedPassword.passwordHash);
  });

  it('password reset persists only a bcrypt hash with the approved factor', async () => {
    const newPassword = 'ReplacementPassword!';
    const resetSecret = 'valid-reset-secret';
    let persistedPassword:
      | {
          passwordHash: string;
          passwordPlain?: string;
        }
      | undefined;
    let revokedUserId: string | undefined;
    let revokedAt: Date | undefined;
    type ResetTokenClaim = {
      where: {
        id: string;
        usedAt: null;
        expiresAt: { gte: Date };
      };
      data: { usedAt: Date };
    };
    let resetTokenClaim: ResetTokenClaim | undefined;
    const transactionClient = {
      passwordResetToken: {
        updateMany: jest.fn((args: ResetTokenClaim) => {
          resetTokenClaim = args;
          return Promise.resolve({ count: 1 });
        }),
      },
      user: {
        update: jest.fn(
          (args: {
            data: { passwordHash: string; passwordPlain?: string };
          }) => {
            persistedPassword = args.data;
            return Promise.resolve({});
          },
        ),
      },
      refreshToken: {
        updateMany: jest.fn(
          (args: {
            where: { userId: string; revokedAt: null };
            data: { revokedAt: Date };
          }) => {
            revokedUserId = args.where.userId;
            revokedAt = args.data.revokedAt;
            return Promise.resolve({ count: 1 });
          },
        ),
      },
    };
    const prisma = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'reset-1',
          userId: 'user-1',
          tenantId: 'tenant-1',
          tokenHash: await bcrypt.hash(resetSecret, APPROVED_BCRYPT_ROUNDS),
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: { id: 'user-1' },
        }),
      },
      $transaction: jest.fn(
        (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new PasswordResetService(
      prisma as unknown as PrismaService,
      {} as ConfigService,
      auditService as unknown as AuditService,
      {} as EmailService,
    );
    const token = Buffer.from(`reset-1:${resetSecret}`).toString('base64');

    await service.consumeReset({ token, newPassword });

    expect(persistedPassword).toBeDefined();
    if (!persistedPassword) throw new Error('Password hash not persisted');
    expect(persistedPassword.passwordPlain).toBeUndefined();
    await expectSecureHash(newPassword, persistedPassword.passwordHash);
    expect(resetTokenClaim?.where.id).toBe('reset-1');
    expect(resetTokenClaim?.where.usedAt).toBeNull();
    expect(resetTokenClaim?.where.expiresAt.gte).toBeInstanceOf(Date);
    expect(resetTokenClaim?.data.usedAt).toEqual(
      resetTokenClaim?.where.expiresAt.gte,
    );
    expect(revokedUserId).toBe('user-1');
    expect(revokedAt).toBeInstanceOf(Date);
  });

  it('rejects a concurrent second use before changing password or sessions', async () => {
    const resetSecret = 'concurrent-reset-secret';
    const passwordUpdate = jest.fn();
    const revokeSessions = jest.fn();
    const claimToken = jest.fn().mockResolvedValue({ count: 0 });
    const transactionClient = {
      passwordResetToken: { updateMany: claimToken },
      user: { update: passwordUpdate },
      refreshToken: { updateMany: revokeSessions },
    };
    const prisma = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'reset-race',
          userId: 'user-1',
          tenantId: 'tenant-1',
          tokenHash: await bcrypt.hash(resetSecret, APPROVED_BCRYPT_ROUNDS),
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: { id: 'user-1' },
        }),
      },
      $transaction: jest.fn(
        (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new PasswordResetService(
      prisma as unknown as PrismaService,
      {} as ConfigService,
      auditService as unknown as AuditService,
      {} as EmailService,
    );
    const token = Buffer.from(`reset-race:${resetSecret}`).toString('base64');

    await expect(
      service.consumeReset({ token, newPassword: 'ReplacementPassword!' }),
    ).rejects.toThrow('Token inválido o expirado.');

    expect(claimToken).toHaveBeenCalledTimes(1);
    expect(passwordUpdate).not.toHaveBeenCalled();
    expect(revokeSessions).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });
});

async function expectSecureHash(plain: string, hash: string) {
  expect(hash).not.toBe(plain);
  await expect(bcrypt.compare(plain, hash)).resolves.toBe(true);
  expect(bcrypt.getRounds(hash)).toBeGreaterThanOrEqual(APPROVED_BCRYPT_ROUNDS);
}
