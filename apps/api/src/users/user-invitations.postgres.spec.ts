import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { randomUUID, createHash } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserInvitationsService } from './user-invitations.service';

type InvitationDelivery = {
  type: string;
  to: string;
  payload: { invitationUrl: string };
};

describe('UserInvitationsService PostgreSQL integration', () => {
  const suffix = randomUUID();
  const tenantIds = [randomUUID(), randomUUID()];
  const actorIds = [randomUUID(), randomUUID()];
  const prisma = new PrismaService();
  const deliveries: InvitationDelivery[] = [];
  const email = {
    getReadiness: jest.fn(() => ({ status: 'up' as const })),
    send: jest.fn((delivery: InvitationDelivery) => {
      deliveries.push(delivery);
      return Promise.resolve('sent' as const);
    }),
  };
  const service = new UserInvitationsService(
    prisma,
    {
      get: jest.fn(() => 'https://app.example.test'),
    } as unknown as ConfigService,
    new AuditService(prisma),
    email as unknown as EmailService,
  );

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.tenant.createMany({
      data: tenantIds.map((id, index) => ({
        id,
        nombre: `Tenant invitaciones ${index}`,
        nit: `9${suffix.replaceAll('-', '').slice(0, 8)}${index}`,
        digitoVerif: '1',
        razonSocial: `Tenant invitaciones ${index} S.A.S.`,
      })),
    });
    await prisma.user.createMany({
      data: actorIds.map((id, index) => ({
        id,
        tenantId: tenantIds[index],
        email: `admin-${index}-${suffix}@example.test`,
        passwordHash: 'not-a-real-password-hash',
        nombre: 'Admin',
        apellido: 'Prueba',
        rol: UserRole.ADMIN,
      })),
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  it('persists tenant-scoped invitations and atomically activates one account from a one-use token', async () => {
    const sharedEmail = ` Invited-${suffix}@Example.Test `;
    const [invitationA, invitationB] = await Promise.all([
      service.create(tenantIds[0], actorIds[0], {
        email: sharedEmail,
        nombre: 'Ana',
        apellido: 'Operadora',
        rol: UserRole.OPERADOR,
      }),
      service.create(tenantIds[1], actorIds[1], {
        email: sharedEmail,
        nombre: 'Ana',
        apellido: 'Operadora',
        rol: UserRole.OPERADOR,
      }),
    ]);

    expect(invitationA.email).toBe(sharedEmail.trim().toLowerCase());
    expect(invitationB.email).toBe(invitationA.email);
    expect(invitationA).not.toHaveProperty('tokenHash');

    const [tenantAInvitations, tenantBInvitations] = await Promise.all([
      service.findAll(tenantIds[0]),
      service.findAll(tenantIds[1]),
    ]);
    expect(tenantAInvitations.map(({ id }) => id)).toEqual([invitationA.id]);
    expect(tenantBInvitations.map(({ id }) => id)).toEqual([invitationB.id]);

    const tenantADelivery = deliveries.find(
      ({ payload }) =>
        invitationIdFrom(payload.invitationUrl) === invitationA.id,
    );
    expect(tenantADelivery).toBeDefined();
    const token = tokenFrom(tenantADelivery!.payload.invitationUrl);
    const [tokenInvitationId, secret] = Buffer.from(token, 'base64url')
      .toString('utf8')
      .split(':');
    expect(tokenInvitationId).toBe(invitationA.id);

    const persistedInvitation = await prisma.userInvitation.findUniqueOrThrow({
      where: { id: invitationA.id },
    });
    expect(persistedInvitation.tenantId).toBe(tenantIds[0]);
    expect(persistedInvitation.tokenHash).toBe(
      createHash('sha256').update(secret).digest('hex'),
    );
    expect(persistedInvitation.tokenHash).not.toBe(secret);

    const acceptanceAttempts = await Promise.allSettled([
      service.accept({ token, newPassword: 'Secure-password-123!' }),
      service.accept({ token, newPassword: 'Secure-password-123!' }),
    ]);
    expect(
      acceptanceAttempts.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    const rejectedAttempt = acceptanceAttempts.find(
      ({ status }) => status === 'rejected',
    );
    expect(rejectedAttempt?.status).toBe('rejected');
    if (rejectedAttempt?.status !== 'rejected') {
      throw new Error('Expected the second acceptance attempt to be rejected');
    }
    expect(rejectedAttempt.reason).toBeInstanceOf(BadRequestException);

    const [
      acceptedInvitation,
      unrelatedTenantInvitation,
      tenantAUsers,
      tenantBUsers,
    ] = await Promise.all([
      prisma.userInvitation.findUniqueOrThrow({
        where: { id: invitationA.id },
      }),
      prisma.userInvitation.findUniqueOrThrow({
        where: { id: invitationB.id },
      }),
      prisma.user.findMany({
        where: { tenantId: tenantIds[0] },
        orderBy: { email: 'asc' },
      }),
      prisma.user.findMany({
        where: { tenantId: tenantIds[1] },
        orderBy: { email: 'asc' },
      }),
    ]);

    expect(acceptedInvitation.acceptedAt).toBeInstanceOf(Date);
    expect(acceptedInvitation.openKey).toBeNull();
    expect(unrelatedTenantInvitation.acceptedAt).toBeNull();
    expect(unrelatedTenantInvitation.openKey).toBe('OPEN');
    expect(tenantAUsers.map(({ email }) => email)).toEqual([
      `admin-0-${suffix}@example.test`,
      invitationA.email,
    ]);
    expect(tenantBUsers.map(({ email }) => email)).toEqual([
      `admin-1-${suffix}@example.test`,
    ]);

    const acceptedAudits = await prisma.auditLog.findMany({
      where: {
        tenantId: tenantIds[0],
        action: 'USER_INVITATION_ACCEPTED',
        entityId: invitationA.id,
      },
    });
    expect(acceptedAudits).toHaveLength(1);
    expect(acceptedAudits[0].userId).toBe(
      tenantAUsers.find(
        ({ email: userEmail }) => userEmail === invitationA.email,
      )!.id,
    );
  });

  function tokenFrom(invitationUrl: string): string {
    const token = new URLSearchParams(new URL(invitationUrl).hash.slice(1)).get(
      'token',
    );
    if (!token) throw new Error('Invitation delivery did not contain a token');
    return token;
  }

  function invitationIdFrom(invitationUrl: string): string | undefined {
    const decodedToken = Buffer.from(
      tokenFrom(invitationUrl),
      'base64url',
    ).toString('utf8');
    return decodedToken.split(':', 1)[0];
  }
});
