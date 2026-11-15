import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';

describe('payroll legal parameters PostgreSQL RLS', () => {
  const suffix = randomUUID();
  const role = `rls_legal_parameters_${suffix.replaceAll('-', '')}`;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const globalId = randomUUID();
  const overrideAId = randomUUID();
  const overrideBId = randomUUID();
  const tenantContext = new TenantContextService();
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrismaService(
    {
      $transaction: <T>(
        work: (tx: Prisma.TransactionClient) => Promise<T>,
        options?: {
          maxWait?: number;
          timeout?: number;
          isolationLevel?: Prisma.TransactionIsolationLevel;
        },
      ) =>
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
          return work(tx);
        }, options),
    } as unknown as PrismaService,
    new TenantContextBoundary(tenantContext),
  );

  beforeAll(async () => {
    await prisma.$connect();
    await dropTestRole();
    await prisma.$executeRawUnsafe(
      `CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOBYPASSRLS`,
    );
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "parametros_legales_nomina" ` +
        `TO "${role}"`,
    );

    await prisma.tenant.createMany({
      data: [
        tenantData(tenantA, `91${suffix.slice(0, 7)}`),
        tenantData(tenantB, `92${suffix.slice(0, 7)}`),
      ],
    });
    await prisma.parametroLegalNomina.createMany({
      data: [
        legalParameterData(globalId, null),
        legalParameterData(overrideAId, tenantA),
        legalParameterData(overrideBId, tenantB),
      ],
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.parametroLegalNomina.deleteMany({
        where: { id: { in: [globalId, overrideAId, overrideBId] } },
      });
      await prisma.tenant.deleteMany({
        where: { id: { in: [tenantA, tenantB] } },
      });
      await dropTestRole();
    } finally {
      await prisma.$disconnect();
    }
  }, 30000);

  it('forces RLS and keeps the runtime role non-privileged', async () => {
    const [table] = await prisma.$queryRaw<
      { rowSecurity: boolean; forceRowSecurity: boolean }[]
    >`
      SELECT relrowsecurity AS "rowSecurity",
             relforcerowsecurity AS "forceRowSecurity"
      FROM pg_class
      WHERE oid = 'public.parametros_legales_nomina'::regclass
    `;
    const [roleAttributes] = await prisma.$queryRawUnsafe<
      { canLogin: boolean; superuser: boolean; bypassRls: boolean }[]
    >(
      `SELECT rolcanlogin AS "canLogin", rolsuper AS "superuser", ` +
        `rolbypassrls AS "bypassRls" FROM pg_roles WHERE rolname = $1`,
      role,
    );
    const policies = await prisma.$queryRaw<
      { command: string; policy: string }[]
    >`
      SELECT cmd AS "command", policyname AS "policy"
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'parametros_legales_nomina'
    `;

    expect(table).toEqual({ rowSecurity: true, forceRowSecurity: true });
    expect(roleAttributes).toEqual({
      canLogin: false,
      superuser: false,
      bypassRls: false,
    });
    expect(policies).toEqual([
      {
        command: 'SELECT',
        policy: 'parametros_legales_nomina_global_or_tenant_select',
      },
    ]);
  });

  it('exposes the global legal catalog and only the active tenant override', async () => {
    const tenantAResult = await withTenant(tenantA, () => readParameters());
    const tenantBResult = await withTenant(tenantB, () => readParameters());
    const withoutContext = await runAsRlsRole((client) => readIds(client));

    expect(tenantAResult).toEqual([globalId, overrideAId].sort());
    expect(tenantBResult).toEqual([globalId, overrideBId].sort());
    expect(withoutContext).toEqual([globalId]);
  });

  it('does not allow runtime insertion, update, or deletion', async () => {
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client, { tenantId }) =>
          client.parametroLegalNomina.create({
            data: legalParameterData(randomUUID(), tenantId),
          }),
        ),
      ),
    ).rejects.toThrow();

    await withTenant(tenantA, () =>
      tenantPrisma.execute(async (client) => {
        const [updated, deleted] = await Promise.all([
          client.parametroLegalNomina.updateMany({
            where: { id: overrideAId },
            data: { fuente: 'alteración de prueba' },
          }),
          client.parametroLegalNomina.deleteMany({
            where: { id: overrideAId },
          }),
        ]);
        expect(updated.count).toBe(0);
        expect(deleted.count).toBe(0);
      }),
    );
  });

  async function readParameters(): Promise<string[]> {
    return tenantPrisma.execute((client) => readIds(client));
  }

  function readIds(client: TenantPrismaClient): Promise<string[]> {
    return client.parametroLegalNomina
      .findMany({
        where: { id: { in: [globalId, overrideAId, overrideBId] } },
        select: { id: true },
        orderBy: { id: 'asc' },
      })
      .then((rows) => rows.map(({ id }) => id).sort());
  }

  function withTenant<T>(tenantId: string, work: () => Promise<T>): Promise<T> {
    return tenantContext.run(
      {
        tenantId,
        userId: `user-${tenantId}`,
        rol: 'ADMIN',
        email: `${tenantId}@example.test`,
      },
      work,
    );
  }

  function runAsRlsRole<T>(
    work: (client: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (client) => {
      await client.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
      return work(client);
    });
  }

  async function dropTestRole(): Promise<void> {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
          REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "${role}";
          REVOKE ALL PRIVILEGES ON SCHEMA public FROM "${role}";
          DROP ROLE "${role}";
        END IF;
      END
      $$
    `);
  }

  function tenantData(id: string, nit: string) {
    return {
      id,
      nombre: `Tenant ${nit}`,
      nit,
      digitoVerif: '1',
      razonSocial: `Tenant ${nit} SAS`,
    };
  }

  function legalParameterData(id: string, tenantId: string | null) {
    return {
      id,
      tenantId,
      vigenciaDesde: new Date('2026-01-01T00:00:00.000Z'),
      anio: 2026,
      smmlv: 1_423_500,
      auxilioTransporte: 202_897,
      uvt: 49_799,
      pctSaludEmpleado: 0.04,
      pctPensionEmpleado: 0.04,
      pctSaludEmpleador: 0.085,
      pctPensionEmpleador: 0.12,
      pctCaja: 0.04,
      pctIcbf: 0.03,
      pctSena: 0.02,
      arlClaseI: 0.00522,
      arlClaseII: 0.01044,
      arlClaseIII: 0.02436,
      arlClaseIV: 0.0435,
      arlClaseV: 0.0696,
      factorProvPrima: 0.0833,
      factorProvCesantias: 0.0833,
      factorProvIntCesantias: 0.01,
      factorProvVacaciones: 0.0417,
      fspTramos: [],
    };
  }
});
