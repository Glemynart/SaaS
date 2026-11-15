import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

describe('PasswordResetToken tenant integrity PostgreSQL', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const prisma = new PrismaService();
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    await prisma.$connect();

    const tenantARecord = await prisma.tenant.create({
      data: {
        id: tenantA,
        nombre: `Reset token tenant A ${suffix}`,
        nit: `81${suffix.slice(0, 8)}`,
        digitoVerif: '1',
        razonSocial: `Reset token tenant A ${suffix}`,
      },
    });
    const tenantBRecord = await prisma.tenant.create({
      data: {
        id: tenantB,
        nombre: `Reset token tenant B ${suffix}`,
        nit: `82${suffix.slice(0, 8)}`,
        digitoVerif: '2',
        razonSocial: `Reset token tenant B ${suffix}`,
      },
    });
    const [userA, userB] = await Promise.all([
      prisma.user.create({
        data: {
          tenantId: tenantARecord.id,
          email: `reset-a-${suffix}@example.test`,
          passwordHash: 'test-hash',
          nombre: 'Reset A',
          apellido: 'Tenant',
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          tenantId: tenantBRecord.id,
          email: `reset-b-${suffix}@example.test`,
          passwordHash: 'test-hash',
          nombre: 'Reset B',
          apellido: 'Tenant',
        },
        select: { id: true },
      }),
    ]);
    userAId = userA.id;
    userBId = userB.id;
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.tenant.deleteMany({
        where: { id: { in: [tenantA, tenantB] } },
      });
    } finally {
      await prisma.$disconnect();
    }
  }, 30000);

  it('allows a reset token linked to a user in the same tenant', async () => {
    await expect(
      prisma.passwordResetToken.create({
        data: {
          id: `reset-valid-${suffix}`,
          tenantId: tenantA,
          userId: userAId,
          tokenHash: `hash-valid-${suffix}`,
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).resolves.toMatchObject({ tenantId: tenantA, userId: userAId });
  });

  it('rejects a token whose tenant differs from its referenced user', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO "password_reset_tokens"
          ("id", "tenantId", "userId", "tokenHash", "expiresAt")
        VALUES
          (${`reset-invalid-${suffix}`}, ${tenantA}, ${userBId},
           ${`hash-invalid-${suffix}`}, ${new Date(Date.now() + 60_000)})
      `,
    ).rejects.toThrow(/violates foreign key constraint/);
  });
});
