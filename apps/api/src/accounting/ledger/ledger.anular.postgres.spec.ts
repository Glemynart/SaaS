import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextBoundary } from '../../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../../tenant-prisma/tenant-prisma.service';
import { ClosureService } from '../closure/closure.service';
import { ReportingService } from '../reporting/reporting.service';
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
  const closureWinsAnnulPeriodId = randomUUID();
  const annulWinsClosurePeriodId = randomUUID();
  const concurrentPostPeriodId = randomUUID();
  const tenantContext = new TenantContextService();
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrismaService(
    prisma,
    new TenantContextBoundary(tenantContext),
  );
  const audit = new AuditService(prisma, tenantPrisma, tenantContext);
  const ledger = new LedgerService(tenantPrisma, audit);
  const reporting = new ReportingService(tenantPrisma);
  const closure = new ClosureService(tenantPrisma, reporting, audit, ledger);
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
    await prisma.user.create({
      data: {
        id: userId,
        tenantId,
        email: `ledger-concurrency-${suffix}@example.invalid`,
        passwordHash: 'test-only-not-a-password',
        nombre: 'Ledger',
        apellido: 'Concurrency Test',
        rol: 'ADMIN',
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
      await prisma.user.deleteMany({ where: { id: userId } });
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
    const reversalPeriodId = closureWinsAnnulPeriodId;
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

  it('espera la contabilización concurrente antes de validar y cerrar el período', async () => {
    const input = await voucherInput(
      openPeriodId,
      'Posteo confirmado antes del cierre',
    );
    const originalReport = reporting.obtenerBalancePrueba.bind(reporting);
    let reportIncludedCommittedPosting = false;
    const reportSpy = jest
      .spyOn(reporting, 'obtenerBalancePrueba')
      .mockImplementation(async (candidateTenantId, range) => {
        const balance = await originalReport(candidateTenantId, range);
        reportIncludedCommittedPosting = balance.some(
          (item) =>
            item.cuentaId === debitAccountId && Number(item.totalDebito) >= 100,
        );
        return balance;
      });
    const heldPosting = holdTenantOperation(() =>
      ledger.registrarComprobante(input),
    );
    const posted = await heldPosting.ready;
    const closeRequest = runAsTenant(() =>
      closure.cerrarPeriodo(tenantId, openPeriodId, userId),
    );

    let waiters = 0;
    try {
      waiters = await waitForAdvisoryWaiters(1);
    } finally {
      heldPosting.release();
    }
    await heldPosting.operation;
    const closeResult = await closeRequest;
    reportSpy.mockRestore();

    expect(waiters).toBeGreaterThanOrEqual(1);
    expect(closeResult).toEqual({ cerrado: true, yaEstabaCerrado: false });
    expect(reportIncludedCommittedPosting).toBe(true);
    await expect(
      prisma.periodoContable.findUniqueOrThrow({
        where: { id: openPeriodId },
        select: { estado: true },
      }),
    ).resolves.toEqual({ estado: 'CERRADO' });
    await expect(
      prisma.comprobanteContable.findUniqueOrThrow({
        where: { id: posted.id },
        select: { estado: true },
      }),
    ).resolves.toEqual({ estado: 'CONTABILIZADO' });
    await expect(
      prisma.auditLog.count({
        where: {
          tenantId,
          action: 'PERIODO_CONTABLE_CERRADO',
          entityId: openPeriodId,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.auditLog.count({
        where: {
          tenantId,
          action: 'COMPROBANTE_CONTABILIZADO',
          entityId: posted.id,
        },
      }),
    ).resolves.toBe(1);
  });

  it('si el cierre obtiene primero el lock, no contabiliza en el período cerrado', async () => {
    const input = await voucherInput(
      failurePeriodId,
      'Posteo rechazado tras cierre',
    );
    const postingAuditsBefore = await prisma.auditLog.count({
      where: { tenantId, action: 'COMPROBANTE_CONTABILIZADO' },
    });
    const heldClose = holdTenantOperation(() =>
      closure.cerrarPeriodo(tenantId, failurePeriodId, userId),
    );
    const closeResultInsideTransaction = await heldClose.ready;
    const postRequest = runAsTenant(() => ledger.registrarComprobante(input));

    let waiters = 0;
    try {
      waiters = await waitForAdvisoryWaiters(1);
    } finally {
      heldClose.release();
    }
    await heldClose.operation;

    expect(waiters).toBeGreaterThanOrEqual(1);
    expect(closeResultInsideTransaction).toEqual({
      cerrado: true,
      yaEstabaCerrado: false,
    });
    await expect(postRequest).rejects.toThrow('El período está CERRADO');
    await expect(
      prisma.comprobanteContable.count({
        where: {
          tenantId,
          periodoId: failurePeriodId,
          concepto: input.concepto,
        },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.movimientoContable.count({
        where: {
          tenantId,
          comprobante: { periodoId: failurePeriodId, concepto: input.concepto },
        },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.auditLog.count({
        where: { tenantId, action: 'COMPROBANTE_CONTABILIZADO' },
      }),
    ).resolves.toBe(postingAuditsBefore);
    await expect(
      prisma.auditLog.count({
        where: {
          tenantId,
          action: 'PERIODO_CONTABLE_CERRADO',
          entityId: failurePeriodId,
        },
      }),
    ).resolves.toBe(1);
  });

  it('si el cierre precede a la anulación, registra un reverso en el período abierto siguiente', async () => {
    const sourcePeriodId = closureWinsAnnulPeriodId;
    await createPeriod(annulWinsClosurePeriodId, 2026, 5);
    const balancesBeforeVoucher = await activeBalances();
    const original = await createVoucher(
      sourcePeriodId,
      'Anulación concurrente después del cierre',
    );
    const heldClose = holdTenantOperation(() =>
      closure.cerrarPeriodo(tenantId, sourcePeriodId, userId),
    );
    const closeResultInsideTransaction = await heldClose.ready;
    const voidRequest = runAsTenant(() =>
      ledger.anular(tenantId, userId, original.id, 'cierre ganó el lock'),
    );

    let waiters = 0;
    try {
      waiters = await waitForAdvisoryWaiters(1);
    } finally {
      heldClose.release();
    }
    await heldClose.operation;
    const reversal = await voidRequest;

    expect(waiters).toBeGreaterThanOrEqual(1);
    expect(closeResultInsideTransaction).toEqual({
      cerrado: true,
      yaEstabaCerrado: false,
    });
    expect(reversal.reversaAId).toBe(original.id);
    expect(reversal.periodoId).toBe(annulWinsClosurePeriodId);
    await expect(
      prisma.comprobanteContable.findUniqueOrThrow({
        where: { id: original.id },
        select: { estado: true },
      }),
    ).resolves.toEqual({ estado: 'CONTABILIZADO' });
    await expect(
      prisma.comprobanteContable.count({
        where: { tenantId, reversaAId: original.id, estado: 'CONTABILIZADO' },
      }),
    ).resolves.toBe(1);
    await expect(activeBalances()).resolves.toEqual(balancesBeforeVoucher);
    await expect(
      prisma.auditLog.count({
        where: {
          tenantId,
          action: 'COMPROBANTE_REVERSO',
          entityId: reversal.id,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.auditLog.count({
        where: {
          tenantId,
          action: 'PERIODO_CONTABLE_CERRADO',
          entityId: sourcePeriodId,
        },
      }),
    ).resolves.toBe(1);
  });

  it('si la anulación obtiene primero el lock, cierra después sin duplicar reversos', async () => {
    const balancesBeforeVoucher = await activeBalances();
    const original = await createVoucher(
      annulWinsClosurePeriodId,
      'Anulación confirmada antes del cierre',
    );
    const heldVoid = holdTenantOperation(() =>
      ledger.anular(tenantId, userId, original.id, 'anulación ganó el lock'),
    );
    const voidResultInsideTransaction = await heldVoid.ready;
    const closeRequest = runAsTenant(() =>
      closure.cerrarPeriodo(tenantId, annulWinsClosurePeriodId, userId),
    );

    let waiters = 0;
    try {
      waiters = await waitForAdvisoryWaiters(1);
    } finally {
      heldVoid.release();
    }
    await heldVoid.operation;
    const closeResult = await closeRequest;

    expect(waiters).toBeGreaterThanOrEqual(1);
    expect(voidResultInsideTransaction.estado).toBe('ANULADO');
    expect(closeResult).toEqual({ cerrado: true, yaEstabaCerrado: false });
    await expect(
      prisma.comprobanteContable.count({
        where: { tenantId, reversaAId: original.id },
      }),
    ).resolves.toBe(0);
    await expect(countVoidAudits(original.id)).resolves.toBe(1);
    await expect(activeBalances()).resolves.toEqual(balancesBeforeVoucher);
    await expect(
      prisma.periodoContable.findUniqueOrThrow({
        where: { id: annulWinsClosurePeriodId },
        select: { estado: true },
      }),
    ).resolves.toEqual({ estado: 'CERRADO' });
  });

  it('serializa dos contabilizaciones del mismo período sin duplicar movimientos ni consecutivos', async () => {
    await createPeriod(concurrentPostPeriodId, 2026, 6);
    const balancesBefore = await activeBalances();
    const [firstInput, secondInput] = await Promise.all([
      voucherInput(concurrentPostPeriodId, 'Posteo concurrente A'),
      voucherInput(concurrentPostPeriodId, 'Posteo concurrente B'),
    ]);

    const [results, waiters] = await withHeldPeriodLock(
      concurrentPostPeriodId,
      () =>
        Promise.all([
          runAsTenant(() => ledger.registrarComprobante(firstInput)),
          runAsTenant(() => ledger.registrarComprobante(secondInput)),
        ]),
    );

    expect(waiters).toBeGreaterThanOrEqual(2);
    expect(results).toHaveLength(2);
    expect(new Set(results.map(({ id }) => id)).size).toBe(2);
    expect(new Set(results.map(({ numero }) => numero)).size).toBe(2);
    await expect(
      prisma.comprobanteContable.count({
        where: {
          tenantId,
          id: { in: results.map(({ id }) => id) },
          estado: 'CONTABILIZADO',
        },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.movimientoContable.count({
        where: { tenantId, comprobanteId: { in: results.map(({ id }) => id) } },
      }),
    ).resolves.toBe(4);
    await expect(
      prisma.auditLog.count({
        where: {
          tenantId,
          action: 'COMPROBANTE_CONTABILIZADO',
          entityId: { in: results.map(({ id }) => id) },
        },
      }),
    ).resolves.toBe(2);
    const balancesAfter = await activeBalances();
    expect(balancesAfter).toEqual([
      {
        accountId: debitAccountId,
        balance: String(Number(balancesBefore[0].balance) + 200),
      },
      {
        accountId: creditAccountId,
        balance: String(Number(balancesBefore[1].balance) - 200),
      },
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
    const input = await voucherInput(periodoId, concepto);
    return runAsTenant(() => ledger.registrarComprobante(input));
  }

  async function voucherInput(periodoId: string, concepto: string) {
    const period = await prisma.periodoContable.findUniqueOrThrow({
      where: { id: periodoId },
      select: { fechaInicio: true },
    });
    return {
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
    };
  }

  function holdTenantOperation<T>(work: () => Promise<T>) {
    let resolveReady!: (result: T) => void;
    let rejectReady!: (error: unknown) => void;
    let releaseGate!: () => void;
    let released = false;
    const ready = new Promise<T>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const operation = runAsTenant(() =>
      tenantPrisma.execute(async () => {
        const result = await work();
        resolveReady(result);
        await gate;
        return result;
      }),
    );
    void operation.catch(rejectReady);
    return {
      ready,
      operation,
      release: () => {
        if (released) return;
        released = true;
        releaseGate();
      },
    };
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
