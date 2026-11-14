import { randomUUID } from 'node:crypto';
import { PayrollNoveltyType, PayrollPeriodStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';

describe('PayrollNovelty PostgreSQL RLS', () => {
  const suffix = randomUUID();
  const role = 'rls_payroll_novelty_' + suffix.replaceAll('-', '');
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const employeeA = randomUUID();
  const employeeB = randomUUID();
  const employeeForInsertA = randomUUID();
  const periodA = randomUUID();
  const periodB = randomUUID();
  const noveltyA = randomUUID();
  const noveltyB = randomUUID();
  const noveltyForInsertA = randomUUID();
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
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "payroll_novelties" TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT ON TABLE "payroll_periods", "empleados" TO "' + role + '"',
    );

    await prisma.$transaction(async (tx) => {
      await tx.tenant.createMany({
        data: [
          tenantData(tenantA, '93' + suffix.replaceAll('-', '').slice(0, 8)),
          tenantData(tenantB, '94' + suffix.replaceAll('-', '').slice(0, 8)),
        ],
      });
      await tx.empleado.createMany({
        data: [
          employeeData(employeeA, tenantA, 'a'),
          employeeData(employeeB, tenantB, 'b'),
          employeeData(employeeForInsertA, tenantA, 'insert'),
        ],
      });
      await tx.payrollPeriod.createMany({
        data: [periodData(periodA, tenantA), periodData(periodB, tenantB)],
      });
      await tx.payrollNovelty.createMany({
        data: [
          noveltyData(noveltyA, tenantA, periodA, employeeA),
          noveltyData(noveltyB, tenantB, periodB, employeeB),
        ],
      });
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.payrollNovelty.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.payrollPeriod.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.empleado.deleteMany({
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

  it('enables and forces tenant RLS with only read and insert policies', async () => {
    const [table] = await prisma.$queryRawUnsafe<
      { rowSecurity: boolean; forceRowSecurity: boolean }[]
    >(
      'SELECT relrowsecurity AS "rowSecurity", ' +
        'relforcerowsecurity AS "forceRowSecurity" ' +
        "FROM pg_class WHERE oid = 'public.payroll_novelties'::regclass",
    );
    const policies = await prisma.$queryRawUnsafe<{ command: string }[]>(
      'SELECT cmd AS command FROM pg_policies ' +
        "WHERE schemaname = 'public' AND tablename = 'payroll_novelties' " +
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
    ]);
    expect(roleAttributes).toEqual([
      { superuser: false, bypassRls: false, canLogin: false },
    ]);
  });

  it('isolates reads by tenant and returns no rows without tenant context', async () => {
    const readNovelties = (client: TenantPrismaClient) =>
      client.payrollNovelty.findMany({
        where: { id: { in: [noveltyA, noveltyB] } },
        select: { id: true, tenantId: true },
        orderBy: { id: 'asc' },
      });
    const readForTenant = (tenantId: string) =>
      tenantContext.run(
        {
          tenantId,
          userId: 'payroll-novelty-rls-test-user',
          rol: 'ADMIN',
          email: 'payroll-novelty-rls-test@example.test',
        },
        () => tenantPrisma.execute(readNovelties),
      );

    const [rowsA, rowsB, rowsWithoutContext] = await Promise.all([
      readForTenant(tenantA),
      readForTenant(tenantB),
      runAsRlsRole((client) => client.payrollNovelty.findMany()),
    ]);

    expect(rowsA).toEqual([{ id: noveltyA, tenantId: tenantA }]);
    expect(rowsB).toEqual([{ id: noveltyB, tenantId: tenantB }]);
    expect(rowsWithoutContext).toEqual([]);
  });

  it('allows own inserts and rejects missing or cross-tenant relationships', async () => {
    const createNovelty = (input: {
      id: string;
      tenantId: string;
      payrollPeriodId: string;
      employeeId: string;
    }) =>
      tenantPrisma.execute((client) =>
        client.payrollNovelty.create({
          data: noveltyData(
            input.id,
            input.tenantId,
            input.payrollPeriodId,
            input.employeeId,
          ),
          select: { id: true, tenantId: true },
        }),
      );
    const created = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'payroll-novelty-rls-test-user',
        rol: 'ADMIN',
        email: 'payroll-novelty-rls-test@example.test',
      },
      () =>
        createNovelty({
          id: noveltyForInsertA,
          tenantId: tenantA,
          payrollPeriodId: periodA,
          employeeId: employeeForInsertA,
        }),
    );

    const tenantAContext = {
      tenantId: tenantA,
      userId: 'payroll-novelty-rls-test-user',
      rol: 'ADMIN' as const,
      email: 'payroll-novelty-rls-test@example.test',
    };
    await expect(
      tenantContext.run(tenantAContext, () =>
        createNovelty({
          id: randomUUID(),
          tenantId: tenantA,
          payrollPeriodId: periodB,
          employeeId: employeeA,
        }),
      ),
    ).rejects.toThrow();
    await expect(
      tenantContext.run(tenantAContext, () =>
        createNovelty({
          id: randomUUID(),
          tenantId: tenantA,
          payrollPeriodId: periodA,
          employeeId: employeeB,
        }),
      ),
    ).rejects.toThrow();
    await expect(
      runAsRlsRole((client) =>
        client.payrollNovelty.create({
          data: noveltyData(randomUUID(), tenantA, periodA, employeeForInsertA),
        }),
      ),
    ).rejects.toThrow();

    expect(created).toEqual({ id: noveltyForInsertA, tenantId: tenantA });
  });

  it('does not allow updating or deleting payroll novelties', async () => {
    const result = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'payroll-novelty-rls-test-user',
        rol: 'ADMIN',
        email: 'payroll-novelty-rls-test@example.test',
      },
      () =>
        tenantPrisma.execute(async (client) => {
          const update = await client.payrollNovelty.updateMany({
            where: { id: noveltyA },
            data: { descripcion: 'MUTATED' },
          });
          const deletion = await client.payrollNovelty.deleteMany({
            where: { id: noveltyA },
          });
          return { update, deletion };
        }),
    );

    expect(result.update.count).toBe(0);
    expect(result.deletion.count).toBe(0);
    await expect(
      prisma.payrollNovelty.findUniqueOrThrow({ where: { id: noveltyA } }),
    ).resolves.toMatchObject({ descripcion: null });
  });

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
      nombre: 'Tenant payroll novelty ' + id,
      nit,
      digitoVerif: '1',
      razonSocial: 'Tenant payroll novelty ' + id,
    };
  }

  function employeeData(id: string, tenantId: string, key: string) {
    return {
      id,
      tenantId,
      cedula: 'payroll-novelty-' + key + '-' + id,
      primerNombre: 'Empleado',
      primerApellido: 'Prueba',
      cargo: 'Operario',
      salario: 1_000_000,
      fechaIngreso: new Date('2025-01-01T00:00:00.000Z'),
    };
  }

  function periodData(id: string, tenantId: string) {
    return {
      id,
      tenantId,
      nombre: 'Período de novedad ' + id,
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2026-01-31T00:00:00.000Z'),
      status: PayrollPeriodStatus.BORRADOR,
    };
  }

  function noveltyData(
    id: string,
    tenantId: string,
    payrollPeriodId: string,
    employeeId: string,
  ) {
    return {
      id,
      tenantId,
      payrollPeriodId,
      employeeId,
      tipo: PayrollNoveltyType.BONUS,
      descripcion: null,
      fecha: new Date('2026-01-15T00:00:00.000Z'),
      valor: 50_000,
    };
  }
});
