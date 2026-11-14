import { PayrollPeriodStatus, PilaEventCode, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { LedgerService } from '../accounting/ledger/ledger.service';
import { PayrollAccountingPreflightService } from './accounting-preflight/payroll-accounting-preflight.service';
import { PayrollService } from './payroll.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';

describe('PayrollPilaEvent PostgreSQL RLS', () => {
  const suffix = randomUUID();
  const role = 'rls_payroll_pila_event_' + suffix.replaceAll('-', '');
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const employeeA = randomUUID();
  const employeeB = randomUUID();
  const extraEmployeeA = randomUUID();
  const draftPeriodA = randomUUID();
  const draftPeriodB = randomUUID();
  const approvedPeriodA = randomUUID();
  const eventA = randomUUID();
  const eventB = randomUUID();
  const approvedEventA = randomUUID();
  const insertedEventA = randomUUID();
  const tenantContext = new TenantContextService();
  const prisma = new PrismaService();
  const rolePrisma = {
    $transaction: <T>(
      work: (tx: Prisma.TransactionClient) => Promise<T>,
      options?: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: Prisma.TransactionIsolationLevel;
      },
    ) =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL ROLE "' + role + '"');
        return work(tx);
      }, options),
  } as unknown as PrismaService;
  const tenantPrisma = new TenantPrismaService(
    rolePrisma,
    new TenantContextBoundary(tenantContext),
  );
  const service = new PayrollService(
    prisma,
    tenantPrisma,
    new AuditService(prisma),
    {} as LedgerService,
    new PayrollAccountingPreflightService(tenantPrisma),
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
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "payroll_pila_events" TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT ON TABLE "payroll_periods", "empleados" TO "' + role + '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT USAGE ON TYPE "PilaEventCode", "PilaVacLrSubtype" TO "' +
        role +
        '"',
    );

    await prisma.$transaction(async (tx) => {
      await tx.tenant.createMany({
        data: [
          tenantData(tenantA, '95' + suffix.replaceAll('-', '').slice(0, 8)),
          tenantData(tenantB, '96' + suffix.replaceAll('-', '').slice(0, 8)),
        ],
      });
      await tx.empleado.createMany({
        data: [
          employeeData(employeeA, tenantA, 'a'),
          employeeData(employeeB, tenantB, 'b'),
          employeeData(extraEmployeeA, tenantA, 'extra'),
        ],
      });
      await tx.payrollPeriod.createMany({
        data: [
          periodData(draftPeriodA, tenantA, PayrollPeriodStatus.BORRADOR),
          periodData(draftPeriodB, tenantB, PayrollPeriodStatus.BORRADOR),
          periodData(approvedPeriodA, tenantA, PayrollPeriodStatus.APROBADA),
        ],
      });
      await tx.payrollPilaEvent.createMany({
        data: [
          eventData(eventA, tenantA, draftPeriodA, employeeA),
          eventData(eventB, tenantB, draftPeriodB, employeeB),
          eventData(approvedEventA, tenantA, approvedPeriodA, employeeA),
        ],
      });
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.payrollPilaEvent.deleteMany({
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
    } finally {
      try {
        await dropTestRole();
      } finally {
        await prisma.$disconnect();
      }
    }
  }, 30000);

  it('enables and forces RLS with only tenant lifecycle policies', async () => {
    const [table] = await prisma.$queryRawUnsafe<
      { rowSecurity: boolean; forceRowSecurity: boolean }[]
    >(
      'SELECT relrowsecurity AS "rowSecurity", ' +
        'relforcerowsecurity AS "forceRowSecurity" ' +
        "FROM pg_class WHERE oid = 'public.payroll_pila_events'::regclass",
    );
    const policies = await prisma.$queryRawUnsafe<{ command: string }[]>(
      'SELECT cmd AS command FROM pg_policies ' +
        "WHERE schemaname = 'public' AND tablename = 'payroll_pila_events' " +
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
      'DELETE',
      'INSERT',
      'SELECT',
    ]);
    expect(roleAttributes).toEqual([
      { superuser: false, bypassRls: false, canLogin: false },
    ]);
  });

  it('scopes the service read to its tenant and preserves approved history', async () => {
    const rowsA = await withTenant(tenantA, () =>
      service.findPilaEvents(tenantA, draftPeriodA),
    );
    const rowsB = await withTenant(tenantB, () =>
      service.findPilaEvents(tenantB, draftPeriodB),
    );
    const approvedRows = await withTenant(tenantA, () =>
      service.findPilaEvents(tenantA, approvedPeriodA),
    );
    const withoutContext = await runAsRlsRole((tx) =>
      tx.payrollPilaEvent.findMany({
        where: { id: { in: [eventA, eventB, approvedEventA] } },
      }),
    );

    expect(rowsA.map(({ id }) => id)).toEqual([eventA]);
    expect(rowsB.map(({ id }) => id)).toEqual([eventB]);
    expect(approvedRows.map(({ id }) => id)).toEqual([approvedEventA]);
    expect(withoutContext).toEqual([]);
    await expect(service.findPilaEvents(tenantA, draftPeriodA)).rejects.toThrow(
      'Se requiere un contexto de tenant válido.',
    );
  });

  it('allows draft tenant events and denies cross-tenant or invalid lifecycle writes', async () => {
    const tenantAContext = () =>
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.payrollPilaEvent.create({
            data: eventData(
              insertedEventA,
              tenantA,
              draftPeriodA,
              extraEmployeeA,
            ),
          }),
        ),
      );
    const created = await tenantAContext();
    expect(created.id).toBe(insertedEventA);

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.payrollPilaEvent.create({
            data: eventData(randomUUID(), tenantA, draftPeriodB, employeeA),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.payrollPilaEvent.create({
            data: eventData(randomUUID(), tenantA, draftPeriodA, employeeB),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.payrollPilaEvent.create({
            data: eventData(randomUUID(), tenantA, approvedPeriodA, employeeA),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      runAsRlsRole((tx) =>
        tx.payrollPilaEvent.create({
          data: eventData(randomUUID(), tenantA, draftPeriodA, employeeA),
        }),
      ),
    ).rejects.toThrow();

    const update = await withTenant(tenantA, () =>
      tenantPrisma.execute((tx) =>
        tx.payrollPilaEvent.updateMany({
          where: { id: insertedEventA },
          data: { fechaInicio: new Date('2026-01-11T00:00:00.000Z') },
        }),
      ),
    );
    const deleteDraft = await withTenant(tenantA, () =>
      tenantPrisma.execute((tx) =>
        tx.payrollPilaEvent.deleteMany({ where: { id: insertedEventA } }),
      ),
    );
    const deleteApproved = await withTenant(tenantA, () =>
      tenantPrisma.execute((tx) =>
        tx.payrollPilaEvent.deleteMany({ where: { id: approvedEventA } }),
      ),
    );
    const deleteOtherTenant = await withTenant(tenantA, () =>
      tenantPrisma.execute((tx) =>
        tx.payrollPilaEvent.deleteMany({ where: { id: eventB } }),
      ),
    );

    expect(update.count).toBe(0);
    expect(deleteDraft.count).toBe(1);
    expect(deleteApproved.count).toBe(0);
    expect(deleteOtherTenant.count).toBe(0);
  }, 30000);

  function withTenant<T>(tenantId: string, work: () => Promise<T>) {
    return tenantContext.run(
      {
        tenantId,
        userId: 'payroll-pila-event-rls-test-user',
        rol: 'ADMIN',
        email: 'payroll-pila-event-rls-test@example.test',
      },
      work,
    );
  }

  function runAsRlsRole<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE "' + role + '"');
      return work(tx);
    });
  }

  async function dropTestRole() {
    await prisma.$executeRawUnsafe(
      'DO $$ BEGIN\n' +
        "  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '" +
        role +
        "') THEN\n" +
        '    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "' +
        role +
        '";\n' +
        '    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM "' +
        role +
        '";\n' +
        '    REVOKE USAGE ON TYPE "PilaEventCode", "PilaVacLrSubtype" FROM "' +
        role +
        '";\n' +
        '    REVOKE ALL PRIVILEGES ON SCHEMA public FROM "' +
        role +
        '";\n' +
        '    DROP ROLE "' +
        role +
        '";\n' +
        '  END IF;\n' +
        'END; $$',
    );
  }

  function tenantData(id: string, nit: string) {
    return {
      id,
      nombre: 'Tenant payroll PILA event ' + id,
      nit,
      digitoVerif: '1',
      razonSocial: 'Tenant payroll PILA event ' + id,
    };
  }

  function employeeData(id: string, tenantId: string, key: string) {
    return {
      id,
      tenantId,
      cedula: 'payroll-pila-event-' + key + '-' + id,
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
      nombre: 'Período de evento PILA ' + id,
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2026-01-31T00:00:00.000Z'),
      status,
    };
  }

  function eventData(
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
      codigo: PilaEventCode.ING,
      fechaInicio: new Date('2026-01-10T00:00:00.000Z'),
    };
  }
});
