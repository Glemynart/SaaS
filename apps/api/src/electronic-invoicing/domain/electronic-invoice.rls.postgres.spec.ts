import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextBoundary } from '../../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../../tenant-context/tenant-context.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../../tenant-prisma/tenant-prisma.service';

describe('electronic invoice PostgreSQL RLS', () => {
  const suffix = randomUUID();
  const role = `rls_fe_${suffix.replaceAll('-', '')}`;
  const tenantA = `rls-fe-a-${suffix}`;
  const tenantB = `rls-fe-b-${suffix}`;
  const invoiceA = `rls-fe-invoice-a-${suffix}`;
  const invoiceB = `rls-fe-invoice-b-${suffix}`;
  const tenantContext = new TenantContextService();
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrismaService(
    { $transaction: runAsRlsRole } as unknown as PrismaService,
    new TenantContextBoundary(tenantContext),
  );

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.$executeRawUnsafe(
      `CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOBYPASSRLS`,
    );
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "facturas_electronicas", "lineas_facturas_electronicas" TO "${role}"`,
    );

    await prisma.tenant.createMany({
      data: [
        tenantData(tenantA, `91${suffix.slice(0, 9)}`),
        tenantData(tenantB, `92${suffix.slice(0, 9)}`),
      ],
    });
    await prisma.facturaElectronica.createMany({
      data: [
        { id: invoiceA, tenantId: tenantA },
        { id: invoiceB, tenantId: tenantB },
      ],
    });
    await prisma.lineaFacturaElectronica.createMany({
      data: [lineData(tenantA, invoiceA), lineData(tenantB, invoiceB)],
    });
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA, tenantB] } },
    });
    await prisma.$executeRawUnsafe(
      `REVOKE ALL PRIVILEGES ON TABLE "facturas_electronicas", "lineas_facturas_electronicas" FROM "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `REVOKE ALL PRIVILEGES ON SCHEMA public FROM "${role}"`,
    );
    await prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS "${role}"`);
    await prisma.$disconnect();
  });

  it('isolates root documents and lines by tenant, including nested reads', async () => {
    const result = await runAsTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.facturaElectronica.findMany({
          include: { lineas: true },
        }),
      ),
    );

    expect(result.map(({ id }) => id)).toEqual([invoiceA]);
    expect(result[0].lineas).toHaveLength(1);
    expect(result[0].lineas[0].tenantId).toBe(tenantA);
    await expect(
      runAsTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.facturaElectronica.findUnique({ where: { id: invoiceB } }),
        ),
      ),
    ).resolves.toBeNull();
  });

  it('denies cross-tenant inserts and hides rows without tenant context', async () => {
    await expect(
      runAsTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.facturaElectronica.create({
            data: { id: `rls-fe-forged-${suffix}`, tenantId: tenantB },
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      runAsTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.lineaFacturaElectronica.create({
            data: lineData(tenantB, invoiceB),
          }),
        ),
      ),
    ).rejects.toThrow();

    const unscoped = await runAsRlsRole((client) =>
      client.facturaElectronica.findMany(),
    );
    expect(unscoped).toEqual([]);
    const unscopedLines = await runAsRlsRole((client) =>
      client.lineaFacturaElectronica.findMany(),
    );
    expect(unscopedLines).toEqual([]);
  });

  it('requires a number before processing and freezes snapshots after numbering', async () => {
    await expect(
      prisma.facturaElectronica.create({
        data: {
          id: `rls-fe-unqueued-${suffix}`,
          tenantId: tenantA,
          estado: 'EN_COLA',
        },
      }),
    ).rejects.toThrow();

    await prisma.facturaElectronica.update({
      where: { id: invoiceA },
      data: { estado: 'EN_COLA', prefijo: 'RLS', numero: 1 },
    });
    await expect(
      prisma.facturaElectronica.update({
        where: { id: invoiceA },
        data: { subtotal: 1 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.facturaElectronica.delete({ where: { id: invoiceA } }),
    ).rejects.toThrow();
    await expect(
      prisma.lineaFacturaElectronica.updateMany({
        where: { facturaElectronicaId: invoiceA, tenantId: tenantA },
        data: { descripcion: 'Alteración posterior a numeración' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.lineaFacturaElectronica.create({
        data: lineData(tenantA, invoiceA),
      }),
    ).rejects.toThrow();

    await expect(
      prisma.facturaElectronica.update({
        where: { id: invoiceA },
        data: { estado: 'EN_TRANSMISION' },
      }),
    ).resolves.toMatchObject({ estado: 'EN_TRANSMISION' });
  });

  function runAsRlsRole<T>(
    work: (client: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (client) => {
      await client.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
      return work(client);
    });
  }

  function runAsTenant<T>(
    tenantId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    return tenantContext.run(
      {
        tenantId,
        userId: 'rls-fe-test-user',
        rol: 'ADMIN',
        email: 'rls-fe-test@example.com',
      },
      work,
    );
  }

  function tenantData(id: string, nit: string) {
    return {
      id,
      nombre: `Tenant FE ${id}`,
      nit,
      digitoVerif: '1',
      razonSocial: `Tenant FE ${id}`,
    };
  }

  function lineData(tenantId: string, facturaElectronicaId: string) {
    return {
      tenantId,
      facturaElectronicaId,
      descripcion: 'Servicio de prueba',
      unidad: 'NIU',
      cantidad: 1,
      valorUnitario: 100,
      subtotal: 100,
      impuestos: 19,
      total: 119,
    };
  }
});
