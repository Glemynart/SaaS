import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';
import { EmployeesService } from './employees.service';

const TEST_ROLE = 'rls_empleados_test_role';

describe('empleados PostgreSQL RLS', () => {
  const suffix = randomUUID();
  const tenantA = `rls-empleados-a-${suffix}`;
  const tenantB = `rls-empleados-b-${suffix}`;
  const employeeA = `rls-empleado-a-${suffix}`;
  const employeeB = `rls-empleado-b-${suffix}`;
  const employeeToDelete = `rls-empleado-delete-${suffix}`;
  const tenantContext = new TenantContextService();
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrismaService(
    { $transaction: runAsRlsRole } as unknown as PrismaService,
    new TenantContextBoundary(tenantContext),
  );
  const employeesService = new EmployeesService(tenantPrisma, {
    log: jest.fn(),
  } as unknown as AuditService);

  beforeAll(async () => {
    await prisma.$connect();
    await dropTestRole();
    await prisma.$executeRawUnsafe(
      `CREATE ROLE "${TEST_ROLE}" NOLOGIN NOSUPERUSER NOBYPASSRLS`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT USAGE ON SCHEMA public TO "${TEST_ROLE}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "empleados" TO "${TEST_ROLE}"`,
    );

    await prisma.tenant.createMany({
      data: [
        tenantData(tenantA, `900${suffix.slice(0, 8)}`),
        tenantData(tenantB, `901${suffix.slice(0, 8)}`),
      ],
    });
    await prisma.empleado.createMany({
      data: [
        employeeData(employeeA, tenantA, '1001'),
        employeeData(employeeB, tenantB, '2001'),
        employeeData(employeeToDelete, tenantA, '1002'),
      ],
    });
  });

  afterAll(async () => {
    await prisma.empleado.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA, tenantB] } },
    });
    await dropTestRole();
    await prisma.$disconnect();
  });

  it('enables and forces RLS for tenant-scoped payroll tables and empleados', async () => {
    const protectedTables = await prisma.$queryRaw<{ tableName: string }[]>`
      SELECT relname AS "tableName"
      FROM pg_class
      WHERE relkind = 'r' AND relrowsecurity
      ORDER BY relname
    `;
    const forcedTables = await prisma.$queryRaw<{ tableName: string }[]>`
      SELECT relname AS "tableName"
      FROM pg_class
      WHERE relkind = 'r' AND relforcerowsecurity
      ORDER BY relname
    `;

    const expectedTenantTables = [
      { tableName: 'empleados' },
      { tableName: 'service_premium_batches' },
      { tableName: 'service_premium_lines' },
    ];
    expect(protectedTables).toEqual(expectedTenantTables);
    expect(forcedTables).toEqual(expectedTenantTables);
  });

  it('allows each tenant to read only its own employees', async () => {
    const tenantAEmployees = await runAsTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.empleado.findMany({
          where: { id: { in: [employeeA, employeeB] } },
          orderBy: { id: 'asc' },
        }),
      ),
    );
    const tenantBEmployees = await runAsTenant(tenantB, () =>
      tenantPrisma.execute((client) =>
        client.empleado.findMany({
          where: { id: { in: [employeeA, employeeB] } },
          orderBy: { id: 'asc' },
        }),
      ),
    );

    expect(tenantAEmployees.map(({ id }) => id)).toEqual([employeeA]);
    expect(tenantBEmployees.map(({ id }) => id)).toEqual([employeeB]);
  });

  it('returns no employees without a tenant context', async () => {
    const employees = await runAsRlsRole((client) =>
      client.empleado.findMany({
        where: { id: { in: [employeeA, employeeB] } },
      }),
    );

    expect(employees).toEqual([]);
  });

  it('allows inserts only for the active tenant', async () => {
    const ownEmployee = await runAsTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.empleado.create({
          data: employeeData(`rls-empleado-insert-${suffix}`, tenantA, '1003'),
        }),
      ),
    );

    await expect(
      runAsTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.empleado.create({
            data: employeeData(
              `rls-empleado-cross-insert-${suffix}`,
              tenantB,
              '2002',
            ),
          }),
        ),
      ),
    ).rejects.toThrow();

    expect(ownEmployee.tenantId).toBe(tenantA);
  });

  it('allows updates only for the active tenant', async () => {
    const ownUpdate = await runAsTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.empleado.updateMany({
          where: { id: employeeA },
          data: { cargo: 'Cargo actualizado por tenant A' },
        }),
      ),
    );
    const crossTenantUpdate = await runAsTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.empleado.updateMany({
          where: { id: employeeB },
          data: { cargo: 'No debe actualizarse' },
        }),
      ),
    );

    await expect(
      runAsTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.empleado.update({
            where: { id: employeeA },
            data: { tenantId: tenantB },
          }),
        ),
      ),
    ).rejects.toThrow();

    expect(ownUpdate.count).toBe(1);
    expect(crossTenantUpdate.count).toBe(0);
    await expect(
      prisma.empleado.findUnique({ where: { id: employeeB } }),
    ).resolves.toMatchObject({
      cargo: 'Cargo base',
      tenantId: tenantB,
    });
  });

  it('allows deletes only for the active tenant', async () => {
    const crossTenantDelete = await runAsTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.empleado.deleteMany({ where: { id: employeeB } }),
      ),
    );
    const ownDelete = await runAsTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.empleado.deleteMany({ where: { id: employeeToDelete } }),
      ),
    );

    expect(crossTenantDelete.count).toBe(0);
    expect(ownDelete.count).toBe(1);
    await expect(
      prisma.empleado.findUnique({ where: { id: employeeToDelete } }),
    ).resolves.toBeNull();
  });

  it('preserves the existing tenantId filter and observable employee service result', async () => {
    const result = await runAsTenant(tenantA, () =>
      employeesService.findAll({ page: 1, limit: 20 }),
    );

    expect(result.data.map(({ tenantId }) => tenantId)).toEqual([
      tenantA,
      tenantA,
    ]);
    expect(result.meta).toMatchObject({ total: 2, page: 1, limit: 20 });
  });

  function runAsRlsRole<T>(
    work: (client: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (client) => {
      await client.$executeRawUnsafe(`SET LOCAL ROLE "${TEST_ROLE}"`);
      return work(client);
    });
  }

  async function dropTestRole(): Promise<void> {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${TEST_ROLE}') THEN
          REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "${TEST_ROLE}";
          REVOKE ALL PRIVILEGES ON SCHEMA public FROM "${TEST_ROLE}";
          DROP ROLE "${TEST_ROLE}";
        END IF;
      END
      $$
    `);
  }

  function runAsTenant<T>(
    tenantId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    return tenantContext.run(
      {
        tenantId,
        userId: 'rls-empleados-test-user',
        rol: 'ADMIN',
        email: 'rls-empleados-test@example.com',
      },
      work,
    );
  }

  function tenantData(id: string, nit: string) {
    return {
      id,
      nombre: `Tenant RLS ${id}`,
      nit,
      digitoVerif: '1',
      razonSocial: `Tenant RLS ${id}`,
    };
  }

  function employeeData(id: string, tenantId: string, cedula: string) {
    return {
      id,
      tenantId,
      cedula: `${cedula}-${suffix}`,
      primerNombre: 'Empleado',
      primerApellido: 'RLS',
      cargo: 'Cargo base',
      salario: 1_000_000,
      fechaIngreso: new Date('2026-01-01T00:00:00.000Z'),
    };
  }
});
