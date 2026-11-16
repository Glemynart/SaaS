import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextBoundary } from '../../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../../tenant-prisma/tenant-prisma.service';
import { LedgerService } from './ledger.service';

jest.setTimeout(30_000);

describe('LedgerService.anular PostgreSQL concurrency', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const tenantId = randomUUID();
  const userId = `ledger-pg-test-${suffix}`;
  const voucherTypeId = randomUUID();
  const debitAccountId = randomUUID();
  const creditAccountId = randomUUID();
  const openPeriodId = randomUUID();
  const failurePeriodId = randomUUID();
  const tenantContext = new TenantContextService();
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrismaService(
    prisma,
    new TenantContextBoundary(tenantContext),
  );
  const audit = new AuditService(prisma);
  const ledger = new LedgerService(tenantPrisma, audit);
  let connected = false;

  beforeAll(async () => {
    assertDisposableDatabase();
    await prisma.$connect();
    connected = true;

    await prisma.tenant.create({
      data: {
        id: tenantId,
        nombre: `Ledger concurrency ${suffix}`,
        nit: `98${suffix.slice(0, 9)}`,
        digitoVerif: '1',
        razonSocial: `Ledger concurrency ${suffix}`,
      },
    });
    await prisma.tipoComprobante.create({
      data: {
        id: voucherTypeId,
        codigo: `T${suffix}`,
        nombre: 'Tipo de comprobante de prueba de concurrencia',
      },
    });
    await prisma.cuentaContable.createMany({
      data: [
        accountData(debitAccountId, `1${suffix.slice(0, 10)}`),
        accountData(creditAccountId, `2${suffix.slice(0, 10)}`),
      ],
    });
    await createPeriod(openPeriodId, 2026, 1);
    await createPeriod(failurePeriodId, 2026, 2);

    const [{ isolation }] = await prisma.$transaction(
      (tx) =>
        tx.$queryRaw<Array<{ isolation: string }>>`
        SELECT current_setting('transaction_isolation') AS isolation
      `,
    );
    expect(isolation).toBe('read committed');
  });

  afterAll(async () => {
    if (!connected) return;
    try {
      await prisma.auditLog.deleteMany({ where: { tenantId } });
      await prisma.movimientoContable.deleteMany({ where: { tenantId } });
      await prisma.comprobanteContable.deleteMany({
        where: { tenantId, reversaAId: { not: null } },
      });
      await prisma.comprobanteContable.deleteMany({ where: { tenantId } });
      await prisma.secuenciaComprobante.deleteMany({ where: { tenantId } });
      await prisma.periodoContable.deleteMany({ where: { tenantId } });
      await prisma.cuentaContable.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
      await prisma.tipoComprobante.deleteMany({
        where: { id: voucherTypeId },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('serializa dos anulaciones de un período abierto y conserva el saldo', async () => {
    const original = await createVoucher(openPeriodId, 'Anulación concurrente');
    const beforeBalances = await activeBalances();
    expect(beforeBalances).toEqual([
      { accountId: debitAccountId, balance: '100' },
      { accountId: creditAccountId, balance: '-100' },
    ]);

    const [results, waiters] = await withHeldPeriodLock(openPeriodId, () =>
      Promise.all([
        runAsTenant(() =>
          ledger.anular(tenantId, userId, original.id, 'prueba concurrente'),
        ),
        runAsTenant(() =>
          ledger.anular(tenantId, userId, original.id, 'prueba concurrente'),
        ),
      ]),
    );

    expect(waiters).toBeGreaterThanOrEqual(2);
    expect(results.map(({ estado }) => estado)).toEqual(['ANULADO', 'ANULADO']);
    await expect(
      prisma.comprobanteContable.findUniqueOrThrow({
        where: { id: original.id },
        select: { estado: true },
      }),
    ).resolves.toEqual({ estado: 'ANULADO' });
    await expect(
      prisma.auditLog.count({
        where: {
          tenantId,
          entityId: original.id,
          action: 'COMPROBANTE_ANULADO',
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.movimientoContable.count({
        where: { tenantId, comprobanteId: original.id },
      }),
    ).resolves.toBe(2);
    await expect(activeBalances()).resolves.toEqual([
      { accountId: debitAccountId, balance: '0' },
      { accountId: creditAccountId, balance: '0' },
    ]);
  });

  it('revierte el cambio y el AuditLog si falla la transacción, y permite reintentar', async () => {
    const original = await createVoucher(
      failurePeriodId,
      'Anulación con rollback',
    );
    const originalBalances = await activeBalances();
    expect(originalBalances).toEqual([
      { accountId: debitAccountId, balance: '100' },
      { accountId: creditAccountId, balance: '-100' },
    ]);
    const failingAudit = {
      log: async (
        params: Parameters<AuditService['log']>[0],
        tx: Parameters<AuditService['log']>[1],
      ) => {
        await audit.log(params, tx);
        throw new Error('fallo de prueba después de insertar AuditLog');
      },
    } as unknown as AuditService;
    const failingLedger = new LedgerService(tenantPrisma, failingAudit);

    await expect(
      runAsTenant(() =>
        failingLedger.anular(tenantId, userId, original.id, 'primer intento'),
      ),
    ).rejects.toThrow('fallo de prueba después de insertar AuditLog');
    await expect(
      prisma.comprobanteContable.findUniqueOrThrow({
        where: { id: original.id },
        select: { estado: true },
      }),
    ).resolves.toEqual({ estado: 'CONTABILIZADO' });
    await expect(countVoidAudits(original.id)).resolves.toBe(0);
    await expect(
      prisma.movimientoContable.count({
        where: { tenantId, comprobanteId: original.id },
      }),
    ).resolves.toBe(2);
    await expect(activeBalances()).resolves.toEqual(originalBalances);

    await expect(
      runAsTenant(() =>
        ledger.anular(tenantId, userId, original.id, 'reintento'),
      ),
    ).resolves.toMatchObject({ estado: 'ANULADO' });
    await expect(
      runAsTenant(() =>
        ledger.anular(tenantId, userId, original.id, 'repetición'),
      ),
    ).resolves.toMatchObject({ estado: 'ANULADO' });
    await expect(countVoidAudits(original.id)).resolves.toBe(1);
    await expect(
      prisma.movimientoContable.count({
        where: { tenantId, comprobanteId: original.id },
      }),
    ).resolves.toBe(2);
    await expect(activeBalances()).resolves.toEqual([
      { accountId: debitAccountId, balance: '0' },
      { accountId: creditAccountId, balance: '0' },
    ]);
  });

  it('crea un solo reverso y dos movimientos de reversión al anular en período cerrado', async () => {
    const sourcePeriodId = randomUUID();
    const reversalPeriodId = randomUUID();
    await createPeriod(sourcePeriodId, 2026, 3);
    await createPeriod(reversalPeriodId, 2026, 4);
    const original = await createVoucher(sourcePeriodId, 'Reverso concurrente');
    await prisma.periodoContable.update({
      where: { id: sourcePeriodId },
      data: {
        estado: 'CERRADO',
        cerradoAt: new Date(),
        cerradoPorId: userId,
      },
    });

    const [results, waiters] = await withHeldPeriodLock(sourcePeriodId, () =>
      Promise.all([
        runAsTenant(() =>
          ledger.anular(tenantId, userId, original.id, 'prueba concurrente'),
        ),
        runAsTenant(() =>
          ledger.anular(tenantId, userId, original.id, 'prueba concurrente'),
        ),
      ]),
    );

    expect(waiters).toBeGreaterThanOrEqual(2);
    expect(results[0].id).toBe(results[1].id);
    expect(results[0].reversaAId).toBe(original.id);
    await expect(
      prisma.comprobanteContable.count({
        where: { tenantId, reversaAId: original.id, estado: 'CONTABILIZADO' },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.auditLog.count({
        where: {
          tenantId,
          entityId: results[0].id,
          action: 'COMPROBANTE_REVERSO',
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.movimientoContable.count({
        where: { tenantId, comprobante: { reversaAId: original.id } },
      }),
    ).resolves.toBe(2);
    await expect(activeBalances()).resolves.toEqual([
      { accountId: debitAccountId, balance: '0' },
      { accountId: creditAccountId, balance: '0' },
    ]);
  });

  async function createPeriod(id: string, anio: number, mes: number) {
    await prisma.periodoContable.create({
      data: {
        id,
        tenantId,
        anio,
        mes,
        fechaInicio: new Date(Date.UTC(anio, mes - 1, 1)),
        fechaFin: new Date(Date.UTC(anio, mes, 0)),
        updatedAt: new Date(),
      },
    });
  }

  async function createVoucher(periodoId: string, concepto: string) {
    const period = await prisma.periodoContable.findUniqueOrThrow({
      where: { id: periodoId },
      select: { fechaInicio: true },
    });
    return runAsTenant(() =>
      ledger.registrarComprobante({
        tenantId,
        userId,
        tipoComprobanteId: voucherTypeId,
        periodoId,
        fecha: period.fechaInicio,
        concepto,
        lineas: [
          { cuentaId: debitAccountId, debito: 100, credito: 0 },
          { cuentaId: creditAccountId, debito: 0, credito: 100 },
        ],
      }),
    );
  }

  async function countVoidAudits(entityId: string) {
    return prisma.auditLog.count({
      where: { tenantId, entityId, action: 'COMPROBANTE_ANULADO' },
    });
  }

  async function activeBalances() {
    const rows = await prisma.$queryRaw<
      Array<{ accountId: string; balance: { toString(): string } }>
    >`
      SELECT m."cuentaId" AS "accountId",
        SUM(m."debito" - m."credito") AS "balance"
      FROM "movimientos_contables" m
      JOIN "comprobantes_contables" c ON c."id" = m."comprobanteId"
      WHERE m."tenantId" = ${tenantId}
        AND c."estado" = 'CONTABILIZADO'
        AND m."cuentaId" IN (${debitAccountId}, ${creditAccountId})
      GROUP BY m."cuentaId"
      ORDER BY m."cuentaId"
    `;
    const balances = new Map(
      rows.map((row) => [row.accountId, row.balance.toString()]),
    );
    return [debitAccountId, creditAccountId].map((accountId) => ({
      accountId,
      balance: balances.get(accountId) ?? '0',
    }));
  }

  async function withHeldPeriodLock<T>(
    periodoId: string,
    work: () => Promise<T>,
  ): Promise<[T, number]> {
    let markHeld!: () => void;
    let release!: () => void;
    const held = new Promise<void>((resolve) => (markHeld = resolve));
    const released = new Promise<void>((resolve) => (release = resolve));
    const holder = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${periodoId}))
      `;
      markHeld();
      await released;
    });
    await held;

    let waiterCount = 0;
    let operation: Promise<T> | undefined;
    try {
      operation = work();
      waiterCount = await waitForAdvisoryWaiters(2);
      release();
      return [await operation, waiterCount];
    } finally {
      release();
      await holder;
      await operation?.catch(() => undefined);
    }
  }

  async function waitForAdvisoryWaiters(expected: number): Promise<number> {
    const deadline = Date.now() + 10_000;
    let latest = 0;
    while (Date.now() < deadline) {
      const rows = await prisma.$queryRaw<Array<{ waiting: bigint }>>`
        SELECT COUNT(*) AS waiting
        FROM pg_locks
        WHERE locktype = 'advisory' AND NOT granted
      `;
      latest = Number(rows[0]?.waiting ?? 0n);
      if (latest >= expected) return latest;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(
      `Timed out waiting for both PostgreSQL advisory-lock waiters (observed ${latest}).`,
    );
  }

  function runAsTenant<T>(work: () => Promise<T>): Promise<T> {
    return tenantContext.run(
      {
        tenantId,
        userId,
        rol: 'ADMIN',
        email: 'ledger-concurrency-test@example.invalid',
      },
      work,
    );
  }

  function accountData(id: string, codigo: string) {
    return {
      id,
      tenantId,
      codigo,
      nombre: `Cuenta de prueba ${codigo}`,
      claseContable: 'ACTIVO' as const,
      naturaleza: 'DEBITO' as const,
      nivel: 4,
      imputable: true,
      activa: true,
      updatedAt: new Date(),
    };
  }

  function assertDisposableDatabase() {
    const value = process.env.DATABASE_URL;
    if (!value) {
      throw new Error(
        'Ledger PostgreSQL tests require DATABASE_URL to be set.',
      );
    }

    const database = new URL(value);
    const databaseName = decodeURIComponent(database.pathname.slice(1));
    const localHost = ['127.0.0.1', 'localhost'].includes(database.hostname);
    if (!localHost || !/(test|ci)/i.test(databaseName)) {
      throw new Error(
        'Ledger PostgreSQL tests require a loopback PostgreSQL database with a test/CI database name.',
      );
    }
  }
});
