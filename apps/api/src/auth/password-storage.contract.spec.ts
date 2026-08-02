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
        update: jest.fn().mockReturnValue(Promise.resolve({})),
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
      $transaction: jest.fn().mockResolvedValue([]),
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
    expect(revokedUserId).toBe('user-1');
    expect(revokedAt).toBeInstanceOf(Date);
  });
});

async function expectSecureHash(plain: string, hash: string) {
  expect(hash).not.toBe(plain);
  await expect(bcrypt.compare(plain, hash)).resolves.toBe(true);
  expect(bcrypt.getRounds(hash)).toBeGreaterThanOrEqual(APPROVED_BCRYPT_ROUNDS);
}
