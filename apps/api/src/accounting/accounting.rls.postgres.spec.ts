import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { ReportingService } from './reporting/reporting.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';

describe('accounting PostgreSQL RLS', () => {
  const suffix = randomUUID();
  const role = `rls_accounting_${suffix.replaceAll('-', '')}`;
  const tenantA = `rls-accounting-a-${suffix}`;
  const tenantB = `rls-accounting-b-${suffix}`;
  const globalAccountId = randomUUID();
  const accountAId = randomUUID();
  const accountBId = randomUUID();
  const thirdPartyAId = randomUUID();
  const thirdPartyBId = randomUUID();
  const periodAId = randomUUID();
  const periodBId = randomUUID();
  const costCenterAId = randomUUID();
  const costCenterBId = randomUUID();
  const systemMapAId = randomUUID();
  const systemMapBId = randomUUID();
  const voucherAId = randomUUID();
  const voucherBId = randomUUID();
  const movementAId = randomUUID();
  const movementBId = randomUUID();
  const voucherTypeId = randomUUID();
  const tenantContext = new TenantContextService();
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrismaService(
    { $transaction: runAsRlsRole } as unknown as PrismaService,
    new TenantContextBoundary(tenantContext),
  );
  const reporting = new ReportingService(tenantPrisma);

  beforeAll(async () => {
    await prisma.$connect();
    await dropTestRole();
    await prisma.$executeRawUnsafe(
      `CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOBYPASSRLS`,
    );
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "comprobantes_contables", "movimientos_contables", "secuencias_comprobante" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "cuentas_contables" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "terceros" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "centros_costo" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "cuenta_sistema_map" TO "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "periodos_contables" TO "${role}"`,
    );

    await prisma.tenant.createMany({
      data: [
        tenantData(tenantA, `91${suffix.slice(0, 9)}`),
        tenantData(tenantB, `92${suffix.slice(0, 9)}`),
      ],
    });
    await prisma.tipoComprobante.create({
      data: {
        id: voucherTypeId,
        codigo: `RLS${suffix.slice(0, 8)}`,
        nombre: 'Tipo RLS',
      },
    });
    await prisma.cuentaContable.createMany({
      data: [
        accountData(globalAccountId, null, `RLS-${suffix}`),
        accountData(accountAId, tenantA, '1000'),
        accountData(accountBId, tenantB, '1000'),
      ],
    });
    await prisma.tercero.createMany({
      data: [
        thirdPartyData(thirdPartyAId, tenantA, `100${suffix}`),
        thirdPartyData(thirdPartyBId, tenantB, `200${suffix}`),
      ],
    });
    await prisma.periodoContable.createMany({
      data: [periodData(periodAId, tenantA), periodData(periodBId, tenantB)],
    });
    await prisma.centroCosto.createMany({
      data: [
        {
          id: costCenterAId,
          tenantId: tenantA,
          codigo: `RLS-${suffix}-A`,
          nombre: 'Centro A',
        },
        {
          id: costCenterBId,
          tenantId: tenantB,
          codigo: `RLS-${suffix}-B`,
          nombre: 'Centro B',
        },
      ],
    });
    await prisma.cuentaSistemaMap.createMany({
      data: [
        {
          id: systemMapAId,
          tenantId: tenantA,
          rol: `RLS-${suffix}-A`,
          cuentaId: accountAId,
        },
        {
          id: systemMapBId,
          tenantId: tenantB,
          rol: `RLS-${suffix}-B`,
          cuentaId: accountBId,
        },
      ],
    });
    await prisma.comprobanteContable.createMany({
      data: [
        voucherData(voucherAId, tenantA, periodAId),
        voucherData(voucherBId, tenantB, periodBId),
      ],
    });
    await prisma.movimientoContable.createMany({
      data: [
        movementData(movementAId, tenantA, voucherAId, accountAId),
        movementData(movementBId, tenantB, voucherBId, accountBId),
      ],
    });
    await prisma.secuenciaComprobante.createMany({
      data: [
        {
          tenantId: tenantA,
          tipoComprobanteId: voucherTypeId,
          updatedAt: new Date(),
        },
        {
          tenantId: tenantB,
          tipoComprobanteId: voucherTypeId,
          updatedAt: new Date(),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.movimientoContable.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await prisma.comprobanteContable.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await prisma.secuenciaComprobante.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await prisma.cuentaSistemaMap.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await prisma.tercero.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await prisma.centroCosto.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await prisma.periodoContable.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await prisma.cuentaContable.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await prisma.cuentaContable.deleteMany({ where: { id: globalAccountId } });
    await prisma.tipoComprobante.deleteMany({ where: { id: voucherTypeId } });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA, tenantB] } },
    });
    await dropTestRole();
    await prisma.$disconnect();
  });

  it('enables and forces RLS for the Ledger cohort and tenant catalogs', async () => {
    const expected = [
      'centros_costo',
      'comprobantes_contables',
      'cuentas_contables',
      'cuenta_sistema_map',
      'movimientos_contables',
      'secuencias_comprobante',
      'terceros',
    ];
    const protectedTables = await prisma.$queryRaw<{ tableName: string }[]>`
      SELECT relname AS "tableName" FROM pg_class
      WHERE relkind = 'r' AND relrowsecurity
      ORDER BY relname COLLATE "C"
    `;
    const forcedTables = await prisma.$queryRaw<{ tableName: string }[]>`
      SELECT relname AS "tableName" FROM pg_class
      WHERE relkind = 'r' AND relforcerowsecurity
      ORDER BY relname COLLATE "C"
    `;
    const actual = protectedTables.map(({ tableName }) => tableName);
    expect(actual).toEqual([...actual].sort());
    expect(forcedTables.map(({ tableName }) => tableName)).toEqual(actual);
    for (const table of expected) expect(actual).toContain(table);
  });

  it('isolates Ledger and accounting catalog rows by tenant', async () => {
    const readRows = (client: TenantPrismaClient) =>
      Promise.all([
        client.comprobanteContable.findMany({
          where: { id: { in: [voucherAId, voucherBId] } },
          orderBy: { id: 'asc' },
          select: { id: true, tenantId: true },
        }),
        client.movimientoContable.findMany({
          where: { id: { in: [movementAId, movementBId] } },
          orderBy: { id: 'asc' },
          select: { id: true, tenantId: true },
        }),
        client.secuenciaComprobante.findMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
          orderBy: { tenantId: 'asc' },
          select: { tenantId: true },
        }),
        client.tercero.findMany({
          where: { id: { in: [thirdPartyAId, thirdPartyBId] } },
          orderBy: { id: 'asc' },
          select: { id: true, tenantId: true },
        }),
        client.centroCosto.findMany({
          where: { id: { in: [costCenterAId, costCenterBId] } },
          orderBy: { id: 'asc' },
          select: { id: true, tenantId: true },
        }),
        client.cuentaSistemaMap.findMany({
          where: { id: { in: [systemMapAId, systemMapBId] } },
          orderBy: { id: 'asc' },
          select: { id: true, tenantId: true },
        }),
        client.cuentaContable.findMany({
          where: { id: { in: [globalAccountId, accountAId, accountBId] } },
          orderBy: [{ tenantId: 'asc' }, { id: 'asc' }],
          select: { id: true, tenantId: true },
        }),
        client.periodoContable.findMany({
          where: { id: { in: [periodAId, periodBId] } },
          orderBy: { id: 'asc' },
          select: { id: true, tenantId: true },
        }),
      ]);
    const readForTenant = (tenantId: string) =>
      tenantContext.run(
        {
          tenantId,
          userId: 'rls-accounting-test-user',
          rol: 'ADMIN',
          email: 'rls-accounting-test@example.com',
        },
        () => tenantPrisma.execute(readRows),
      );
    const [rowsA, rowsB, rowsWithoutContext] = await Promise.all([
      readForTenant(tenantA),
      readForTenant(tenantB),
      runAsRlsRole(readRows),
    ]);

    expect(rowsA.map((rows) => rows.map((row) => row.tenantId).sort())).toEqual(
      [
        [tenantA],
        [tenantA],
        [tenantA],
        [tenantA],
        [tenantA],
        [tenantA],
        [null, tenantA],
        [tenantA],
      ],
    );
    expect(rowsB.map((rows) => rows.map((row) => row.tenantId).sort())).toEqual(
      [
        [tenantB],
        [tenantB],
        [tenantB],
        [tenantB],
        [tenantB],
        [tenantB],
        [null, tenantB],
        [tenantB],
      ],
    );
    expect(
      rowsWithoutContext.map((rows) => rows.map((row) => row.tenantId)),
    ).toEqual([[], [], [], [], [], [], [null], []]);
    expect(rowsA[3]).toMatchObject([{ id: thirdPartyAId, tenantId: tenantA }]);
    expect(rowsB[3]).toMatchObject([{ id: thirdPartyBId, tenantId: tenantB }]);
    expect(rowsA[4]).toMatchObject([{ id: costCenterAId, tenantId: tenantA }]);
    expect(rowsB[4]).toMatchObject([{ id: costCenterBId, tenantId: tenantB }]);
    expect(rowsA[5]).toMatchObject([{ id: systemMapAId, tenantId: tenantA }]);
    expect(rowsB[5]).toMatchObject([{ id: systemMapBId, tenantId: tenantB }]);
    expect(rowsA[6]).toEqual(
      expect.arrayContaining([
        { id: globalAccountId, tenantId: null },
        { id: accountAId, tenantId: tenantA },
      ]),
    );
    expect(rowsA[6]).toHaveLength(2);
    expect(rowsB[6]).toEqual(
      expect.arrayContaining([
        { id: globalAccountId, tenantId: null },
        { id: accountBId, tenantId: tenantB },
      ]),
    );
    expect(rowsB[6]).toHaveLength(2);
    expect(rowsWithoutContext[6]).toMatchObject([
      { id: globalAccountId, tenantId: null },
    ]);
    expect(rowsA[7]).toMatchObject([{ id: periodAId, tenantId: tenantA }]);
    expect(rowsB[7]).toMatchObject([{ id: periodBId, tenantId: tenantB }]);
    expect(rowsWithoutContext[7]).toEqual([]);
  });

  it('limits accounting period writes to the active tenant and disallows deletion', async () => {
    const createdPeriodId = randomUUID();
    const runForTenant = <T>(tenantId: string, work: () => Promise<T>) =>
      tenantContext.run(
        {
          tenantId,
          userId: 'rls-accounting-test-user',
          rol: 'ADMIN',
          email: 'rls-accounting-test@example.com',
        },
        work,
      );

    const created = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.periodoContable.create({
          data: periodData(createdPeriodId, tenantA, 2027, 1),
        }),
      ),
    );
    expect(created.tenantId).toBe(tenantA);

    const updatedOwnTenant = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.periodoContable.updateMany({
          where: { id: createdPeriodId },
          data: { estado: 'CERRADO' },
        }),
      ),
    );
    expect(updatedOwnTenant.count).toBe(1);

    await expect(
      runForTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.periodoContable.create({
            data: periodData(randomUUID(), tenantB, 2027, 1),
          }),
        ),
      ),
    ).rejects.toThrow();

    const updatedOtherTenant = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.periodoContable.updateMany({
          where: { id: periodBId },
          data: { estado: 'CERRADO' },
        }),
      ),
    );
    expect(updatedOtherTenant.count).toBe(0);

    await expect(
      runForTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.periodoContable.updateMany({
            where: { id: createdPeriodId },
            data: { tenantId: tenantB },
          }),
        ),
      ),
    ).rejects.toThrow();

    const deletedOwnPeriod = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.periodoContable.deleteMany({
          where: { id: createdPeriodId },
        }),
      ),
    );
    expect(deletedOwnPeriod.count).toBe(0);
  });

  it('limits PUC writes to tenant-owned accounts and keeps the global template read-only', async () => {
    const createdId = randomUUID();
    const created = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.cuentaContable.create({
            data: accountData(createdId, tenantA, `RLS-${suffix}-CREATED`),
          }),
        ),
    );
    expect(created.tenantId).toBe(tenantA);

    const updateOwnTenant = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.cuentaContable.updateMany({
            where: { id: createdId },
            data: { nombre: 'Actualizada dentro del tenant A' },
          }),
        ),
    );
    expect(updateOwnTenant.count).toBe(1);

    await expect(
      tenantContext.run(
        {
          tenantId: tenantA,
          userId: 'rls-accounting-test-user',
          rol: 'ADMIN',
          email: 'rls-accounting-test@example.com',
        },
        () =>
          tenantPrisma.execute((client) =>
            client.cuentaContable.create({
              data: accountData(randomUUID(), tenantB, `RLS-${suffix}-CROSS`),
            }),
          ),
      ),
    ).rejects.toThrow();

    await expect(
      tenantContext.run(
        {
          tenantId: tenantA,
          userId: 'rls-accounting-test-user',
          rol: 'ADMIN',
          email: 'rls-accounting-test@example.com',
        },
        () =>
          tenantPrisma.execute((client) =>
            client.cuentaContable.create({
              data: accountData(randomUUID(), null, `RLS-${suffix}-GLOBAL`),
            }),
          ),
      ),
    ).rejects.toThrow();

    const updateOtherTenant = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.cuentaContable.updateMany({
            where: { id: accountBId },
            data: { nombre: 'No debe editarse desde tenant A' },
          }),
        ),
    );
    const updateGlobal = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.cuentaContable.updateMany({
            where: { id: globalAccountId },
            data: { nombre: 'No debe editarse desde tenant A' },
          }),
        ),
    );
    const deleteOtherTenant = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.cuentaContable.deleteMany({ where: { id: accountBId } }),
        ),
    );
    const deleteGlobal = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.cuentaContable.deleteMany({ where: { id: globalAccountId } }),
        ),
    );
    expect(updateOtherTenant.count).toBe(0);
    expect(updateGlobal.count).toBe(0);
    expect(deleteOtherTenant.count).toBe(0);
    expect(deleteGlobal.count).toBe(0);

    await expect(
      tenantContext.run(
        {
          tenantId: tenantA,
          userId: 'rls-accounting-test-user',
          rol: 'ADMIN',
          email: 'rls-accounting-test@example.com',
        },
        () =>
          tenantPrisma.execute((client) =>
            client.cuentaContable.updateMany({
              where: { id: accountAId },
              data: { tenantId: tenantB },
            }),
          ),
      ),
    ).rejects.toThrow();
  });

  it('serves Ledger reports through the active tenant context', async () => {
    const readForTenant = (tenantId: string) =>
      tenantContext.run(
        {
          tenantId,
          userId: 'rls-accounting-test-user',
          rol: 'ADMIN',
          email: 'rls-accounting-test@example.com',
        },
        () => reporting.obtenerLibroDiario(tenantId, { page: 1, limit: 20 }),
      );

    const [reportA, reportB] = await Promise.all([
      readForTenant(tenantA),
      readForTenant(tenantB),
    ]);

    expect(reportA.items.map(({ comprobanteId }) => comprobanteId)).toEqual([
      voucherAId,
    ]);
    expect(reportA.items[0].movimientos[0]).toMatchObject({
      cuentaId: accountAId,
      cuentaCodigo: '1000',
    });
    expect(reportB.items.map(({ comprobanteId }) => comprobanteId)).toEqual([
      voucherBId,
    ]);
    expect(reportB.items[0].movimientos[0]).toMatchObject({
      cuentaId: accountBId,
      cuentaCodigo: '1000',
    });
  });

  it('allows tenant-owned ledger writes and rejects cross-tenant access', async () => {
    await expect(
      tenantContext.run(
        {
          tenantId: tenantA,
          userId: 'rls-accounting-test-user',
          rol: 'ADMIN',
          email: 'rls-accounting-test@example.com',
        },
        () =>
          tenantPrisma.execute((client) =>
            client.movimientoContable.create({
              data: {
                ...movementData(randomUUID(), tenantA, voucherAId, accountAId),
                linea: 2,
              },
            }),
          ),
      ),
    ).resolves.toMatchObject({ tenantId: tenantA });

    await expect(
      tenantContext.run(
        {
          tenantId: tenantA,
          userId: 'rls-accounting-test-user',
          rol: 'ADMIN',
          email: 'rls-accounting-test@example.com',
        },
        () =>
          tenantPrisma.execute((client) =>
            client.movimientoContable.create({
              data: movementData(randomUUID(), tenantB, voucherBId, accountBId),
            }),
          ),
      ),
    ).rejects.toThrow();

    const update = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.movimientoContable.updateMany({
            where: { id: movementBId },
            data: { descripcion: 'No debe cruzar tenant' },
          }),
        ),
    );
    const deletion = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.movimientoContable.deleteMany({ where: { id: movementBId } }),
        ),
    );
    expect(update.count).toBe(0);
    expect(deletion.count).toBe(0);
    await expect(
      prisma.movimientoContable.findUnique({ where: { id: movementBId } }),
    ).resolves.toMatchObject({ tenantId: tenantB });
  });

  it('allows third-party DML only for the active tenant', async () => {
    const created = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.tercero.create({
            data: thirdPartyData(randomUUID(), tenantA, `300${suffix}`),
          }),
        ),
    );
    expect(created.tenantId).toBe(tenantA);

    await expect(
      tenantContext.run(
        {
          tenantId: tenantA,
          userId: 'rls-accounting-test-user',
          rol: 'ADMIN',
          email: 'rls-accounting-test@example.com',
        },
        () =>
          tenantPrisma.execute((client) =>
            client.tercero.create({
              data: thirdPartyData(randomUUID(), tenantB, `400${suffix}`),
            }),
          ),
      ),
    ).rejects.toThrow();

    const update = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.tercero.updateMany({
            where: { id: thirdPartyBId },
            data: { razonSocial: 'No debe cruzar tenant' },
          }),
        ),
    );
    const deletion = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.tercero.deleteMany({ where: { id: thirdPartyBId } }),
        ),
    );
    expect(update.count).toBe(0);
    expect(deletion.count).toBe(0);
  });

  it('allows cost-center DML only for the active tenant', async () => {
    const createdId = randomUUID();
    const created = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.centroCosto.create({
            data: {
              id: createdId,
              tenantId: tenantA,
              codigo: `RLS-${suffix}-CREATED`,
              nombre: 'Centro creado en tenant A',
            },
          }),
        ),
    );
    expect(created.tenantId).toBe(tenantA);

    await expect(
      tenantContext.run(
        {
          tenantId: tenantA,
          userId: 'rls-accounting-test-user',
          rol: 'ADMIN',
          email: 'rls-accounting-test@example.com',
        },
        () =>
          tenantPrisma.execute((client) =>
            client.centroCosto.create({
              data: {
                id: randomUUID(),
                tenantId: tenantB,
                codigo: `RLS-${suffix}-CROSS`,
                nombre: 'No debe cruzar tenant',
              },
            }),
          ),
      ),
    ).rejects.toThrow();

    const update = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.centroCosto.updateMany({
            where: { id: costCenterBId },
            data: { nombre: 'No debe editarse desde tenant A' },
          }),
        ),
    );
    const deletion = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.centroCosto.deleteMany({ where: { id: costCenterBId } }),
        ),
    );
    expect(update.count).toBe(0);
    expect(deletion.count).toBe(0);
  });

  it('allows system-account mapping DML only for the active tenant', async () => {
    const createdId = randomUUID();
    const created = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.cuentaSistemaMap.create({
            data: {
              id: createdId,
              tenantId: tenantA,
              rol: `RLS-${suffix}-CREATED`,
              cuentaId: accountAId,
            },
          }),
        ),
    );
    expect(created.tenantId).toBe(tenantA);

    await expect(
      tenantContext.run(
        {
          tenantId: tenantA,
          userId: 'rls-accounting-test-user',
          rol: 'ADMIN',
          email: 'rls-accounting-test@example.com',
        },
        () =>
          tenantPrisma.execute((client) =>
            client.cuentaSistemaMap.create({
              data: {
                id: randomUUID(),
                tenantId: tenantB,
                rol: `RLS-${suffix}-CROSS`,
                cuentaId: accountBId,
              },
            }),
          ),
      ),
    ).rejects.toThrow();

    const update = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.cuentaSistemaMap.updateMany({
            where: { id: systemMapBId },
            data: { activo: false },
          }),
        ),
    );
    const deletion = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.cuentaSistemaMap.deleteMany({
            where: { id: systemMapBId },
          }),
        ),
    );
    expect(update.count).toBe(0);
    expect(deletion.count).toBe(0);
  });

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
      nombre: `Tenant RLS ${id}`,
      nit,
      digitoVerif: '1',
      razonSocial: `Tenant RLS ${id}`,
    };
  }

  function accountData(id: string, tenantId: string | null, codigo: string) {
    return {
      id,
      tenantId,
      codigo,
      nombre: 'Cuenta RLS',
      claseContable: 'ACTIVO' as const,
      naturaleza: 'DEBITO' as const,
      nivel: 4,
      imputable: true,
      updatedAt: new Date(),
    };
  }

  function thirdPartyData(
    id: string,
    tenantId: string,
    numeroDocumento: string,
  ) {
    return {
      id,
      tenantId,
      tipoDocumento: 'CC' as const,
      numeroDocumento,
      tipoPersona: 'NATURAL' as const,
      primerNombre: 'Tercero',
      primerApellido: 'RLS',
      updatedAt: new Date(),
    };
  }

  function periodData(id: string, tenantId: string, anio = 2026, mes = 11) {
    return {
      id,
      tenantId,
      anio,
      mes,
      fechaInicio: new Date(Date.UTC(anio, mes - 1, 1)),
      fechaFin: new Date(Date.UTC(anio, mes, 0)),
      updatedAt: new Date(),
    };
  }

  function voucherData(id: string, tenantId: string, periodoId: string) {
    return {
      id,
      tenantId,
      tipoComprobanteId: voucherTypeId,
      periodoId,
      numero: 1,
      fecha: new Date('2026-11-15T00:00:00.000Z'),
      concepto: 'Comprobante RLS',
      estado: 'CONTABILIZADO' as const,
      totalDebito: 100,
      totalCredito: 100,
      usuarioId: 'rls-accounting-test-user',
      contabilizadoAt: new Date(),
      updatedAt: new Date(),
    };
  }

  function movementData(
    id: string,
    tenantId: string,
    comprobanteId: string,
    cuentaId: string,
  ) {
    return {
      id,
      tenantId,
      comprobanteId,
      linea: 1,
      cuentaId,
      debito: 100,
      credito: 0,
    };
  }
});
