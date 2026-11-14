import { randomUUID } from 'node:crypto';
import {
  PayrollConceptType,
  PayrollPeriodStatus,
  PayrollPilaFspSourceScope,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';

describe('PayrollRun and PayrollConcept PostgreSQL RLS', () => {
  const suffix = randomUUID();
  const role = 'rls_payroll_run_' + suffix.replaceAll('-', '');
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const employeeA = randomUUID();
  const employeeB = randomUUID();
  const periodDraftA = randomUUID();
  const periodInsertA = randomUUID();
  const periodCalculatedA = randomUUID();
  const periodReviewA = randomUUID();
  const periodApprovedA = randomUUID();
  const periodB = randomUUID();
  const runDraftA = randomUUID();
  const runCalculatedA = randomUUID();
  const runReviewA = randomUUID();
  const runApprovedA = randomUUID();
  const runB = randomUUID();
  const conceptDraftA = randomUUID();
  const conceptApprovedA = randomUUID();
  const conceptB = randomUUID();
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
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "payroll_runs", "payroll_concepts" TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT ON TABLE "payroll_periods", "empleados" TO "' + role + '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT USAGE ON TYPE "PayrollPeriodStatus", "PayrollConceptType", ' +
        '"PayrollPilaFspSourceScope", "PayrollPilaVoluntaryPensionStatus" TO "' +
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
      await tx.empleado.createMany({
        data: [
          employeeData(employeeA, tenantA, 'a'),
          employeeData(employeeB, tenantB, 'b'),
        ],
      });
      await tx.payrollPeriod.createMany({
        data: [
          periodData(periodDraftA, tenantA, PayrollPeriodStatus.BORRADOR),
          periodData(periodInsertA, tenantA, PayrollPeriodStatus.BORRADOR),
          periodData(periodCalculatedA, tenantA, PayrollPeriodStatus.CALCULADA),
          periodData(periodReviewA, tenantA, PayrollPeriodStatus.EN_REVISION),
          periodData(periodApprovedA, tenantA, PayrollPeriodStatus.APROBADA),
          periodData(periodB, tenantB, PayrollPeriodStatus.BORRADOR),
        ],
      });
      await tx.payrollRun.createMany({
        data: [
          runData(runDraftA, tenantA, periodDraftA, employeeA),
          runData(runCalculatedA, tenantA, periodCalculatedA, employeeA),
          runData(runReviewA, tenantA, periodReviewA, employeeA),
          runData(runApprovedA, tenantA, periodApprovedA, employeeA),
          runData(runB, tenantB, periodB, employeeB),
        ],
      });
      await tx.payrollConcept.createMany({
        data: [
          conceptData(conceptDraftA, runDraftA),
          conceptData(conceptApprovedA, runApprovedA),
          conceptData(conceptB, runB),
        ],
      });
    });
  }, 30000);

  afterAll(async () => {
    try {
      const runs = await prisma.payrollRun.findMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
        select: { id: true },
      });
      await prisma.payrollConcept.deleteMany({
        where: { payrollRunId: { in: runs.map(({ id }) => id) } },
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
      await prisma.tenant.deleteMany({
        where: { id: { in: [tenantA, tenantB] } },
      });
      await dropTestRole();
    } finally {
      await prisma.$disconnect();
    }
  }, 30000);

  it('enables and forces RLS with lifecycle-specific mutation policies', async () => {
    const tables = await prisma.$queryRawUnsafe<
      { name: string; rowSecurity: boolean; forceRowSecurity: boolean }[]
    >(
      'SELECT c.relname AS name, c.relrowsecurity AS "rowSecurity", ' +
        'c.relforcerowsecurity AS "forceRowSecurity" FROM pg_class c ' +
        "WHERE c.oid IN ('public.payroll_runs'::regclass, 'public.payroll_concepts'::regclass) " +
        'ORDER BY c.relname',
    );
    const policies = await prisma.$queryRawUnsafe<
      { tableName: string; command: string }[]
    >(
      'SELECT tablename AS "tableName", cmd AS command FROM pg_policies ' +
        "WHERE schemaname = 'public' AND tablename IN ('payroll_runs', 'payroll_concepts') " +
        'ORDER BY tablename, cmd',
    );
    const roleAttributes = await prisma.$queryRaw<
      { superuser: boolean; bypassRls: boolean; canLogin: boolean }[]
    >`SELECT rolsuper AS "superuser", rolbypassrls AS "bypassRls",
      rolcanlogin AS "canLogin" FROM pg_roles WHERE rolname = ${role}`;

    expect(tables).toEqual([
      { name: 'payroll_concepts', rowSecurity: true, forceRowSecurity: true },
      { name: 'payroll_runs', rowSecurity: true, forceRowSecurity: true },
    ]);
    expect(policies).toEqual([
      { tableName: 'payroll_concepts', command: 'DELETE' },
      { tableName: 'payroll_concepts', command: 'INSERT' },
      { tableName: 'payroll_concepts', command: 'SELECT' },
      { tableName: 'payroll_runs', command: 'DELETE' },
      { tableName: 'payroll_runs', command: 'INSERT' },
      { tableName: 'payroll_runs', command: 'SELECT' },
      { tableName: 'payroll_runs', command: 'UPDATE' },
    ]);
    expect(roleAttributes).toEqual([
      { superuser: false, bypassRls: false, canLogin: false },
    ]);
  });

  it('isolates runs and their concepts by tenant, including without context', async () => {
    const readForTenant = (tenantId: string) =>
      withTenant(tenantId, () =>
        tenantPrisma.execute(async (client) => {
          const runs = await client.payrollRun.findMany({
            where: { id: { in: [runDraftA, runB] } },
            select: { id: true, tenantId: true },
            orderBy: { id: 'asc' },
          });
          const concepts = await client.payrollConcept.findMany({
            where: { id: { in: [conceptDraftA, conceptB] } },
            select: { id: true, payrollRunId: true },
            orderBy: { id: 'asc' },
          });
          return { runs, concepts };
        }),
      );

    const [a, b, withoutContext] = await Promise.all([
      readForTenant(tenantA),
      readForTenant(tenantB),
      runAsRlsRole(async (client) => ({
        runs: await client.payrollRun.findMany(),
        concepts: await client.payrollConcept.findMany(),
      })),
    ]);

    expect(a.runs).toEqual([{ id: runDraftA, tenantId: tenantA }]);
    expect(a.concepts).toEqual([
      { id: conceptDraftA, payrollRunId: runDraftA },
    ]);
    expect(b.runs).toEqual([{ id: runB, tenantId: tenantB }]);
    expect(b.concepts).toEqual([{ id: conceptB, payrollRunId: runB }]);
    expect(withoutContext).toEqual({ runs: [], concepts: [] });
  });

  it('allows own calculation inserts and rejects wrong tenant or relationships', async () => {
    const insertedRunId = randomUUID();
    const insertedConceptId = randomUUID();
    const ownRun = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.payrollRun.create({
          data: {
            ...runData(insertedRunId, tenantA, periodInsertA, employeeA),
            concepts: {
              create: {
                id: insertedConceptId,
                tipo: PayrollConceptType.EARNING,
                nombre: 'Salario base creado junto a la ejecución',
                valor: 1_000_000,
                codigo: 'SALARIO_BASE',
              },
            },
          },
          select: {
            id: true,
            tenantId: true,
            concepts: { select: { id: true, payrollRunId: true } },
          },
        }),
      ),
    );

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.payrollRun.create({
            data: runData(randomUUID(), tenantA, periodB, employeeA),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.payrollRun.create({
            data: runData(randomUUID(), tenantA, periodDraftA, employeeB),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.payrollRun.create({
            data: runData(randomUUID(), tenantA, periodApprovedA, employeeA),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      runAsRlsRole((client) =>
        client.payrollRun.create({
          data: runData(randomUUID(), tenantA, periodDraftA, employeeA),
        }),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.payrollConcept.create({
            data: conceptData(randomUUID(), runB),
          }),
        ),
      ),
    ).rejects.toThrow();

    expect(ownRun).toEqual({
      id: insertedRunId,
      tenantId: tenantA,
      concepts: [{ id: insertedConceptId, payrollRunId: insertedRunId }],
    });
  });

  it('allows only lifecycle-approved run updates and prevents tenant reassignment', async () => {
    const updateCalculated = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.payrollRun.updateMany({
          where: { id: runCalculatedA },
          data: {
            pilaFspSourceScope:
              PayrollPilaFspSourceScope.SINGLE_SOURCE_CONFIRMED,
          },
        }),
      ),
    );
    const updateReview = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.payrollRun.updateMany({
          where: { id: runReviewA },
          data: {
            pilaFspSourceScope:
              PayrollPilaFspSourceScope.SINGLE_SOURCE_CONFIRMED,
          },
        }),
      ),
    );
    const crossTenantUpdate = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.payrollRun.updateMany({
          where: { id: runB },
          data: { totalDevengos: 1 },
        }),
      ),
    );
    const draftUpdate = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.payrollRun.updateMany({
          where: { id: runDraftA },
          data: { totalDevengos: 1 },
        }),
      ),
    );

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.payrollRun.updateMany({
            where: { id: runCalculatedA },
            data: { tenantId: tenantB },
          }),
        ),
      ),
    ).rejects.toThrow();

    expect(updateCalculated.count).toBe(1);
    expect(updateReview.count).toBe(1);
    expect(crossTenantUpdate.count).toBe(0);
    expect(draftUpdate.count).toBe(0);
  });

  it('permits run and concept deletion only during draft or recalculation', async () => {
    const deleteWithoutContext = await runAsRlsRole((client) =>
      client.payrollRun.deleteMany({ where: { id: runDraftA } }),
    );
    const deleteOtherTenant = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.payrollRun.deleteMany({ where: { id: runB } }),
      ),
    );
    const deleteApprovedConcept = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.payrollConcept.deleteMany({
          where: { id: conceptApprovedA },
        }),
      ),
    );
    const updateConcept = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.payrollConcept.updateMany({
          where: { id: conceptDraftA },
          data: { nombre: 'No editable' },
        }),
      ),
    );
    const deleteDraftConcept = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.payrollConcept.deleteMany({ where: { id: conceptDraftA } }),
      ),
    );
    const deleteDraftRun = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.payrollRun.deleteMany({ where: { id: runDraftA } }),
      ),
    );
    const deleteApprovedRun = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.payrollRun.deleteMany({ where: { id: runApprovedA } }),
      ),
    );

    expect(deleteWithoutContext.count).toBe(0);
    expect(deleteOtherTenant.count).toBe(0);
    expect(deleteApprovedConcept.count).toBe(0);
    expect(updateConcept.count).toBe(0);
    expect(deleteDraftConcept.count).toBe(1);
    expect(deleteDraftRun.count).toBe(1);
    expect(deleteApprovedRun.count).toBe(0);
  });

  function withTenant<T>(tenantId: string, work: () => Promise<T>): Promise<T> {
    return tenantContext.run(
      {
        tenantId,
        userId: 'payroll-run-rls-test-user',
        rol: 'ADMIN',
        email: 'payroll-run-rls-test@example.test',
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
        '    REVOKE USAGE ON TYPE "PayrollPeriodStatus", "PayrollConceptType", ' +
        '"PayrollPilaFspSourceScope", "PayrollPilaVoluntaryPensionStatus" FROM "' +
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
      nombre: 'Tenant payroll run ' + id,
      nit,
      digitoVerif: '1',
      razonSocial: 'Tenant payroll run ' + id,
    };
  }

  function employeeData(id: string, tenantId: string, key: string) {
    return {
      id,
      tenantId,
      cedula: 'payroll-run-' + key + '-' + id,
      primerNombre: 'Empleado',
      primerApellido: 'Prueba',
      cargo: 'Operario',
      salario: 1_000_000,
      fechaIngreso: new Date('2025-01-01T00:00:00.000Z'),
    };
  }

  function periodData(
    id: string,
    tenantId: string,
    status: PayrollPeriodStatus,
  ) {
    return {
      id,
      tenantId,
      nombre: 'Período payroll run ' + id,
      fechaInicio: new Date('2026-03-01T00:00:00.000Z'),
      fechaFin: new Date('2026-03-31T00:00:00.000Z'),
      status,
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

  function conceptData(id: string, payrollRunId: string) {
    return {
      id,
      payrollRunId,
      tipo: PayrollConceptType.EARNING,
      nombre: 'Salario base',
      valor: 1_000_000,
      codigo: 'SALARIO_BASE',
    };
  }
});
