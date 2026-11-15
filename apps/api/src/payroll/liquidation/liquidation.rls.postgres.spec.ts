import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextBoundary } from '../../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../../tenant-context/tenant-context.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../../tenant-prisma/tenant-prisma.service';
import { LiquidationService } from './liquidation.service';

describe('Liquidation PostgreSQL RLS', () => {
  const suffix = randomUUID();
  const role = `rls_liquidation_${suffix.replaceAll('-', '')}`;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const employeeA = randomUUID();
  const employeeB = randomUUID();
  const employeeC = randomUUID();
  const liquidationA = randomUUID();
  const liquidationB = randomUUID();
  const conceptA = `rls-concept-${suffix}`;
  const tenantContext = new TenantContextService();
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrismaService(
    { $transaction: runAsRlsRole } as unknown as PrismaService,
    new TenantContextBoundary(tenantContext),
  );
  const service = new LiquidationService(prisma, tenantPrisma, {
    log: jest.fn().mockResolvedValue(undefined),
  } as never);

  beforeAll(async () => {
    await prisma.$connect();
    await dropTestRole();
    await prisma.$executeRawUnsafe(
      `CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOBYPASSRLS`,
    );
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await prisma.$executeRawUnsafe(
      `GRANT SELECT ON TABLE "empleados" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "liquidations" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "liquidation_concepts" TO "${role}"`,
    );

    await prisma.tenant.createMany({
      data: [
        tenantData(tenantA, `91${suffix.replaceAll('-', '').slice(0, 8)}`),
        tenantData(tenantB, `92${suffix.replaceAll('-', '').slice(0, 8)}`),
      ],
    });
    await prisma.empleado.createMany({
      data: [
        employeeData(employeeA, tenantA, '111'),
        employeeData(employeeB, tenantB, '222'),
        employeeData(employeeC, tenantA, '333'),
      ],
    });
    await prisma.liquidation.createMany({
      data: [
        liquidationData(liquidationA, tenantA, employeeA),
        liquidationData(liquidationB, tenantB, employeeB),
      ],
    });
    await prisma.liquidationConcept.create({
      data: {
        id: conceptA,
        liquidationId: liquidationA,
        codigo: 'LIQ_TEST',
        nombre: 'Concepto de prueba',
        tipo: 'EARNING',
        base: 100_000,
        factor: 1,
        valor: 100_000,
      },
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.liquidation.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.empleado.deleteMany({
        where: { id: { in: [employeeA, employeeB, employeeC] } },
      });
      await prisma.tenant.deleteMany({
        where: { id: { in: [tenantA, tenantB] } },
      });
      await dropTestRole();
    } finally {
      await prisma.$disconnect();
    }
  }, 30000);

  it('fuerza RLS y limita los comandos a lectura, alta y transición', async () => {
    const [liquidationTable, conceptTable] = await prisma.$queryRawUnsafe<
      { rowSecurity: boolean; forceRowSecurity: boolean }[]
    >(
      'SELECT relrowsecurity AS "rowSecurity", ' +
        'relforcerowsecurity AS "forceRowSecurity" ' +
        "FROM pg_class WHERE oid IN ('public.liquidations'::regclass, 'public.liquidation_concepts'::regclass) " +
        "ORDER BY CASE WHEN relname = 'liquidations' THEN 0 ELSE 1 END",
    );
    const policies = await prisma.$queryRawUnsafe<
      { tableName: string; command: string }[]
    >(
      'SELECT tablename AS "tableName", cmd AS command FROM pg_policies ' +
        "WHERE schemaname = 'public' AND tablename IN ('liquidations', 'liquidation_concepts') " +
        'ORDER BY tablename, cmd',
    );
    const attributes = await prisma.$queryRawUnsafe<
      { superuser: boolean; bypassRls: boolean; canLogin: boolean }[]
    >(
      'SELECT rolsuper AS "superuser", rolbypassrls AS "bypassRls", ' +
        'rolcanlogin AS "canLogin" FROM pg_roles WHERE rolname = $1',
      role,
    );

    expect(liquidationTable).toEqual({
      rowSecurity: true,
      forceRowSecurity: true,
    });
    expect(conceptTable).toEqual({
      rowSecurity: true,
      forceRowSecurity: true,
    });
    expect(policies).toEqual([
      { tableName: 'liquidation_concepts', command: 'INSERT' },
      { tableName: 'liquidation_concepts', command: 'SELECT' },
      { tableName: 'liquidations', command: 'INSERT' },
      { tableName: 'liquidations', command: 'SELECT' },
      { tableName: 'liquidations', command: 'UPDATE' },
    ]);
    expect(attributes).toEqual([
      { superuser: false, bypassRls: false, canLogin: false },
    ]);
  });

  it('aísla la liquidación y sus conceptos por tenant, incluso en el servicio', async () => {
    const rowsA = await withTenant(tenantA, () =>
      service.findAll(tenantA, { page: 1, limit: 10 }),
    );
    const rowsB = await withTenant(tenantB, () =>
      service.findAll(tenantB, { page: 1, limit: 10 }),
    );
    const rowWithoutContext = await runAsRlsRole((client) =>
      client.liquidation.findMany({
        where: { id: { in: [liquidationA, liquidationB] } },
      }),
    );
    const detailA = await withTenant(tenantA, () =>
      service.findOne(tenantA, liquidationA),
    );

    expect(rowsA.data.map(({ id }) => id)).toEqual([liquidationA]);
    expect(rowsB.data.map(({ id }) => id)).toEqual([liquidationB]);
    expect(rowWithoutContext).toEqual([]);
    expect(detailA.concepts.map(({ id }) => id)).toEqual([conceptA]);
  });

  it('permite crear propios, rechaza contexto/relaciones cruzadas y no permite borrar', async () => {
    const ownId = randomUUID();
    const own = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.liquidation.create({
          data: {
            ...liquidationData(ownId, tenantA, employeeC),
            concepts: {
              create: [
                {
                  codigo: 'LIQ_TEST_OWN',
                  nombre: 'Concepto propio',
                  tipo: 'EARNING',
                  base: 100_000,
                  factor: 1,
                  valor: 100_000,
                },
              ],
            },
          },
          include: { concepts: true },
        }),
      ),
    );

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.liquidation.create({
            data: liquidationData(randomUUID(), tenantB, employeeB),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.liquidation.create({
            data: liquidationData(randomUUID(), tenantA, employeeB),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      runAsRlsRole((client) =>
        client.liquidation.create({
          data: liquidationData(randomUUID(), tenantA, employeeA),
        }),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.liquidationConcept.create({
            data: {
              liquidationId: liquidationB,
              codigo: 'LIQ_TEST_CROSS',
              nombre: 'Concepto cruzado',
              tipo: 'EARNING',
              valor: 100_000,
            },
          }),
        ),
      ),
    ).rejects.toThrow();

    const deleteParent = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.liquidation.deleteMany({ where: { id: liquidationA } }),
      ),
    );
    const updateConcept = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.liquidationConcept.updateMany({
          where: { id: conceptA },
          data: { nombre: 'No debe mutar' },
        }),
      ),
    );
    const deleteConcept = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.liquidationConcept.deleteMany({ where: { id: conceptA } }),
      ),
    );

    expect(own.tenantId).toBe(tenantA);
    expect(own.concepts).toHaveLength(1);
    expect(deleteParent.count).toBe(0);
    expect(updateConcept.count).toBe(0);
    expect(deleteConcept.count).toBe(0);
  });

  it('aplica transiciones por tenant y rechaza cambios de propietario', async () => {
    await expect(
      withTenant(tenantA, () =>
        service.approveLiquidation(tenantA, 'rls-test-user', liquidationA),
      ),
    ).resolves.toMatchObject({ status: 'APPROVED' });

    const crossTenantTransition = await withTenant(tenantA, async () => {
      try {
        await service.approveLiquidation(
          tenantA,
          'rls-test-user',
          liquidationB,
        );
        return 'unexpected-success';
      } catch {
        return 'rejected';
      }
    });
    expect(crossTenantTransition).toBe('rejected');

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.liquidation.updateMany({
            where: { id: liquidationA },
            data: { tenantId: tenantB },
          }),
        ),
      ),
    ).rejects.toThrow();

    const crossTenantUpdate = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.liquidation.updateMany({
          where: { id: liquidationB },
          data: { status: 'VOIDED' },
        }),
      ),
    );
    expect(crossTenantUpdate.count).toBe(0);
  });

  function withTenant<T>(tenantId: string, work: () => Promise<T>): Promise<T> {
    return tenantContext.run(
      {
        tenantId,
        userId: 'liquidation-rls-test-user',
        rol: 'ADMIN',
        email: 'liquidation-rls-test@example.test',
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
      nombre: `Tenant liquidation ${id}`,
      nit,
      digitoVerif: '1',
      razonSocial: `Tenant liquidation ${id}`,
    };
  }

  function employeeData(id: string, tenantId: string, cedula: string) {
    return {
      id,
      tenantId,
      cedula: `${cedula}-${suffix}`,
      primerNombre: 'Empleado',
      primerApellido: 'Liquidación',
      cargo: 'Cargo de prueba',
      salario: 1_000_000,
      fechaIngreso: new Date('2026-01-01T00:00:00.000Z'),
    };
  }

  function liquidationData(id: string, tenantId: string, empleadoId: string) {
    return {
      id,
      tenantId,
      empleadoId,
      fechaRetiro: new Date('2026-01-31T00:00:00.000Z'),
      status: 'DRAFT' as const,
      diasLiquidados: 30,
      totalDevengado: 1_000_000,
      totalProvisiones: 300_000,
      totalLiquidacion: 1_300_000,
    };
  }
});
