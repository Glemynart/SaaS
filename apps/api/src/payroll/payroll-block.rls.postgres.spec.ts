import {
  PayrollBlockStatus,
  PayrollPeriodStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../accounting/ledger/ledger.service';
import { PayrollAccountingPreflightService } from './accounting-preflight/payroll-accounting-preflight.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { PayrollService } from './payroll.service';

describe('PayrollBlock PostgreSQL RLS', () => {
  const suffix = randomUUID();
  const role = 'rls_payroll_block_' + suffix.replaceAll('-', '');
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const employeeA = randomUUID();
  const employeeB = randomUUID();
  const periodA = randomUUID();
  const periodB = randomUUID();
  const approvalPeriodA = randomUUID();
  const approvedPeriodA = randomUUID();
  const actorA = randomUUID();
  const actorB = randomUUID();
  const blockA = randomUUID();
  const blockB = randomUUID();
  const approvedBlockA = randomUUID();
  const insertedBlockA = randomUUID();
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
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "payroll_blocks" TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT ON TABLE "payroll_periods", "empleados", "users", ' +
        '"tenants", "parametros_legales_nomina", "payroll_novelties", ' +
        '"contratos", "payroll_runs", "payroll_concepts", "sedes", ' +
        '"plantillas", "lotes_contrato", "perfiles_contractuales", ' +
        '"document_templates" TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT USAGE ON TYPE "PayrollBlockStatus" TO "' + role + '"',
    );

    await prisma.$transaction(async (tx) => {
      await tx.tenant.createMany({
        data: [
          tenantData(tenantA, nitFor('91')),
          tenantData(tenantB, nitFor('92')),
        ],
      });
      await tx.user.createMany({
        data: [
          userData(actorA, tenantA, 'actor-a'),
          userData(actorB, tenantB, 'actor-b'),
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
          periodData(periodA, tenantA, PayrollPeriodStatus.CALCULADA),
          periodData(periodB, tenantB, PayrollPeriodStatus.CALCULADA),
          periodData(approvalPeriodA, tenantA, PayrollPeriodStatus.EN_REVISION),
          periodData(approvedPeriodA, tenantA, PayrollPeriodStatus.APROBADA),
        ],
      });
      await tx.parametroLegalNomina.create({
        data: legalParamData(tenantA),
      });
      await tx.payrollBlock.createMany({
        data: [
          blockData(blockA, tenantA, periodA, employeeA, actorA),
          blockData(blockB, tenantB, periodB, employeeB),
          blockData(approvedBlockA, tenantA, approvedPeriodA, employeeA),
        ],
      });
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.payrollBlock.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.payrollPeriod.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.empleado.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [actorA, actorB] } },
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
        "FROM pg_class WHERE oid = 'public.payroll_blocks'::regclass",
    );
    const policies = await prisma.$queryRawUnsafe<{ command: string }[]>(
      'SELECT cmd AS command FROM pg_policies ' +
        "WHERE schemaname = 'public' AND tablename = 'payroll_blocks' " +
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

  it('scopes block reads to the tenant and retains approved-period history', async () => {
    const rowsA = await withTenant(tenantA, () =>
      service.findPeriodBlocks(tenantA, periodA),
    );
    const rowsB = await withTenant(tenantB, () =>
      service.findPeriodBlocks(tenantB, periodB),
    );
    const approvedRows = await withTenant(tenantA, () =>
      service.findPeriodBlocks(tenantA, approvedPeriodA),
    );
    const withoutContext = await runAsRlsRole((tx) =>
      tx.payrollBlock.findMany({
        where: { id: { in: [blockA, blockB, approvedBlockA] } },
      }),
    );

    expect(rowsA.map(({ id }) => id)).toEqual([blockA]);
    expect(rowsA[0].excludedBy?.id).toBe(actorA);
    expect(rowsB.map(({ id }) => id)).toEqual([blockB]);
    expect(approvedRows.map(({ id }) => id)).toEqual([approvedBlockA]);
    expect(withoutContext).toEqual([]);
    await expect(service.findPeriodBlocks(tenantA, periodA)).rejects.toThrow(
      'Se requiere un contexto de tenant válido.',
    );
  });

  it('persists newly detected functional blocks when approval is rejected', async () => {
    await expect(
      withTenant(tenantA, () =>
        service.aprobar(tenantA, actorA, approvalPeriodA),
      ),
    ).rejects.toThrow('bloqueos funcionales activos');

    const period = await withTenant(tenantA, () =>
      tenantPrisma.execute((tx) =>
        tx.payrollPeriod.findFirstOrThrow({
          where: { id: approvalPeriodA, tenantId: tenantA },
          select: { status: true },
        }),
      ),
    );
    const blocks = await withTenant(tenantA, () =>
      service.findPeriodBlocks(tenantA, approvalPeriodA),
    );

    expect(period.status).toBe(PayrollPeriodStatus.EN_REVISION);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      employeeId: employeeA,
      code: 'MISSING_ACTIVE_CONTRACT',
      status: PayrollBlockStatus.ACTIVE,
    });
  }, 30000);

  it('allows editable tenant lifecycle changes and blocks cross-tenant links', async () => {
    const created = await withTenant(tenantA, () =>
      tenantPrisma.execute((tx) =>
        tx.payrollBlock.create({
          data: {
            ...blockData(insertedBlockA, tenantA, periodA, employeeA),
            code: 'NEW_BLOCK',
          },
        }),
      ),
    );
    expect(created.id).toBe(insertedBlockA);

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.payrollBlock.create({
            data: blockData(randomUUID(), tenantA, periodB, employeeA),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.payrollBlock.create({
            data: blockData(randomUUID(), tenantA, periodA, employeeB),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.payrollBlock.create({
            data: blockData(randomUUID(), tenantA, approvedPeriodA, employeeA),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      runAsRlsRole((tx) =>
        tx.payrollBlock.create({
          data: blockData(randomUUID(), tenantA, periodA, employeeA),
        }),
      ),
    ).rejects.toThrow();

    const excluded = await withTenant(tenantA, () =>
      tenantPrisma.execute((tx) =>
        tx.payrollBlock.update({
          where: { id: insertedBlockA },
          data: {
            status: PayrollBlockStatus.EXCLUDED,
            excludedAt: new Date(),
            excludedById: actorA,
            exclusionReason: 'Revisión autorizada',
          },
        }),
      ),
    );
    expect(excluded.status).toBe(PayrollBlockStatus.EXCLUDED);
    expect(excluded.excludedById).toBe(actorA);

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.payrollBlock.update({
            where: { id: insertedBlockA },
            data: { excludedById: actorB },
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.payrollBlock.update({
            where: { id: insertedBlockA },
            data: { employeeId: employeeB },
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.payrollBlock.update({
            where: { id: insertedBlockA },
            data: { payrollPeriodId: periodB },
          }),
        ),
      ),
    ).rejects.toThrow();

    const approvedUpdate = await withTenant(tenantA, () =>
      tenantPrisma.execute((tx) =>
        tx.payrollBlock.updateMany({
          where: { id: approvedBlockA },
          data: {
            message: 'Actualización tenant-scoped permitida por servicio',
          },
        }),
      ),
    );
    const deleteResult = await withTenant(tenantA, () =>
      tenantPrisma.execute((tx) =>
        tx.payrollBlock.deleteMany({ where: { id: insertedBlockA } }),
      ),
    );
    expect(approvedUpdate.count).toBe(1);
    expect(deleteResult.count).toBe(0);
  }, 30000);

  function withTenant<T>(tenantId: string, work: () => Promise<T>) {
    return tenantContext.run(
      {
        tenantId,
        userId: 'payroll-block-rls-test-user',
        rol: 'ADMIN',
        email: 'payroll-block-rls-test@example.test',
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
        '    REVOKE USAGE ON TYPE "PayrollBlockStatus" FROM "' +
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
      nombre: 'Tenant payroll block ' + id,
      nit,
      digitoVerif: '1',
      razonSocial: 'Tenant payroll block ' + id,
    };
  }

  function userData(id: string, tenantId: string, key: string) {
    return {
      id,
      tenantId,
      email: 'payroll-block-' + key + '-' + id + '@example.test',
      passwordHash: 'not-a-real-password-hash',
      nombre: 'Usuario',
      apellido: 'Prueba',
      rol: UserRole.ADMIN,
    };
  }

  function employeeData(id: string, tenantId: string, key: string) {
    return {
      id,
      tenantId,
      cedula: 'payroll-block-' + key + '-' + id,
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
      nombre: 'Período de bloqueo ' + id,
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: new Date('2026-01-31T00:00:00.000Z'),
      status,
    };
  }

  function legalParamData(tenantId: string) {
    return {
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

  function blockData(
    id: string,
    tenantId: string,
    payrollPeriodId: string,
    employeeId: string,
    excludedById?: string,
  ) {
    return {
      id,
      tenantId,
      payrollPeriodId,
      employeeId,
      code: 'MISSING_DATA',
      message: 'Falta información de prueba',
      status: PayrollBlockStatus.ACTIVE,
      ...(excludedById
        ? {
            status: PayrollBlockStatus.EXCLUDED,
            excludedAt: new Date('2026-01-20T00:00:00.000Z'),
            excludedById,
            exclusionReason: 'Revisado durante la prueba',
          }
        : {}),
    };
  }

  function nitFor(prefix: string) {
    const numericSuffix = (
      parseInt(suffix.replaceAll('-', '').slice(0, 12), 16) % 100_000_000
    )
      .toString()
      .padStart(8, '0');
    return prefix + numericSuffix;
  }
});
