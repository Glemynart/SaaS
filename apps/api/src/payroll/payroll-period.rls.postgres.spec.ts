import { randomUUID } from 'node:crypto';
import { PayrollPeriodStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';

describe('PayrollPeriod PostgreSQL RLS', () => {
  const suffix = randomUUID();
  const role = 'rls_payroll_period_' + suffix.replaceAll('-', '');
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const periodA = randomUUID();
  const periodB = randomUUID();
  const tenantContext = new TenantContextService();
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrismaService(
    { $transaction: runAsRlsRole } as unknown as PrismaService,
    new TenantContextBoundary(tenantContext),
  );

  beforeAll(async () => {
    await prisma.$connect();
    await dropTestRole();
    await prisma.$executeRawUnsafe(
      'CREATE ROLE "' + role + '" NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await prisma.$executeRawUnsafe(
      'GRANT USAGE ON SCHEMA public TO "' + role + '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "payroll_periods" TO "' +
        role +
        '"',
    );

    await prisma.tenant.createMany({
      data: [
        tenantData(tenantA, '91' + suffix.replaceAll('-', '').slice(0, 8)),
        tenantData(tenantB, '92' + suffix.replaceAll('-', '').slice(0, 8)),
      ],
    });
    await prisma.payrollPeriod.createMany({
      data: [periodData(periodA, tenantA), periodData(periodB, tenantB)],
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.payrollPeriod.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.tenant.deleteMany({
        where: { id: { in: [tenantA, tenantB] } },
      });
      await dropTestRole();
    } finally {
      await prisma.$disconnect();
    }
  }, 30000);

  it('enables and forces tenant RLS with no delete policy', async () => {
    const [table] = await prisma.$queryRawUnsafe<
      { rowSecurity: boolean; forceRowSecurity: boolean }[]
    >(
      'SELECT relrowsecurity AS "rowSecurity", ' +
        'relforcerowsecurity AS "forceRowSecurity" ' +
        "FROM pg_class WHERE oid = 'public.payroll_periods'::regclass",
    );
    const policies = await prisma.$queryRawUnsafe<{ command: string }[]>(
      'SELECT cmd AS command FROM pg_policies ' +
        "WHERE schemaname = 'public' AND tablename = 'payroll_periods' " +
        'ORDER BY cmd',
    );
    const roleAttributes = await prisma.$queryRawUnsafe<
      { superuser: boolean; bypassRls: boolean; canLogin: boolean }[]
    >(
      'SELECT rolsuper AS "superuser", rolbypassrls AS "bypassRls", ' +
        'rolcanlogin AS "canLogin" FROM pg_roles WHERE rolname = \'' +
        role +
        "'",
    );

    expect(table).toEqual({ rowSecurity: true, forceRowSecurity: true });
    expect(policies.map(({ command }) => command)).toEqual([
      'INSERT',
      'SELECT',
      'UPDATE',
    ]);
    expect(roleAttributes).toEqual([
      { superuser: false, bypassRls: false, canLogin: false },
    ]);
  });

  it('isolates reads by tenant and hides every row without tenant context', async () => {
    const readPeriods = (client: TenantPrismaClient) =>
      client.payrollPeriod.findMany({
        where: { id: { in: [periodA, periodB] } },
        select: { id: true, tenantId: true },
        orderBy: { id: 'asc' },
      });
    const readForTenant = (tenantId: string) =>
      tenantContext.run(
        {
          tenantId,
          userId: 'payroll-period-rls-test-user',
          rol: 'ADMIN',
          email: 'payroll-period-rls-test@example.test',
        },
        () => tenantPrisma.execute(readPeriods),
      );

    const [rowsA, rowsB, rowsWithoutContext] = await Promise.all([
      readForTenant(tenantA),
      readForTenant(tenantB),
      runAsRlsRole((client) => client.payrollPeriod.findMany()),
    ]);

    expect(rowsA).toEqual([{ id: periodA, tenantId: tenantA }]);
    expect(rowsB).toEqual([{ id: periodB, tenantId: tenantB }]);
    expect(rowsWithoutContext).toEqual([]);
  });

  it('allows own inserts and rejects missing or cross-tenant inserts', async () => {
    const ownPeriodId = randomUUID();
    const own = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.payrollPeriod.create({
          data: periodData(ownPeriodId, tenantA),
          select: { id: true, tenantId: true },
        }),
      ),
    );

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.payrollPeriod.create({
            data: periodData(randomUUID(), tenantB),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      runAsRlsRole((client) =>
        client.payrollPeriod.create({
          data: periodData(randomUUID(), tenantA),
        }),
      ),
    ).rejects.toThrow();

    expect(own).toEqual({ id: ownPeriodId, tenantId: tenantA });
  });

  it('allows tenant updates, blocks cross-tenant changes, and prevents deletes', async () => {
    const ownUpdate = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.payrollPeriod.updateMany({
          where: { id: periodA, tenantId: tenantA },
          data: { nombre: 'Período actualizado' },
        }),
      ),
    );
    const crossTenantUpdate = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.payrollPeriod.updateMany({
          where: { id: periodB, tenantId: tenantB },
          data: { nombre: 'No debe verse' },
        }),
      ),
    );

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.payrollPeriod.updateMany({
            where: { id: periodA },
            data: { tenantId: tenantB },
          }),
        ),
      ),
    ).rejects.toThrow();

    const deleteWithoutContext = await runAsRlsRole((client) =>
      client.payrollPeriod.deleteMany({ where: { id: periodA } }),
    );
    const deleteWithContext = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.payrollPeriod.deleteMany({ where: { id: periodA } }),
      ),
    );

    expect(ownUpdate.count).toBe(1);
    expect(crossTenantUpdate.count).toBe(0);
    expect(deleteWithoutContext.count).toBe(0);
    expect(deleteWithContext.count).toBe(0);
    await expect(
      prisma.payrollPeriod.findUniqueOrThrow({ where: { id: periodA } }),
    ).resolves.toMatchObject({ nombre: 'Período actualizado' });
  });

  function withTenant<T>(tenantId: string, work: () => Promise<T>): Promise<T> {
    return tenantContext.run(
      {
        tenantId,
        userId: 'payroll-period-rls-test-user',
        rol: 'ADMIN',
        email: 'payroll-period-rls-test@example.test',
      },
      work,
    );
  }

  function runAsRlsRole<T>(
    work: (client: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (client) => {
      await client.$executeRawUnsafe('SET LOCAL ROLE "' + role + '"');
      return work(client);
    });
  }

  async function dropTestRole(): Promise<void> {
    await prisma.$executeRawUnsafe(
      'DO $$\n' +
        'BEGIN\n' +
        "  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '" +
        role +
        "') THEN\n" +
        '    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "' +
        role +
        '";\n' +
        '    REVOKE ALL PRIVILEGES ON SCHEMA public FROM "' +
        role +
        '";\n' +
        '    DROP ROLE "' +
        role +
        '";\n' +
        '  END IF;\n' +
        'END;\n' +
        '$$',
    );
  }

  function tenantData(id: string, nit: string) {
    return {
      id,
      nombre: 'Tenant payroll period ' + id,
      nit,
      digitoVerif: '1',
      razonSocial: 'Tenant payroll period ' + id,
    };
  }

  function periodData(id: string, tenantId: string) {
    return {
      id,
      tenantId,
      nombre: 'Período ' + id,
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2026-01-31T00:00:00.000Z'),
      status: PayrollPeriodStatus.BORRADOR,
    };
  }
});
