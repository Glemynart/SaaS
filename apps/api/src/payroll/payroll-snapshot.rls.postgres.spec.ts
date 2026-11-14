import { randomUUID } from 'node:crypto';
import { PayrollPeriodStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';

describe('PayrollSnapshot PostgreSQL RLS', () => {
  const suffix = randomUUID();
  const role = 'rls_payroll_snapshot_' + suffix.replaceAll('-', '');
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const actorA = randomUUID();
  const actorB = randomUUID();
  const employeeA = randomUUID();
  const employeeB = randomUUID();
  const employeeForInsertA = randomUUID();
  const periodA = randomUUID();
  const periodB = randomUUID();
  const runA = randomUUID();
  const runB = randomUUID();
  const runForInsertA = randomUUID();
  const snapshotA = randomUUID();
  const snapshotB = randomUUID();
  const snapshotForInsertA = randomUUID();
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
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "payroll_snapshots" TO "' +
        role +
        '"',
    );

    await prisma.$transaction(async (tx) => {
      await tx.tenant.createMany({
        data: [
          tenantData(tenantA, '91' + suffix.replaceAll('-', '').slice(0, 8)),
          tenantData(tenantB, '92' + suffix.replaceAll('-', '').slice(0, 8)),
        ],
      });
      await tx.user.createMany({
        data: [userData(actorA, tenantA, 'a'), userData(actorB, tenantB, 'b')],
      });
      await tx.empleado.createMany({
        data: [
          employeeData(employeeA, tenantA, 'a'),
          employeeData(employeeB, tenantB, 'b'),
          employeeData(employeeForInsertA, tenantA, 'insert'),
        ],
      });
      await tx.payrollPeriod.createMany({
        data: [
          periodData(periodA, tenantA, actorA),
          periodData(periodB, tenantB, actorB),
        ],
      });
      await tx.payrollRun.createMany({
        data: [
          runData(runA, tenantA, periodA, employeeA),
          runData(runB, tenantB, periodB, employeeB),
          runData(runForInsertA, tenantA, periodA, employeeForInsertA),
        ],
      });
      await tx.payrollSnapshot.createMany({
        data: [
          snapshotData(snapshotA, tenantA, runA, periodA, employeeA),
          snapshotData(snapshotB, tenantB, runB, periodB, employeeB),
        ],
      });
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.payrollSnapshot.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.payrollRun.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.payrollPeriod.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.empleado.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.user.deleteMany({
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
        "FROM pg_class WHERE oid = 'public.payroll_snapshots'::regclass",
    );
    const policies = await prisma.$queryRawUnsafe<{ command: string }[]>(
      'SELECT cmd AS command FROM pg_policies ' +
        "WHERE schemaname = 'public' AND tablename = 'payroll_snapshots' " +
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

  it('isolates snapshots for each tenant and returns no rows without tenant context', async () => {
    const readSnapshots = (client: TenantPrismaClient) =>
      client.payrollSnapshot.findMany({
        where: { id: { in: [snapshotA, snapshotB] } },
        select: { id: true, tenantId: true },
        orderBy: { id: 'asc' },
      });
    const readForTenant = (tenantId: string) =>
      tenantContext.run(
        {
          tenantId,
          userId: 'payroll-snapshot-rls-test-user',
          rol: 'ADMIN',
          email: 'payroll-snapshot-rls-test@example.com',
        },
        () => tenantPrisma.execute(readSnapshots),
      );

    const [rowsA, rowsB, rowsWithoutContext] = await Promise.all([
      readForTenant(tenantA),
      readForTenant(tenantB),
      runAsRlsRole((client) => client.payrollSnapshot.findMany()),
    ]);

    expect(rowsA).toEqual([{ id: snapshotA, tenantId: tenantA }]);
    expect(rowsB).toEqual([{ id: snapshotB, tenantId: tenantB }]);
    expect(rowsWithoutContext).toEqual([]);
  });

  it('allows own-tenant inserts and rejects inserts for another tenant', async () => {
    const createSnapshot = (
      snapshotId: string,
      tenantId: string,
      runId: string,
      periodId: string,
      employeeId: string,
    ) =>
      tenantPrisma.execute((client) =>
        client.payrollSnapshot.create({
          data: snapshotData(snapshotId, tenantId, runId, periodId, employeeId),
          select: { id: true, tenantId: true },
        }),
      );
    const created = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'payroll-snapshot-rls-test-user',
        rol: 'ADMIN',
        email: 'payroll-snapshot-rls-test@example.com',
      },
      () =>
        createSnapshot(
          snapshotForInsertA,
          tenantA,
          runForInsertA,
          periodA,
          employeeForInsertA,
        ),
    );

    await expect(
      tenantContext.run(
        {
          tenantId: tenantA,
          userId: 'payroll-snapshot-rls-test-user',
          rol: 'ADMIN',
          email: 'payroll-snapshot-rls-test@example.com',
        },
        () => createSnapshot(randomUUID(), tenantB, runA, periodA, employeeA),
      ),
    ).rejects.toThrow();

    await expect(
      runAsRlsRole((client) =>
        client.payrollSnapshot.create({
          data: snapshotData(randomUUID(), tenantA, runA, periodA, employeeA),
        }),
      ),
    ).rejects.toThrow();

    expect(created).toEqual({ id: snapshotForInsertA, tenantId: tenantA });
  });

  it('does not allow updating or deleting immutable approved snapshots', async () => {
    const result = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'payroll-snapshot-rls-test-user',
        rol: 'ADMIN',
        email: 'payroll-snapshot-rls-test@example.com',
      },
      () =>
        tenantPrisma.execute(async (client) => {
          const update = await client.payrollSnapshot.updateMany({
            where: { id: snapshotA },
            data: { origen: 'MUTATED' },
          });
          const deletion = await client.payrollSnapshot.deleteMany({
            where: { id: snapshotA },
          });
          return { update, deletion };
        }),
    );

    expect(result.update.count).toBe(0);
    expect(result.deletion.count).toBe(0);
    await expect(
      prisma.payrollSnapshot.findUniqueOrThrow({ where: { id: snapshotA } }),
    ).resolves.toMatchObject({ origen: 'APPROVED_TEST' });
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
      nombre: 'Tenant payroll snapshot ' + id,
      nit,
      digitoVerif: '1',
      razonSocial: 'Tenant payroll snapshot ' + id,
    };
  }

  function userData(id: string, tenantId: string, key: string) {
    return {
      id,
      tenantId,
      email: 'payroll-snapshot-' + key + '-' + id + '@example.test',
      passwordHash: 'not-a-real-password-hash',
      nombre: 'Usuario',
      apellido: 'Prueba',
      rol: 'ADMIN' as const,
    };
  }

  function employeeData(id: string, tenantId: string, key: string) {
    return {
      id,
      tenantId,
      cedula: 'payroll-snapshot-' + key + '-' + id,
      primerNombre: 'Empleado',
      primerApellido: 'Prueba',
      cargo: 'Operario',
      salario: 1_000_000,
      fechaIngreso: new Date('2025-01-01T00:00:00.000Z'),
    };
  }

  function periodData(id: string, tenantId: string, approvedById: string) {
    return {
      id,
      tenantId,
      nombre: 'Período RLS ' + id,
      fechaInicio: new Date('2026-03-01T00:00:00.000Z'),
      fechaFin: new Date('2026-03-31T00:00:00.000Z'),
      status: PayrollPeriodStatus.APROBADA,
      aprobadoPorId: approvedById,
      aprobadoEn: new Date('2026-03-31T18:00:00.000Z'),
    };
  }

  function runData(
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
      totalDevengos: 1_000_000,
      totalDeducciones: 80_000,
      netoPagar: 920_000,
      salarioBaseSnapshot: 1_000_000,
    };
  }

  function snapshotData(
    id: string,
    tenantId: string,
    payrollRunId: string,
    payrollPeriodId: string,
    employeeId: string,
  ) {
    return {
      id,
      tenantId,
      payrollRunId,
      payrollPeriodId,
      employeeId,
      estadoPeriodo: PayrollPeriodStatus.APROBADA,
      origen: 'APPROVED_TEST',
      payloadVersion: 1,
      payload: { source: 'payroll snapshot RLS integration' },
    };
  }
});
