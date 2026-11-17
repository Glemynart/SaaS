import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  EmployeeDisbursementMethod,
  PayrollPeriodStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { EmployeeDisbursementService } from './disbursements/employee-disbursement.service';
import { EmployeeDisbursementReconciliationService } from './disbursements/employee-disbursement-reconciliation.service';
import { EmployeeDisbursementSourceType } from './disbursements/employee-disbursement.dto';
import { LiquidationService } from './liquidation/liquidation.service';

describe('Employee disbursements PostgreSQL: RLS, audit, concurrency and N2D.4', () => {
  const suffix = randomUUID();
  const role = `employee_disb_${suffix.replaceAll('-', '')}`;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  let nextSeedPeriodMonth = 0;
  let connected = false;
  const context = new TenantContextService();
  const prisma = new PrismaService();
  const files = new Map<string, Buffer>();
  const storage = {
    putObject: jest.fn(({ key, body }: { key: string; body: Buffer }) => {
      files.set(key, body);
      return Promise.resolve({ key, size: body.length });
    }),
    getObject: jest.fn((key: string) => {
      const body = files.get(key);
      if (!body) return Promise.reject(new Error('test support not found'));
      return Promise.resolve(body);
    }),
    deleteObject: jest.fn((key: string) => {
      files.delete(key);
      return Promise.resolve();
    }),
    objectExists: jest.fn((key: string) => Promise.resolve(files.has(key))),
    listObjects: jest.fn((prefix: string) =>
      Promise.resolve(
        [...files.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, body]) => ({ key, size: body.length }))
          .sort((left, right) => left.key.localeCompare(right.key)),
      ),
    ),
  };
  const roleAwarePrisma = {
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
  };
  const tenantPrisma = new TenantPrismaService(
    roleAwarePrisma as unknown as PrismaService,
    new TenantContextBoundary(context),
  );
  const audit = new AuditService(prisma, tenantPrisma, context);
  const disbursements = new EmployeeDisbursementService(
    tenantPrisma,
    audit,
    storage as unknown as StorageService,
  );
  const liquidations = new LiquidationService(
    prisma,
    tenantPrisma,
    audit,
    disbursements,
  );
  const disbursementReconciliation =
    new EmployeeDisbursementReconciliationService(
      tenantPrisma,
      storage as unknown as StorageService,
      audit,
    );

  beforeAll(async () => {
    assertDisposableDatabase();
    await prisma.$connect();
    connected = true;
    await prisma.$executeRawUnsafe(
      `CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOBYPASSRLS`,
    );
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await prisma.$executeRawUnsafe(
      `GRANT SELECT ON "tenants", "users", "empleados", "payroll_periods", "payroll_runs", "payroll_pila_events", "liquidations", "liquidation_concepts" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT UPDATE ON "empleados", "payroll_runs", "liquidations" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT INSERT ON "liquidations" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT ON "audit_logs" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT EXECUTE ON FUNCTION audit_private.append_audit_event(text, bytea, text) TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE ON "employee_disbursements" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT ON "employee_disbursement_reversals" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT INSERT ON "liquidation_concepts" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(`
      GRANT USAGE ON TYPE "EmployeeDisbursementStatus" TO "${role}"
    `);
    await prisma.$executeRawUnsafe(`
      GRANT USAGE ON TYPE "EmployeeDisbursementMethod" TO "${role}"
    `);
    await prisma.$executeRawUnsafe(
      `GRANT USAGE ON TYPE "PayrollPeriodStatus" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT USAGE ON TYPE "LiquidationStatus" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT USAGE ON TYPE "EmpleadoEstado" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT USAGE ON TYPE "UserRole" TO "${role}"`,
    );
    await prisma.tenant.createMany({
      data: [tenantData(tenantA), tenantData(tenantB)],
    });
    await prisma.user.createMany({
      data: [userData(userA, tenantA), userData(userB, tenantB)],
    });
  }, 30000);

  it('migration revokes destructive ACLs from the marked database runtime role', async () => {
    const runtimeRoles = await prisma.$queryRaw<
      Array<{
        roleName: string;
        superuser: boolean;
        bypassRls: boolean;
        disbursementDelete: boolean;
        disbursementTruncate: boolean;
        reversalUpdate: boolean;
        reversalDelete: boolean;
        reversalTruncate: boolean;
      }>
    >`
      SELECT
        roles.rolname AS "roleName",
        roles.rolsuper AS "superuser",
        roles.rolbypassrls AS "bypassRls",
        has_table_privilege(roles.oid, 'public.employee_disbursements', 'DELETE') AS "disbursementDelete",
        has_table_privilege(roles.oid, 'public.employee_disbursements', 'TRUNCATE') AS "disbursementTruncate",
        has_table_privilege(roles.oid, 'public.employee_disbursement_reversals', 'UPDATE') AS "reversalUpdate",
        has_table_privilege(roles.oid, 'public.employee_disbursement_reversals', 'DELETE') AS "reversalDelete",
        has_table_privilege(roles.oid, 'public.employee_disbursement_reversals', 'TRUNCATE') AS "reversalTruncate"
      FROM pg_roles AS roles
      WHERE pg_catalog.shobj_description(roles.oid, 'pg_authid') =
        'dusema:goal01-staging-runtime'
    `;

    expect(runtimeRoles.length).toBeGreaterThan(0);
    for (const role of runtimeRoles) {
      expect(role.superuser).toBe(false);
      expect(role.bypassRls).toBe(false);
      expect(role.disbursementDelete).toBe(false);
      expect(role.disbursementTruncate).toBe(false);
      expect(role.reversalUpdate).toBe(false);
      expect(role.reversalDelete).toBe(false);
      expect(role.reversalTruncate).toBe(false);
    }
  });

  it('migration privilege guard aborts when no runtime role is recognized', async () => {
    const runtimeRoles = await prisma.$queryRaw<Array<{ roleName: string }>>`
      SELECT roles.rolname AS "roleName"
      FROM pg_roles AS roles
      WHERE pg_catalog.shobj_description(roles.oid, 'pg_authid') =
        'dusema:goal01-staging-runtime'
    `;
    expect(runtimeRoles.length).toBeGreaterThan(0);

    const migrationSql = readFileSync(
      resolve(
        __dirname,
        '../../prisma/migrations/20261117130000_employee_disbursements_verified/migration.sql',
      ),
      'utf8',
    );
    const guardComment =
      '-- The staging bootstrap grants CRUD on newly-created public tables.';
    const guardStart = migrationSql.indexOf(
      'DO $$',
      migrationSql.indexOf(guardComment),
    );
    const guardEndMarker = '\n$$;';
    const guardEnd = migrationSql.indexOf(guardEndMarker, guardStart);
    expect(guardStart).toBeGreaterThanOrEqual(0);
    expect(guardEnd).toBeGreaterThan(guardStart);
    const guardSql = migrationSql.slice(
      guardStart,
      guardEnd + guardEndMarker.length,
    );

    const quoteIdentifier = (value: string) =>
      `"${value.replaceAll('"', '""')}"`;
    try {
      for (const role of runtimeRoles) {
        await prisma.$executeRawUnsafe(
          `COMMENT ON ROLE ${quoteIdentifier(role.roleName)} IS 'test-unrecognized-runtime'`,
        );
      }

      await expect(prisma.$executeRawUnsafe(guardSql)).rejects.toThrow(
        /No recognized API runtime role found/,
      );
    } finally {
      for (const role of runtimeRoles) {
        await prisma.$executeRawUnsafe(
          `COMMENT ON ROLE ${quoteIdentifier(role.roleName)} IS 'dusema:goal01-staging-runtime'`,
        );
      }
    }
  });

  afterAll(async () => {
    if (!connected) return;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          'ALTER TABLE "employee_disbursement_reversals" DISABLE TRIGGER USER',
        );
        await tx.$executeRawUnsafe(
          'ALTER TABLE "employee_disbursements" DISABLE TRIGGER USER',
        );
        await tx.auditLog.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await tx.employeeDisbursementReversal.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await tx.employeeDisbursement.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await tx.liquidation.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await tx.payrollRun.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await tx.payrollPeriod.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await tx.empleado.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await tx.user.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await tx.tenant.deleteMany({
          where: { id: { in: [tenantA, tenantB] } },
        });
        await tx.$executeRawUnsafe(
          'ALTER TABLE "employee_disbursements" ENABLE TRIGGER USER',
        );
        await tx.$executeRawUnsafe(
          'ALTER TABLE "employee_disbursement_reversals" ENABLE TRIGGER USER',
        );
      });
    } finally {
      try {
        await prisma.$executeRawUnsafe(`DROP OWNED BY "${role}"`);
        await prisma.$executeRawUnsafe(`DROP ROLE "${role}"`);
      } finally {
        await prisma.$disconnect();
      }
    }
  }, 30000);

  it('falla cerrada sin contexto y oculta una obligación de otro tenant', async () => {
    const run = await seedRun(tenantA, false);
    const withoutTenant = await runAsRlsRole((tx) =>
      tx.employeeDisbursement.findMany(),
    );
    expect(withoutTenant).toHaveLength(0);

    await expect(
      withTenant(tenantB, userB, () =>
        disbursements.getSummary(
          tenantB,
          EmployeeDisbursementSourceType.PAYROLL_RUN,
          run.runId,
        ),
      ),
    ).rejects.toThrow();
  });

  it('no confía en un GUC mutable para leer ni insertar desembolsos', async () => {
    const run = await seedRun(tenantA, false);
    await withTenant(tenantA, userA, () =>
      createPayment(run.runId, '25000', 'mutable-guc-regression-001'),
    );

    const forgedRead = await runAsRlsRole(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantA}, true)`;
      return tx.employeeDisbursement.findMany({ where: { tenantId: tenantA } });
    });
    expect(forgedRead).toHaveLength(0);

    await expect(
      runAsRlsRole(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantA}, true)`;
        return tx.$executeRaw`
          INSERT INTO "employee_disbursements" (
            "id", "createdAt", "updatedAt", "tenantId", "employeeId",
            "payrollRunId", "amount", "paidAt", "method", "idempotencyKey",
            "status", "registeredByUserId"
          ) VALUES (
            ${randomUUID()}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
            ${tenantA}, ${run.employeeId}, ${run.runId}, 1,
            DATE '2026-01-15', 'BANK_TRANSFER'::"EmployeeDisbursementMethod",
            ${`forged-guc-${randomUUID()}`},
            'DECLARED'::"EmployeeDisbursementStatus", ${userA}
          )
        `;
      }),
    ).rejects.toThrow();
  });

  it('lista obligaciones y soportes dentro del tenant y reconcilia sin reparar objetos', async () => {
    storage.deleteObject.mockClear();
    const run = await seedRun(tenantA, false);
    const payment = await withTenant(tenantA, userA, () =>
      createPayment(run.runId, '40000', 'reconcile-support-001'),
    );
    await withTenant(tenantA, userA, () => attachSupport(payment.id));
    const keysBefore = [...files.entries()].map(([key, body]) => [
      key,
      Buffer.from(body),
    ]);

    const obligationsA = await withTenant(tenantA, userA, () =>
      disbursements.listObligations(tenantA, {
        sourceType: EmployeeDisbursementSourceType.PAYROLL_RUN,
        page: 1,
        limit: 25,
      }),
    );
    const obligationsB = await withTenant(tenantB, userB, () =>
      disbursements.listObligations(tenantB, {
        sourceType: EmployeeDisbursementSourceType.PAYROLL_RUN,
        page: 1,
        limit: 25,
      }),
    );
    const pendingA = await withTenant(tenantA, userA, () =>
      disbursements.listPendingVerification(tenantA, { page: 1, limit: 25 }),
    );
    const pendingB = await withTenant(tenantB, userB, () =>
      disbursements.listPendingVerification(tenantB, { page: 1, limit: 25 }),
    );

    expect(obligationsA.data.map((item) => item.sourceId)).toContain(run.runId);
    expect(obligationsB.data).toHaveLength(0);
    expect(pendingA.data.map((item) => item.id)).toContain(payment.id);
    expect(pendingB.data).toHaveLength(0);

    const reportA = await withTenant(tenantA, userA, () =>
      disbursementReconciliation.reconcile(tenantA, userA),
    );
    const reportB = await withTenant(tenantB, userB, () =>
      disbursementReconciliation.reconcile(tenantB, userB),
    );

    expect(reportA.scannedDisbursements).toBeGreaterThanOrEqual(1);
    expect(reportA.scannedObjects).toBeGreaterThanOrEqual(1);
    expect(reportA.findings).not.toContainEqual(
      expect.objectContaining({
        code: 'SUPPORT_OBJECT_MISSING',
        disbursementId: payment.id,
      }),
    );
    expect(reportB.scannedDisbursements).toBe(0);
    expect(reportB.scannedObjects).toBe(0);
    expect([...files.entries()]).toEqual(keysBefore);
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(storage.listObjects).toHaveBeenCalledWith(
      `tenants/${tenantA}/employee-disbursements/`,
    );
    await expect(
      prisma.auditLog.count({
        where: {
          tenantId: tenantA,
          action: 'employee.disbursement.support.reconciled',
          entityId: reportA.fingerprint,
        },
      }),
    ).resolves.toBe(1);
  });

  it('serializa declaraciones concurrentes y no reserva más que la obligación', async () => {
    const run = await seedRun(tenantA, false);
    const results = await Promise.allSettled([
      withTenant(tenantA, userA, () =>
        createPayment(run.runId, '60000', 'declared-a-001'),
      ),
      withTenant(tenantA, userA, () =>
        createPayment(run.runId, '60000', 'declared-b-001'),
      ),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    const summary = await withTenant(tenantA, userA, () =>
      disbursements.getSummary(
        tenantA,
        EmployeeDisbursementSourceType.PAYROLL_RUN,
        run.runId,
      ),
    );
    expect(summary.reservedAmount).toBe('60000.00');
    expect(summary.netVerifiedAmount).toBe('0.00');
  });

  it('revierte el alta completa si falla el AuditLog dentro de la transacción', async () => {
    const run = await seedRun(tenantA, false);
    const failingAudit = {
      log: jest.fn().mockRejectedValue(new Error('audit insert failed')),
    };
    const service = new EmployeeDisbursementService(
      tenantPrisma,
      failingAudit as unknown as AuditService,
      storage as unknown as StorageService,
    );

    await expect(
      withTenant(tenantA, userA, () =>
        service.create(tenantA, userA, {
          sourceType: EmployeeDisbursementSourceType.PAYROLL_RUN,
          sourceId: run.runId,
          amount: '20000',
          paidAt: '2026-01-15',
          method: EmployeeDisbursementMethod.BANK_TRANSFER,
          idempotencyKey: 'audit-failure-0001',
        }),
      ),
    ).rejects.toThrow('audit insert failed');
    expect(
      await prisma.employeeDisbursement.count({
        where: { tenantId: tenantA, payrollRunId: run.runId },
      }),
    ).toBe(0);
  });

  it('dos verificaciones concurrentes generan una sola transición y un solo evento', async () => {
    const run = await seedRun(tenantA, false);
    const payment = await withTenant(tenantA, userA, () =>
      createPayment(run.runId, '40000', 'verify-race-0001'),
    );
    await withTenant(tenantA, userA, () => attachSupport(payment.id));

    const results = await Promise.all([
      withTenant(tenantA, userA, () =>
        disbursements.verify(tenantA, userA, payment.id),
      ),
      withTenant(tenantA, userA, () =>
        disbursements.verify(tenantA, userA, payment.id),
      ),
    ]);

    expect(results.map((result) => result.status)).toEqual([
      'VERIFIED',
      'VERIFIED',
    ]);
    expect(
      await prisma.auditLog.count({
        where: {
          tenantId: tenantA,
          entityId: payment.id,
          action: 'EMPLOYEE_DISBURSEMENT_VERIFIED',
        },
      }),
    ).toBe(1);
  });

  it('la base rechaza incluso una verificación directa con fecha futura', async () => {
    const run = await seedRun(tenantA, false);
    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const payment = await withTenant(tenantA, userA, () =>
      disbursements.create(tenantA, userA, {
        sourceType: EmployeeDisbursementSourceType.PAYROLL_RUN,
        sourceId: run.runId,
        amount: '20000',
        paidAt: futureDate,
        method: EmployeeDisbursementMethod.BANK_TRANSFER,
        idempotencyKey: 'future-payment-date-001',
      }),
    );
    await withTenant(tenantA, userA, () => attachSupport(payment.id));

    await expect(
      prisma.employeeDisbursement.update({
        where: { id: payment.id },
        data: {
          status: 'VERIFIED',
          verifiedByUserId: userA,
          verifiedAt: new Date(),
        },
      }),
    ).rejects.toThrow(/future disbursement cannot be verified/i);

    await expect(
      prisma.employeeDisbursement.findUniqueOrThrow({
        where: { id: payment.id },
      }),
    ).resolves.toMatchObject({ status: 'SUPPORTED' });
  });

  it('acumula pagos parciales solo verificados y bloquea la liquidación si queda saldo', async () => {
    const source = await seedRun(tenantA, true);
    const first = await withTenant(tenantA, userA, () =>
      createPayment(source.runId, '40000', 'partial-first-001'),
    );
    const second = await withTenant(tenantA, userA, () =>
      createPayment(source.runId, '60000', 'partial-second-001'),
    );
    await withTenant(tenantA, userA, () => attachSupport(first.id));
    await withTenant(tenantA, userA, () => attachSupport(second.id));
    await withTenant(tenantA, userA, () =>
      disbursements.verify(tenantA, userA, first.id),
    );

    await expect(
      withTenant(tenantA, userA, () =>
        liquidations.createLiquidacion(tenantA, userA, source.employeeId),
      ),
    ).rejects.toThrow(/parciales/i);

    await withTenant(tenantA, userA, () =>
      disbursements.verify(tenantA, userA, second.id),
    );
    const liquidation = await withTenant(tenantA, userA, () =>
      liquidations.createLiquidacion(tenantA, userA, source.employeeId),
    );
    expect(
      liquidation.concepts.some(
        (concept) => concept.codigo === 'LIQ_SALARIO_PENDIENTE',
      ),
    ).toBe(false);

    await expect(
      withTenant(tenantA, userA, () =>
        disbursements.reverse(tenantA, userA, second.id, {
          amount: '60000',
          reason: 'Reverso después de liquidación',
          idempotencyKey: 'reverse-after-liquidation-001',
        }),
      ),
    ).rejects.toThrow(/anúlela primero/i);

    await withTenant(tenantA, userA, () =>
      liquidations.voidLiquidation(tenantA, userA, liquidation.id),
    );
    await withTenant(tenantA, userA, () =>
      disbursements.reverse(tenantA, userA, second.id, {
        amount: '60000',
        reason: 'Reverso después de anular la liquidación',
        idempotencyKey: 'reverse-after-liquidation-002',
      }),
    );
    await expect(
      withTenant(tenantA, userA, () =>
        liquidations.createLiquidacion(tenantA, userA, source.employeeId),
      ),
    ).rejects.toThrow(/parciales/i);
  });

  it('nómina aprobada/causada sin pago verificado conserva días pendientes y evita doble pago posterior', async () => {
    const source = await seedRun(tenantA, true);
    const payment = await withTenant(tenantA, userA, () =>
      createPayment(source.runId, '100000', 'unpaid-declared-001'),
    );
    await withTenant(tenantA, userA, () => attachSupport(payment.id));
    const liquidation = await withTenant(tenantA, userA, () =>
      liquidations.createLiquidacion(tenantA, userA, source.employeeId),
    );

    expect(
      liquidation.concepts.some(
        (concept) => concept.codigo === 'LIQ_SALARIO_PENDIENTE',
      ),
    ).toBe(true);
    await expect(
      withTenant(tenantA, userA, () =>
        disbursements.verify(tenantA, userA, payment.id),
      ),
    ).rejects.toThrow(/liquidación ya incorporó/i);
  });

  it('recalcula cobertura después del reverso y deja el reverso append-only', async () => {
    const run = await seedRun(tenantA, false);
    const payment = await withTenant(tenantA, userA, () =>
      createPayment(run.runId, '40000', 'reverse-test-0001'),
    );
    await withTenant(tenantA, userA, () => attachSupport(payment.id));
    await withTenant(tenantA, userA, () =>
      disbursements.verify(tenantA, userA, payment.id),
    );
    await withTenant(tenantA, userA, () =>
      disbursements.reverse(tenantA, userA, payment.id, {
        amount: '40000',
        reason: 'Reverso total confirmado',
        idempotencyKey: 'reverse-full-0001',
      }),
    );

    const summary = await withTenant(tenantA, userA, () =>
      disbursements.getSummary(
        tenantA,
        EmployeeDisbursementSourceType.PAYROLL_RUN,
        run.runId,
      ),
    );
    expect(summary.verifiedAmount).toBe('40000.00');
    expect(summary.reversedAmount).toBe('40000.00');
    expect(summary.netVerifiedAmount).toBe('0.00');
    expect(summary.outstandingAmount).toBe('100000.00');
    expect(
      await prisma.employeeDisbursementReversal.count({
        where: { tenantId: tenantA, disbursementId: payment.id },
      }),
    ).toBe(1);
  });

  it('no permite anular una liquidación con pago verificado hasta registrar su reverso', async () => {
    const source = await seedRun(tenantA, true);
    const liquidation = await withTenant(tenantA, userA, () =>
      liquidations.createLiquidacion(tenantA, userA, source.employeeId),
    );
    await withTenant(tenantA, userA, () =>
      liquidations.approveLiquidation(tenantA, userA, liquidation.id),
    );

    const amount = liquidation.totalLiquidacion.toString();
    const payment = await withTenant(tenantA, userA, () =>
      disbursements.create(tenantA, userA, {
        sourceType: EmployeeDisbursementSourceType.LIQUIDATION,
        sourceId: liquidation.id,
        amount,
        paidAt: '2026-01-31',
        method: EmployeeDisbursementMethod.BANK_TRANSFER,
        idempotencyKey: 'liquidation-void-verified-001',
      }),
    );
    await withTenant(tenantA, userA, () => attachSupport(payment.id));
    await withTenant(tenantA, userA, () =>
      disbursements.verify(tenantA, userA, payment.id),
    );

    await expect(
      withTenant(tenantA, userA, () =>
        liquidations.voidLiquidation(tenantA, userA, liquidation.id),
      ),
    ).rejects.toThrow(/revierta primero los desembolsos/i);

    await withTenant(tenantA, userA, () =>
      disbursements.reverse(tenantA, userA, payment.id, {
        amount,
        reason: 'Pago asociado a liquidación que será anulada',
        idempotencyKey: 'liquidation-void-reversal-001',
      }),
    );
    const voided = await withTenant(tenantA, userA, () =>
      liquidations.voidLiquidation(tenantA, userA, liquidation.id),
    );
    expect(voided.status).toBe('VOIDED');
  });

  it('serializa reversos concurrentes y el trigger impide exceder el desembolso original', async () => {
    const run = await seedRun(tenantA, false);
    const payment = await withTenant(tenantA, userA, () =>
      createPayment(run.runId, '40000', 'reverse-race-0001'),
    );
    await withTenant(tenantA, userA, () => attachSupport(payment.id));
    await withTenant(tenantA, userA, () =>
      disbursements.verify(tenantA, userA, payment.id),
    );

    const results = await Promise.allSettled([
      withTenant(tenantA, userA, () =>
        disbursements.reverse(tenantA, userA, payment.id, {
          amount: '30000',
          reason: 'Reverso A',
          idempotencyKey: 'reverse-race-a01',
        }),
      ),
      withTenant(tenantA, userA, () =>
        disbursements.reverse(tenantA, userA, payment.id, {
          amount: '30000',
          reason: 'Reverso B',
          idempotencyKey: 'reverse-race-b01',
        }),
      ),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await prisma.employeeDisbursementReversal.aggregate({
        where: { tenantId: tenantA, disbursementId: payment.id },
        _sum: { amount: true },
      }),
    ).toMatchObject({ _sum: { amount: new Prisma.Decimal(30_000) } });
  });

  function withTenant<T>(
    tenantId: string,
    userId: string,
    work: () => Promise<T>,
  ) {
    return context.run(
      { tenantId, userId, rol: 'ADMIN', email: `${userId}@example.test` },
      work,
    );
  }

  function assertDisposableDatabase() {
    const value = process.env.DATABASE_URL;
    if (!value) {
      throw new Error('DATABASE_URL is required for PostgreSQL tests.');
    }

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error('PostgreSQL tests require a valid DATABASE_URL.');
    }

    const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (
      !loopbackHosts.has(parsed.hostname) ||
      !/(test|ci|disposable)/i.test(databaseName)
    ) {
      throw new Error(
        'Employee disbursement PostgreSQL tests require a loopback database whose name identifies it as test, CI, or disposable.',
      );
    }
  }

  function runAsRlsRole<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
      return work(tx);
    });
  }

  async function seedRun(tenantId: string, retired: boolean) {
    const employeeId = randomUUID();
    const periodId = randomUUID();
    const runId = randomUUID();
    const monthIndex = nextSeedPeriodMonth++;
    const from = new Date(Date.UTC(2026, monthIndex, 1));
    const through = new Date(Date.UTC(2026, monthIndex + 1, 0));
    await prisma.empleado.create({
      data: {
        id: employeeId,
        tenantId,
        cedula: `pay-${suffix}-${employeeId}`,
        primerNombre: 'Empleado',
        primerApellido: 'Prueba',
        cargo: 'Operario',
        salario: 100_000,
        fechaIngreso: new Date('2025-01-01T00:00:00.000Z'),
        estado: retired ? 'RETIRADO' : 'ACTIVO',
        fechaRetiro: retired ? through : null,
      },
    });
    await prisma.payrollPeriod.create({
      data: {
        id: periodId,
        tenantId,
        nombre: `Periodo ${periodId}`,
        fechaInicio: from,
        fechaFin: through,
        status: PayrollPeriodStatus.CAUSADA,
      },
    });
    await prisma.payrollRun.create({
      data: {
        id: runId,
        tenantId,
        payrollPeriodId: periodId,
        employeeId,
        totalDevengos: 100_000,
        totalDeducciones: 0,
        netoPagar: 100_000,
        salarioBaseSnapshot: 100_000,
      },
    });
    return { employeeId, periodId, runId };
  }

  function createPayment(
    runId: string,
    amount: string,
    idempotencyKey: string,
  ) {
    return disbursements.create(tenantA, userA, {
      sourceType: EmployeeDisbursementSourceType.PAYROLL_RUN,
      sourceId: runId,
      amount,
      paidAt: '2026-01-15',
      method: EmployeeDisbursementMethod.BANK_TRANSFER,
      idempotencyKey,
    });
  }

  function attachSupport(paymentId: string) {
    return disbursements.attachSupport(tenantA, userA, paymentId, {
      originalname: 'receipt.pdf',
      buffer: Buffer.from('%PDF-1.7 integration support'),
    } as Express.Multer.File);
  }

  function tenantData(id: string) {
    const digits = String(Date.now()).slice(-8);
    const prefix = id === tenantA ? '91' : '92';
    return {
      id,
      nombre: `Employee disbursement ${id}`,
      nit: `${prefix}${digits}`,
      digitoVerif: '1',
      razonSocial: `Employee disbursement ${id}`,
    };
  }

  function userData(id: string, tenantId: string) {
    return {
      id,
      tenantId,
      email: `${id}@example.test`,
      passwordHash: 'test-only-not-a-secret',
      nombre: 'Admin',
      apellido: 'Prueba',
      rol: 'ADMIN' as const,
    };
  }
});
