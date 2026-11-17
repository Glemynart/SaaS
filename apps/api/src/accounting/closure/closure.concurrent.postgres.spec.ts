import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextBoundary } from '../../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../../tenant-prisma/tenant-prisma.service';
import { ClosureService } from './closure.service';
import { ReportingService } from '../reporting/reporting.service';

jest.setTimeout(30_000);

describe('ClosureService PostgreSQL concurrency', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const tenantId = randomUUID();
  const userId = randomUUID();
  const periodId = randomUUID();
  const context = {
    tenantId,
    userId,
    rol: 'ADMIN',
    email: `closure-concurrency-${suffix}@example.test`,
  } as const;
  const contextService = new TenantContextService();
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrismaService(
    prisma,
    new TenantContextBoundary(contextService),
  );
  let connected = false;
  const reporting = {
    obtenerBalancePrueba: jest.fn(() => Promise.resolve([])),
  };
  const audit = new AuditService(prisma, tenantPrisma, contextService);
  const service = new ClosureService(
    tenantPrisma,
    reporting as unknown as ReportingService,
    audit,
    {} as never,
  );

  beforeAll(async () => {
    assertDisposableDatabase();
    await prisma.$connect();
    connected = true;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      await tx.tenant.create({
        data: {
          id: tenantId,
          nombre: `Cierre concurrente ${suffix.slice(0, 8)}`,
          nit: `8${suffix.slice(0, 9)}`,
          digitoVerif: '1',
          razonSocial: `Cierre concurrente ${suffix.slice(0, 8)}`,
        },
      });
      await tx.user.create({
        data: {
          id: userId,
          tenantId,
          email: context.email,
          passwordHash: 'test-only-not-a-password',
          nombre: 'Usuario',
          apellido: 'Prueba',
          rol: 'ADMIN',
        },
      });
      await tx.periodoContable.create({
        data: {
          id: periodId,
          tenantId,
          anio: 2026,
          mes: 11,
          fechaInicio: new Date('2026-11-01T00:00:00.000Z'),
          fechaFin: new Date('2026-11-30T00:00:00.000Z'),
        },
      });
    });
  });

  afterAll(async () => {
    if (!connected) return;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        await tx.auditLog.deleteMany({ where: { tenantId } });
        await tx.periodoContable.deleteMany({ where: { tenantId } });
        await tx.user.deleteMany({ where: { tenantId } });
        await tx.tenant.deleteMany({ where: { id: tenantId } });
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('serializes concurrent closes and records one committed transition and audit', async () => {
    const results = await Promise.all([
      contextService.run(context, () =>
        service.cerrarPeriodo(tenantId, periodId, userId),
      ),
      contextService.run(context, () =>
        service.cerrarPeriodo(tenantId, periodId, userId),
      ),
    ]);

    expect(results).toEqual(
      expect.arrayContaining([
        { cerrado: true, yaEstabaCerrado: false },
        { cerrado: true, yaEstabaCerrado: true },
      ]),
    );
    // The second request waits for the period lock, then observes the closed
    // state and must not validate stale balances a second time.
    expect(reporting.obtenerBalancePrueba).toHaveBeenCalledTimes(1);

    const persisted = await contextService.run(context, () =>
      tenantPrisma.execute(async (tx) => {
        const [period, auditCount] = await Promise.all([
          tx.periodoContable.findUniqueOrThrow({
            where: { id: periodId },
            select: { estado: true, cerradoPorId: true },
          }),
          tx.auditLog.count({
            where: {
              tenantId,
              action: 'PERIODO_CONTABLE_CERRADO',
              entityId: periodId,
            },
          }),
        ]);
        return { period, auditCount };
      }),
    );

    expect(persisted).toEqual({
      period: { estado: 'CERRADO', cerradoPorId: userId },
      auditCount: 1,
    });
  });

  function assertDisposableDatabase() {
    const value = process.env.DATABASE_URL;
    if (!value) throw new Error('DATABASE_URL is required for this test.');
    const database = new URL(value);
    const databaseName = decodeURIComponent(database.pathname.slice(1));
    if (
      !['127.0.0.1', 'localhost'].includes(database.hostname) ||
      !/(test|ci)/i.test(databaseName)
    ) {
      throw new Error(
        'This PostgreSQL test requires a loopback test database.',
      );
    }
  }
});
