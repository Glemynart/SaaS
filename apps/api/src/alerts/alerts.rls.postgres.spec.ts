import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import {
  AlertGenerationRunStatus,
  AlertGenerationRunTenantStatus,
  AlertGenerationRunTrigger,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';
import { AlertsService } from './alerts.service';
import { AlertsSchedulerService } from './alerts-scheduler.service';

describe('Alerts PostgreSQL RLS', () => {
  const suffix = randomUUID();
  const role = `rls_alerts_${suffix.replaceAll('-', '')}`;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const employeeA = randomUUID();
  const employeeB = randomUUID();
  const alertA = randomUUID();
  const alertB = randomUUID();
  const runId = randomUUID();
  const resultAId = randomUUID();
  const resultBId = randomUUID();
  const context = new TenantContextService();
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrismaService(
    { $transaction: runAsRlsRole } as unknown as PrismaService,
    new TenantContextBoundary(context),
  );
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new AlertsService(tenantPrisma, auditService as never);
  const scheduler = new AlertsSchedulerService(
    prisma,
    tenantPrisma,
    service,
    context,
    auditService as never,
  );

  beforeAll(async () => {
    await prisma.$connect();
    await dropTestRole();
    await prisma.$executeRawUnsafe(
      `CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOBYPASSRLS`,
    );
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    // The runtime role can read business tables; RLS remains the tenant boundary.
    // Granting schema reads also permits nested RLS policies on documents and contracts.
    await prisma.$executeRawUnsafe(
      `GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `REVOKE ALL PRIVILEGES ON TABLE "_prisma_migrations" FROM "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "alerts_new" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "alert_generation_run_tenants" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT DELETE ON TABLE "alert_generation_runs" TO "${role}"`,
    );

    await prisma.tenant.createMany({
      data: [tenantData(tenantA, '91'), tenantData(tenantB, '92')],
    });
    await prisma.empleado.createMany({
      data: [
        employeeData(employeeA, tenantA, '111'),
        employeeData(employeeB, tenantB, '222'),
      ],
    });
    await prisma.alert.createMany({
      data: [
        alertData(alertA, tenantA, employeeA),
        alertData(alertB, tenantB, employeeB),
      ],
    });
    await prisma.alertGenerationRun.create({
      data: {
        id: runId,
        schedulerKey: 'alerts-daily-generation',
        trigger: AlertGenerationRunTrigger.SCHEDULED,
        status: AlertGenerationRunStatus.PARTIAL,
        tenantsProcessed: 2,
        tenantsFailed: 1,
        contractAlertsCreated: 33,
        missingDocAlertsCreated: 44,
      },
    });
    await prisma.alertGenerationRunTenant.createMany({
      data: [
        {
          id: resultAId,
          runId,
          tenantId: tenantA,
          status: AlertGenerationRunTenantStatus.SUCCEEDED,
          contractAlertsCreated: 2,
          missingDocAlertsCreated: 3,
        },
        {
          id: resultBId,
          runId,
          tenantId: tenantB,
          status: AlertGenerationRunTenantStatus.FAILED,
          attemptCount: 2,
          lastErrorCode: 'OTHER_TENANT_FAILURE',
          contractAlertsCreated: 31,
          missingDocAlertsCreated: 41,
        },
      ],
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.alertGenerationRunTenant.deleteMany({
        where: { id: { in: [resultAId, resultBId] } },
      });
      await prisma.alertGenerationRun.deleteMany({ where: { id: runId } });
      await prisma.alert.deleteMany({
        where: { id: { in: [alertA, alertB] } },
      });
      await prisma.empleado.deleteMany({
        where: { id: { in: [employeeA, employeeB] } },
      });
      await prisma.tenant.deleteMany({
        where: { id: { in: [tenantA, tenantB] } },
      });
      await dropTestRole();
    } finally {
      await prisma.$disconnect();
    }
  }, 30000);

  it('activa y fuerza RLS con solo lectura, creación y resolución', async () => {
    const [table] = await prisma.$queryRawUnsafe<
      { rowSecurity: boolean; forceRowSecurity: boolean }[]
    >(
      `SELECT relrowsecurity AS "rowSecurity", relforcerowsecurity AS "forceRowSecurity" ` +
        `FROM pg_class WHERE oid = 'public.alerts_new'::regclass`,
    );
    const policies = await prisma.$queryRawUnsafe<{ command: string }[]>(
      `SELECT cmd AS command FROM pg_policies ` +
        `WHERE schemaname = 'public' AND tablename = 'alerts_new' ORDER BY cmd`,
    );
    const [runTenantTable] = await prisma.$queryRawUnsafe<
      { rowSecurity: boolean; forceRowSecurity: boolean }[]
    >(
      `SELECT relrowsecurity AS "rowSecurity", relforcerowsecurity AS "forceRowSecurity" ` +
        `FROM pg_class WHERE oid = 'public.alert_generation_run_tenants'::regclass`,
    );
    const runTenantPolicies = await prisma.$queryRawUnsafe<
      { command: string }[]
    >(
      `SELECT cmd AS command FROM pg_policies ` +
        `WHERE schemaname = 'public' AND tablename = 'alert_generation_run_tenants' ORDER BY cmd`,
    );
    const roleAttributes = await prisma.$queryRawUnsafe<
      { canLogin: boolean; superuser: boolean; bypassRls: boolean }[]
    >(
      `SELECT rolcanlogin AS "canLogin", rolsuper AS "superuser", ` +
        `rolbypassrls AS "bypassRls" FROM pg_roles WHERE rolname = $1`,
      role,
    );

    expect(table).toEqual({ rowSecurity: true, forceRowSecurity: true });
    expect(policies).toEqual([
      { command: 'INSERT' },
      { command: 'SELECT' },
      { command: 'UPDATE' },
    ]);
    expect(runTenantTable).toEqual({
      rowSecurity: true,
      forceRowSecurity: true,
    });
    expect(runTenantPolicies).toEqual([
      { command: 'INSERT' },
      { command: 'SELECT' },
      { command: 'UPDATE' },
    ]);
    expect(roleAttributes).toEqual([
      { canLogin: false, superuser: false, bypassRls: false },
    ]);
  });

  it('limita los servicios y las consultas sin contexto a su tenant', async () => {
    const resultA = await withTenant(tenantA, () =>
      service.findAll(tenantA, {}),
    );
    const resultB = await withTenant(tenantB, () =>
      service.findAll(tenantB, {}),
    );
    const withoutContext = await runAsRlsRole((client) =>
      client.alert.findMany({ where: { id: { in: [alertA, alertB] } } }),
    );

    expect(resultA.data.map(({ id }) => id)).toEqual([alertA]);
    expect(resultB.data.map(({ id }) => id)).toEqual([alertB]);
    expect(withoutContext).toEqual([]);
    await expect(
      withTenant(tenantA, () => service.findOne(tenantA, alertB)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('protege cada resultado del scheduler y no revela agregados globales', async () => {
    const resultA = await withTenant(tenantA, () =>
      scheduler.getLatestForTenant(tenantA),
    );
    const resultB = await withTenant(tenantB, () =>
      scheduler.getLatestForTenant(tenantB),
    );
    const withoutContext = await runAsRlsRole((client) =>
      client.alertGenerationRunTenant.findMany({
        where: { id: { in: [resultAId, resultBId] } },
      }),
    );
    const crossTenantRead = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.alertGenerationRunTenant.findMany({
          where: { id: resultBId },
        }),
      ),
    );

    expect(resultA).toMatchObject({
      id: resultAId,
      status: AlertGenerationRunTenantStatus.SUCCEEDED,
      tenantResult: {
        status: AlertGenerationRunTenantStatus.SUCCEEDED,
        contractAlertsCreated: 2,
        missingDocAlertsCreated: 3,
      },
    });
    expect(resultB).toMatchObject({
      id: resultBId,
      status: AlertGenerationRunTenantStatus.FAILED,
      tenantResult: {
        status: AlertGenerationRunTenantStatus.FAILED,
        lastErrorCode: 'OTHER_TENANT_FAILURE',
        contractAlertsCreated: 31,
        missingDocAlertsCreated: 41,
      },
    });
    expect(resultA).not.toHaveProperty('tenantsFailed');
    expect(resultA).not.toHaveProperty('parentRunId');
    expect(resultA?.id).not.toBe(resultB?.id);
    expect(withoutContext).toEqual([]);
    expect(crossTenantRead).toEqual([]);
  });

  it('no permite reintentar desde otro tenant usando el resultado ni el ID global legado', async () => {
    await expect(
      withTenant(tenantA, () =>
        scheduler.retryFailedTenant(tenantA, resultBId, 'user-a'),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      withTenant(tenantA, () =>
        scheduler.retryFailedTenant(tenantA, runId, 'user-a'),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza escrituras sin contexto y cambios o borrados de otro tenant', async () => {
    await expect(
      runAsRlsRole((client) =>
        client.alertGenerationRunTenant.create({
          data: { runId, tenantId: tenantA },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client, active) =>
          client.alertGenerationRunTenant.create({
            data: { runId, tenantId: active.tenantId },
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.alertGenerationRunTenant.updateMany({
            where: { id: resultAId },
            data: { tenantId: tenantB },
          }),
        ),
      ),
    ).rejects.toThrow();

    const deleted = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.alertGenerationRunTenant.deleteMany({
          where: { id: resultAId },
        }),
      ),
    );

    expect(deleted.count).toBe(0);
  });

  it('permite la retención global mediante cascada del run sin política DELETE tenant', async () => {
    const deleted = await runAsRlsRole((client) =>
      client.alertGenerationRun.deleteMany({ where: { id: runId } }),
    );
    const childRows = await prisma.alertGenerationRunTenant.findMany({
      where: { id: { in: [resultAId, resultBId] } },
      select: { id: true },
    });

    expect(deleted.count).toBe(1);
    expect(childRows).toEqual([]);
  });

  it('rechaza relaciones cruzadas, cambios de tenant y borrado físico', async () => {
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client, active) =>
          client.alert.create({
            data: alertData(randomUUID(), active.tenantId, employeeB),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      runAsRlsRole((client) =>
        client.alert.create({
          data: alertData(randomUUID(), tenantA, employeeA),
        }),
      ),
    ).rejects.toThrow();

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.alert.updateMany({
            where: { id: alertA },
            data: { tenantId: tenantB },
          }),
        ),
      ),
    ).rejects.toThrow();
    const deleted = await withTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.alert.deleteMany({ where: { id: alertA } }),
      ),
    );

    expect(deleted.count).toBe(0);
  });

  it('resuelve alertas dentro de una transacción del tenant', async () => {
    const resolved = await withTenant(tenantA, () =>
      service.resolve(tenantA, alertA, 'user-a'),
    );
    const otherTenant = await withTenant(tenantB, () =>
      service.findOne(tenantB, alertB),
    );

    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolvedById).toBe('user-a');
    expect(otherTenant.status).toBe('OPEN');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: tenantA, entityId: alertA }),
      expect.anything(),
    );
  });

  function withTenant<T>(tenantId: string, work: () => Promise<T>): Promise<T> {
    return context.run(
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
      nombre: `Tenant alerts ${nit}`,
      nit: `${nit}12345678`,
      digitoVerif: '1',
      razonSocial: `Tenant alerts ${nit}`,
    };
  }

  function employeeData(id: string, tenantId: string, cedula: string) {
    return {
      id,
      tenantId,
      cedula: `${cedula}-${suffix}`,
      primerNombre: 'Empleado',
      primerApellido: 'Alerta',
      cargo: 'Cargo de prueba',
      salario: 1_000_000,
      fechaIngreso: new Date('2026-01-01T00:00:00.000Z'),
    };
  }

  function alertData(id: string, tenantId: string, employeeId: string) {
    return {
      id,
      tenantId,
      employeeId,
      titulo: 'Alerta de prueba',
      descripcion: 'Descripción de prueba',
      severity: 'WARNING' as const,
    };
  }
});
