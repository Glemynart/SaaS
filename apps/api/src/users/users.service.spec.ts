import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const managedUser = {
  id: 'user-2',
  createdAt: new Date(),
  updatedAt: new Date(),
  email: 'operador@example.test',
  nombre: 'Ana',
  apellido: 'Operadora',
  rol: UserRole.OPERADOR,
  activo: true,
  lastLoginAt: null,
};

describe('UsersService management', () => {
  it('lists only tenant-scoped public user fields', async () => {
    let findManyArgs: { select?: Record<string, boolean> } | undefined;
    const findMany = jest.fn((args: { select?: Record<string, boolean> }) => {
      findManyArgs = args;
      return Promise.resolve([managedUser]);
    });
    const service = new UsersService(
      { user: { findMany } } as unknown as PrismaService,
      {} as AuditService,
    );

    await expect(service.findAllManaged('tenant-1')).resolves.toEqual([
      managedUser,
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
    expect(findManyArgs?.select).not.toHaveProperty('passwordHash');
  });

  it('creates a managed user with a bcrypt password and audit entry', async () => {
    let createData:
      | {
          tenantId: string;
          email: string;
          passwordHash: string;
          nombre: string;
          apellido: string;
          rol: UserRole;
          activo: boolean;
        }
      | undefined;
    const create = jest.fn((args: { data: typeof createData }) => {
      createData = args.data;
      return Promise.resolve(managedUser);
    });
    const auditLog = jest.fn().mockResolvedValue(undefined);
    const tx = {
      user: { create },
      userInvitation: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new UsersService(
      prisma as unknown as PrismaService,
      { log: auditLog } as unknown as AuditService,
    );

    await service.createManaged('tenant-1', 'admin-1', {
      email: ' Operador@Example.Test ',
      nombre: ' Ana ',
      apellido: ' Operadora ',
      passwordPlain: 'Secure-password-123!',
      rol: UserRole.OPERADOR,
    });

    expect(createData).toBeDefined();
    if (!createData) throw new Error('Managed user data was not captured');
    expect(createData).toMatchObject({
      tenantId: 'tenant-1',
      email: 'operador@example.test',
      nombre: 'Ana',
      apellido: 'Operadora',
      rol: UserRole.OPERADOR,
      activo: true,
    });
    expect(createData.passwordHash).toBeDefined();
    await expect(
      bcrypt.compare('Secure-password-123!', createData.passwordHash),
    ).resolves.toBe(true);
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'admin-1',
        action: 'USER_CREATED',
      }),
      tx,
    );
  });

  it('does not create a direct account while that email has an open invitation', async () => {
    const create = jest.fn();
    const tx = {
      user: { create },
      userInvitation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'invitation-1' }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new UsersService(
      prisma as unknown as PrismaService,
      {} as AuditService,
    );

    await expect(
      service.createManaged('tenant-1', 'admin-1', {
        email: 'operator@example.test',
        nombre: 'Ana',
        apellido: 'Operadora',
        passwordPlain: 'Secure-password-123!',
        rol: UserRole.OPERADOR,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('does not allow removing the last active administrator', async () => {
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'admin-1',
          rol: UserRole.ADMIN,
          activo: true,
          email: 'admin@example.test',
        }),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new UsersService(
      prisma as unknown as PrismaService,
      {} as AuditService,
    );

    await expect(
      service.updateManaged('tenant-1', 'admin-1', 'admin-1', {
        rol: UserRole.OPERADOR,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates role/status and revokes refresh tokens for the managed user', async () => {
    const update = jest
      .fn()
      .mockResolvedValue({ ...managedUser, activo: false });
    let revokeArgs:
      | {
          where: { userId: string; revokedAt: null };
          data: { revokedAt: Date };
        }
      | undefined;
    const updateMany = jest.fn((args: NonNullable<typeof revokeArgs>) => {
      revokeArgs = args;
      return Promise.resolve({ count: 1 });
    });
    const auditLog = jest.fn().mockResolvedValue(undefined);
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: managedUser.id,
          rol: UserRole.OPERADOR,
          activo: true,
          email: managedUser.email,
        }),
        update,
        count: jest.fn(),
      },
      refreshToken: { updateMany },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new UsersService(
      prisma as unknown as PrismaService,
      { log: auditLog } as unknown as AuditService,
    );

    await service.updateManaged('tenant-1', 'admin-1', managedUser.id, {
      activo: false,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: managedUser.id },
        data: { activo: false },
      }),
    );
    expect(revokeArgs?.where).toEqual({
      userId: managedUser.id,
      revokedAt: null,
    });
    expect(revokeArgs?.data.revokedAt).toBeInstanceOf(Date);
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_UPDATED' }),
      tx,
    );
  });
});
