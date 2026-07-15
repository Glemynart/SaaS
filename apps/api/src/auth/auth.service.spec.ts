import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

const APPROVED_BCRYPT_ROUNDS = 10;

describe('AuthService authentication security contracts', () => {
  let prisma: ReturnType<typeof prismaMock>;
  let jwtService: { signAsync: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = prismaMock();
    jwtService = { signAsync: jest.fn().mockResolvedValue('access-token') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      {} as UsersService,
      {} as TenantsService,
      jwtService as unknown as JwtService,
    );
  });

  it('persists a bcrypt password hash with the approved factor on registration', async () => {
    const passwordPlain = 'NeverPersistThisPassword!';
    let persistedPassword:
      | {
          passwordHash: string;
          passwordPlain?: string;
        }
      | undefined;
    const createdUser = {
      id: 'user-1',
      email: 'admin@example.com',
      nombre: 'Ada',
      apellido: 'Lovelace',
      rol: UserRole.ADMIN,
    };
    const tx = {
      tenant: {
        create: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          nombre: 'Tenant',
          nit: '900123456',
        }),
      },
      user: {
        create: jest.fn(
          (args: {
            data: { passwordHash: string; passwordPlain?: string };
          }) => {
            persistedPassword = args.data;
            return Promise.resolve(createdUser);
          },
        ),
      },
    };
    prisma.tenant.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(
      (callback: (transaction: typeof tx) => unknown) => callback(tx),
    );

    await service.register({
      nombreTenant: 'Tenant',
      nit: '900123456',
      digitoVerif: '1',
      razonSocial: 'Tenant SAS',
      email: 'ADMIN@example.com',
      passwordPlain,
      nombre: 'Ada',
      apellido: 'Lovelace',
    });

    expect(persistedPassword).toBeDefined();
    if (!persistedPassword) throw new Error('Password hash not persisted');
    expect(persistedPassword.passwordPlain).toBeUndefined();
    await expect(
      bcrypt.compare(passwordPlain, persistedPassword.passwordHash),
    ).resolves.toBe(true);
    expect(
      bcrypt.getRounds(persistedPassword.passwordHash),
    ).toBeGreaterThanOrEqual(APPROVED_BCRYPT_ROUNDS);
  });

  it('revokes every user session when a revoked refresh token is reused', async () => {
    let revokedUserId: string | undefined;
    let revokedAt: Date | undefined;
    prisma.refreshToken.updateMany.mockImplementation(
      (args: { where: { userId: string }; data: { revokedAt: Date } }) => {
        revokedUserId = args.where.userId;
        revokedAt = args.data.revokedAt;
        return Promise.resolve({ count: 1 });
      },
    );
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'refresh-1',
      userId: 'user-1',
      revokedAt: new Date(),
    });

    const reusedToken = Buffer.from('refresh-1:stolen-secret').toString(
      'base64',
    );

    await expect(service.refresh(reusedToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(revokedUserId).toBe('user-1');
    expect(revokedAt).toBeInstanceOf(Date);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rotates a valid refresh token and stores only the new secret hash', async () => {
    const currentSecret = 'current-refresh-secret';
    let rotatedTokenId: string | undefined;
    let rotatedAt: Date | undefined;
    let persistedToken: { tokenHash: string; secret?: string } | undefined;
    const currentHash = await bcrypt.hash(
      currentSecret,
      APPROVED_BCRYPT_ROUNDS,
    );
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'refresh-1',
      userId: 'user-1',
      tokenHash: currentHash,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
        rol: UserRole.ADMIN,
        email: 'admin@example.com',
        activo: true,
      },
    });
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      activo: true,
    });
    prisma.refreshToken.update.mockImplementation(
      (args: { where: { id: string }; data: { revokedAt: Date } }) => {
        rotatedTokenId = args.where.id;
        rotatedAt = args.data.revokedAt;
        return Promise.resolve({});
      },
    );
    prisma.refreshToken.create.mockImplementation(
      (args: { data: { tokenHash: string; secret?: string } }) => {
        persistedToken = args.data;
        return Promise.resolve({ id: 'refresh-2' });
      },
    );

    const token = Buffer.from(`refresh-1:${currentSecret}`).toString('base64');
    const result = await service.refresh(token, 'test-agent', '127.0.0.1');

    expect(rotatedTokenId).toBe('refresh-1');
    expect(rotatedAt).toBeInstanceOf(Date);
    expect(persistedToken).toBeDefined();
    if (!persistedToken) throw new Error('Refresh token hash not persisted');
    expect(persistedToken.secret).toBeUndefined();
    expect(bcrypt.getRounds(persistedToken.tokenHash)).toBeGreaterThanOrEqual(
      APPROVED_BCRYPT_ROUNDS,
    );

    const [newId, newSecret] = Buffer.from(result.refreshToken, 'base64')
      .toString('ascii')
      .split(':');
    expect(newId).toBe('refresh-2');
    expect(newSecret).not.toBe(currentSecret);
    await expect(
      bcrypt.compare(newSecret, persistedToken.tokenHash),
    ).resolves.toBe(true);
  });
});

function prismaMock() {
  return {
    tenant: { findUnique: jest.fn() },
    user: { update: jest.fn() },
    refreshToken: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}
