import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
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

  beforeAll(async () => {
    await prisma.$connect();
    await dropTestRole();
    await prisma.$executeRawUnsafe(
      `CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOBYPASSRLS`,
    );
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "cuentas_contables", "terceros", "periodos_contables", "centros_costo", "cuenta_sistema_map", "comprobantes_contables", "movimientos_contables", "secuencias_comprobante" TO "${role}"`,
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

  it('enables and forces RLS for the complete tenant accounting cohort', async () => {
    const expected = [
      'centros_costo',
      'comprobantes_contables',
      'cuenta_sistema_map',
      'cuentas_contables',
      'movimientos_contables',
      'periodos_contables',
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

  it('isolates accounting rows by tenant while exposing only the global chart template', async () => {
    const readRows = (client: TenantPrismaClient) =>
      Promise.all([
        client.cuentaContable.findMany({
          where: { id: { in: [globalAccountId, accountAId, accountBId] } },
          orderBy: { id: 'asc' },
          select: { id: true, tenantId: true },
        }),
        client.tercero.findMany({
          where: { id: { in: [thirdPartyAId, thirdPartyBId] } },
          orderBy: { id: 'asc' },
          select: { id: true, tenantId: true },
        }),
        client.periodoContable.findMany({
          where: { id: { in: [periodAId, periodBId] } },
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
        [null, tenantA],
        [tenantA],
        [tenantA],
        [tenantA],
        [tenantA],
        [tenantA],
        [tenantA],
        [tenantA],
      ],
    );
    expect(rowsB.map((rows) => rows.map((row) => row.tenantId).sort())).toEqual(
      [
        [null, tenantB],
        [tenantB],
        [tenantB],
        [tenantB],
        [tenantB],
        [tenantB],
        [tenantB],
        [tenantB],
      ],
    );
    expect(
      rowsWithoutContext.map((rows) => rows.map((row) => row.tenantId)),
    ).toEqual([[null], [], [], [], [], [], [], []]);
  });

  it('rejects cross-tenant ledger writes and does not mutate another tenant', async () => {
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

  it('keeps global chart templates read-only to tenant sessions', async () => {
    const ownAccountId = randomUUID();
    const createdTenantAccount = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.cuentaContable.create({
            data: accountData(ownAccountId, tenantA, `9001-${suffix}`),
            select: { id: true, tenantId: true },
          }),
        ),
    );
    const visibleTemplate = await tenantContext.run(
      {
        tenantId: tenantA,
        userId: 'rls-accounting-test-user',
        rol: 'ADMIN',
        email: 'rls-accounting-test@example.com',
      },
      () =>
        tenantPrisma.execute((client) =>
          client.cuentaContable.findMany({
            where: { id: globalAccountId },
            select: { tenantId: true },
          }),
        ),
    );
    const update = await tenantContext.run(
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
            data: { nombre: 'No debe poder editarse' },
          }),
        ),
    );
    expect(createdTenantAccount).toEqual({
      id: ownAccountId,
      tenantId: tenantA,
    });
    expect(visibleTemplate).toEqual([{ tenantId: null }]);
    expect(update.count).toBe(0);
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
              data: accountData(randomUUID(), null, `9000-${suffix}`),
            }),
          ),
      ),
    ).rejects.toThrow();
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

  function periodData(id: string, tenantId: string) {
    return {
      id,
      tenantId,
      anio: 2026,
      mes: 11,
      fechaInicio: new Date('2026-11-01T00:00:00.000Z'),
      fechaFin: new Date('2026-11-30T00:00:00.000Z'),
      updatedAt: new Date(),
    };
  }

  function voucherData(id: string, tenantId: string, periodoId: string) {
    return {
      id,
      tenantId,
      tipoComprobanteId: voucherTypeId,
      periodoId,
      fecha: new Date('2026-11-15T00:00:00.000Z'),
      concepto: 'Comprobante RLS',
      usuarioId: 'rls-accounting-test-user',
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
