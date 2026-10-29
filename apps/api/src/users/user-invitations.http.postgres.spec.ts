import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { activateDenyByDefault } from '../auth/authorization/deny-by-default.activation';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

type InvitationDelivery = {
  type: string;
  to: string;
  payload: { invitationUrl: string };
};

describe('User invitations HTTP PostgreSQL integration', () => {
  jest.setTimeout(30_000);

  const suffix = randomUUID();
  const tenantA = {
    nit: `9${suffix.replaceAll('-', '').slice(0, 8)}1`,
    email: `admin-a-${suffix}@example.test`,
  };
  const tenantB = {
    nit: `9${suffix.replaceAll('-', '').slice(0, 8)}2`,
    email: `admin-b-${suffix}@example.test`,
  };
  const adminPassword = 'Admin-password-123!';
  const operatorPassword = 'Operator-password-123!';
  const invitedEmail = `operator-${suffix}@example.test`;
  const deliveries: InvitationDelivery[] = [];
  const email = {
    getReadiness: jest.fn(() => ({ status: 'up' as const })),
    send: jest.fn((delivery: InvitationDelivery) => {
      deliveries.push(delivery);
      return Promise.resolve('sent' as const);
    }),
  };

  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;
  let adminAToken: string;
  let adminBToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue(email)
      .compile();

    app = moduleRef.createNestApplication();
    activateDenyByDefault(app, AppModule);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as App;
    prisma = app.get(PrismaService);

    await registerTenant(tenantA, 'Colegio API A');
    await registerTenant(tenantB, 'Colegio API B');
    adminAToken = await login(tenantA, tenantA.email, adminPassword);
    adminBToken = await login(tenantB, tenantB.email, adminPassword);
  });

  afterAll(async () => {
    const tenantIds = await prisma.tenant.findMany({
      where: { nit: { in: [tenantA.nit, tenantB.nit] } },
      select: { id: true },
    });
    const ids = tenantIds.map(({ id }) => id);
    if (ids.length) {
      await prisma.auditLog.deleteMany({ where: { tenantId: { in: ids } } });
      await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
    }
    await app.close();
  });

  it('creates and accepts through authenticated tenant-scoped endpoints', async () => {
    const created = await request(server)
      .post('/users/invitations')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({
        email: invitedEmail,
        nombre: 'Laura',
        apellido: 'Operadora',
        rol: UserRole.OPERADOR,
      })
      .expect(201);

    expect(created.body).toMatchObject({
      email: invitedEmail,
      nombre: 'Laura',
      apellido: 'Operadora',
      rol: UserRole.OPERADOR,
    });
    expect(created.body).not.toHaveProperty('tokenHash');
    const invitationId = bodyAs<{ id: string }>(created.body).id;

    const [tenantAInvitations, tenantBInvitations] = await Promise.all([
      request(server)
        .get('/users/invitations')
        .set('Authorization', `Bearer ${adminAToken}`)
        .expect(200),
      request(server)
        .get('/users/invitations')
        .set('Authorization', `Bearer ${adminBToken}`)
        .expect(200),
    ]);
    expect(
      bodyAs<Array<{ id: string }>>(tenantAInvitations.body).map(
        ({ id }) => id,
      ),
    ).toEqual([invitationId]);
    expect(tenantBInvitations.body).toEqual([]);

    await request(server)
      .post(`/users/invitations/${invitationId}/revoke`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .expect(404);

    const delivery = deliveries.find(({ to }) => to === invitedEmail);
    expect(delivery).toBeDefined();
    const token = tokenFrom(delivery!.payload.invitationUrl);
    const persistedInvitation = await prisma.userInvitation.findUniqueOrThrow({
      where: { id: invitationId },
    });
    expect(persistedInvitation.tenantId).toBe(
      (
        await prisma.tenant.findUniqueOrThrow({
          where: { nit: tenantA.nit },
          select: { id: true },
        })
      ).id,
    );

    const accept = () =>
      request(server)
        .post('/auth/accept-invitation')
        .send({ token, newPassword: operatorPassword });
    const acceptanceAttempts = await Promise.all([accept(), accept()]);
    expect(acceptanceAttempts.map(({ status }) => status).sort()).toEqual([
      200, 400,
    ]);
    expect(
      acceptanceAttempts.find(({ status }) => status === 200)?.body,
    ).toMatchObject({ tenantNit: tenantA.nit, tenantName: 'Colegio API A' });

    const operatorLogin = await request(server)
      .post('/auth/login')
      .send({
        tenantNit: tenantA.nit,
        email: invitedEmail,
        passwordPlain: operatorPassword,
      })
      .expect(200);
    const operatorToken = bodyAs<{ accessToken: string }>(
      operatorLogin.body,
    ).accessToken;

    await request(server)
      .get('/users/invitations')
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(403);
    await request(server)
      .post('/auth/login')
      .send({
        tenantNit: tenantB.nit,
        email: invitedEmail,
        passwordPlain: operatorPassword,
      })
      .expect(401);

    const acceptedInvitation = await prisma.userInvitation.findUniqueOrThrow({
      where: { id: invitationId },
    });
    expect(acceptedInvitation.acceptedAt).toBeInstanceOf(Date);
    expect(acceptedInvitation.openKey).toBeNull();
    expect(
      await prisma.user.count({
        where: { tenantId: persistedInvitation.tenantId, email: invitedEmail },
      }),
    ).toBe(1);
  });

  async function registerTenant(
    tenant: { nit: string; email: string },
    name: string,
  ): Promise<void> {
    await request(server)
      .post('/auth/register')
      .send({
        nombreTenant: name,
        nit: tenant.nit,
        digitoVerif: '1',
        razonSocial: `${name} S.A.S.`,
        email: tenant.email,
        passwordPlain: adminPassword,
        nombre: 'Admin',
        apellido: 'Prueba',
      })
      .expect(201);
  }

  async function login(
    tenant: { nit: string },
    emailAddress: string,
    passwordPlain: string,
  ): Promise<string> {
    const response = await request(server)
      .post('/auth/login')
      .send({
        tenantNit: tenant.nit,
        email: emailAddress,
        passwordPlain,
      })
      .expect(200);
    return bodyAs<{ accessToken: string }>(response.body).accessToken;
  }

  function tokenFrom(invitationUrl: string): string {
    const token = new URLSearchParams(new URL(invitationUrl).hash.slice(1)).get(
      'token',
    );
    if (!token) throw new Error('Invitation delivery did not contain a token');
    return token;
  }

  function bodyAs<T>(body: unknown): T {
    return body as T;
  }
});
