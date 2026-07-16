import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantExecutionContext } from '../tenant-context/tenant-context.types';
import { TenantPrismaService } from './tenant-prisma.service';

type SettingClient = Pick<Prisma.TransactionClient, '$queryRaw'>;

describe('TenantPrismaService PostgreSQL bridge', () => {
  const tenantContext = new TenantContextService();
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrismaService(
    prisma,
    new TenantContextBoundary(tenantContext),
  );

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('installs the current tenant for the active PostgreSQL transaction', async () => {
    const tenantId = 'tenant-postgres-bridge-a';

    const observedTenantId = await runAsTenant(tenantId, () =>
      tenantPrisma.execute((client) => currentTenantId(client)),
    );

    expect(observedTenantId).toBe(tenantId);
  });

  it('removes the tenant setting when the transaction completes', async () => {
    await runAsTenant('tenant-postgres-bridge-commit', () =>
      tenantPrisma.execute((client) => currentTenantId(client)),
    );

    await expectNoTenantContext();
  });

  it('starts a new transaction without a residual tenant setting', async () => {
    await expectNoTenantContext();
  });

  it('reuses the transaction client and tenant setting for nested work', async () => {
    const tenantId = 'tenant-postgres-bridge-nested';

    await runAsTenant(tenantId, () =>
      tenantPrisma.execute(async (outerClient) => {
        expect(await currentTenantId(outerClient)).toBe(tenantId);

        await tenantPrisma.execute(async (innerClient) => {
          expect(innerClient).toBe(outerClient);
          expect(await currentTenantId(innerClient)).toBe(tenantId);
        });
      }),
    );
  });

  it('removes the tenant setting when the transaction rolls back', async () => {
    const rollback = new Error('rollback tenant bridge transaction');

    await expect(
      runAsTenant('tenant-postgres-bridge-rollback', () =>
        tenantPrisma.execute(async (client) => {
          expect(await currentTenantId(client)).toBe(
            'tenant-postgres-bridge-rollback',
          );
          throw rollback;
        }),
      ),
    ).rejects.toBe(rollback);

    await expectNoTenantContext();
  });

  async function currentTenantId(
    client: SettingClient,
  ): Promise<string | null> {
    const [setting] = await client.$queryRaw<{ tenantId: string | null }[]>`
      SELECT current_setting('app.current_tenant_id', true) AS "tenantId"
    `;

    return setting?.tenantId ?? null;
  }

  async function currentTenantIdInNewTransaction(): Promise<string | null> {
    return prisma.$transaction((client) => currentTenantId(client));
  }

  async function expectNoTenantContext(): Promise<void> {
    const setting = await currentTenantIdInNewTransaction();

    // PostgreSQL may retain a custom setting name with an empty value after
    // SET LOCAL ends; neither representation carries a tenant identity.
    expect([null, '']).toContain(setting);
  }

  function runAsTenant<T>(
    tenantId: string,
    work: (context: TenantExecutionContext) => Promise<T>,
  ): Promise<T> {
    const context: TenantExecutionContext = {
      tenantId,
      userId: 'tenant-postgres-bridge-user',
      rol: 'ADMIN',
      email: 'tenant-postgres-bridge@example.com',
    };

    return tenantContext.run(context, () => work(context));
  }
});
