import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextBoundary } from '../../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../../tenant-context/tenant-context.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../../tenant-prisma/tenant-prisma.service';
import { ElectronicInvoiceConfigurationService } from '../electronic-invoice-configuration.service';

describe('electronic invoice PostgreSQL RLS', () => {
  const suffix = randomUUID();
  const role = `rls_fe_${suffix.replaceAll('-', '')}`;
  const tenantA = `rls-fe-a-${suffix}`;
  const tenantB = `rls-fe-b-${suffix}`;
  const invoiceA = `rls-fe-invoice-a-${suffix}`;
  const invoiceB = `rls-fe-invoice-b-${suffix}`;
  const profileA = `rls-fe-profile-a-${suffix}`;
  const profileB = `rls-fe-profile-b-${suffix}`;
  const rangeA = `rls-fe-range-a-${suffix}`;
  const rangeB = `rls-fe-range-b-${suffix}`;
  const tenantContext = new TenantContextService();
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrismaService(
    { $transaction: runAsRlsRole } as unknown as PrismaService,
    new TenantContextBoundary(tenantContext),
  );
  const auditLog = jest.fn().mockResolvedValue(undefined);
  const audit = { log: auditLog } as unknown as AuditService;
  const configuration = new ElectronicInvoiceConfigurationService(
    tenantPrisma,
    audit,
  );

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.$executeRawUnsafe(
      `CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOBYPASSRLS`,
    );
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "facturas_electronicas", "lineas_facturas_electronicas", "perfiles_emisor_electronicos", "rangos_numeracion_electronica" TO "${role}"`,
    );

    await prisma.tenant.createMany({
      data: [
        tenantData(tenantA, `91${suffix.slice(0, 9)}`),
        tenantData(tenantB, `92${suffix.slice(0, 9)}`),
      ],
    });
    await prisma.perfilEmisorElectronico.createMany({
      data: [
        { id: profileA, tenantId: tenantA, ambiente: 'PRODUCCION' },
        { id: profileB, tenantId: tenantB, ambiente: 'PRODUCCION' },
      ],
    });
    await prisma.rangoNumeracionElectronica.createMany({
      data: [
        rangeData(rangeA, profileA, tenantA),
        rangeData(rangeB, profileB, tenantB),
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
      `REVOKE ALL PRIVILEGES ON TABLE "facturas_electronicas", "lineas_facturas_electronicas", "perfiles_emisor_electronicos", "rangos_numeracion_electronica" FROM "${role}"`,
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
    await expect(
      runAsTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.perfilEmisorElectronico.create({
            data: { tenantId: tenantB, ambiente: 'HABILITACION' },
          }),
        ),
      ),
    ).rejects.toThrow();
    const unscopedProfiles = await runAsRlsRole((client) =>
      client.perfilEmisorElectronico.findMany(),
    );
    expect(unscopedProfiles).toEqual([]);
    const unscopedRanges = await runAsRlsRole((client) =>
      client.rangoNumeracionElectronica.findMany(),
    );
    expect(unscopedRanges).toEqual([]);
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

    await prisma.$transaction(async (tx) => {
      await tx.rangoNumeracionElectronica.update({
        where: { id: rangeA },
        data: { ultimoNumeroAsignado: 1 },
      });
      await tx.facturaElectronica.update({
        where: { id: invoiceA },
        data: {
          estado: 'EN_COLA',
          prefijo: 'RLS',
          numero: 1,
          rangoNumeracionId: rangeA,
          fechaEmision: new Date('2026-10-15T00:00:00.000Z'),
        },
      });
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

  it('allocates numbers atomically and rolls them back with the invoice transaction', async () => {
    const allocate = () =>
      runAsTenant(tenantB, () =>
        tenantPrisma.execute(() =>
          configuration.allocateNextNumber({
            tenantId: tenantB,
            userId: 'rls-fe-test-user',
            rangeId: rangeB,
            ambiente: 'PRODUCCION',
            fechaEmision: new Date('2026-10-15T00:00:00.000Z'),
          }),
        ),
      );

    await expect(
      runAsTenant(tenantB, () =>
        tenantPrisma.execute(async () => {
          await configuration.allocateNextNumber({
            tenantId: tenantB,
            userId: 'rls-fe-test-user',
            rangeId: rangeB,
            ambiente: 'PRODUCCION',
            fechaEmision: new Date('2026-10-15T00:00:00.000Z'),
          });
          throw new Error('rollback expected');
        }),
      ),
    ).rejects.toThrow('rollback expected');

    // The audit entry participates in the same transaction, so the audit
    // service is invoked before the caller decides to roll the transaction
    // back. Ignore that rolled-back invocation when asserting committed ones.
    auditLog.mockClear();

    await expect(allocate()).resolves.toMatchObject({
      numero: 1,
      prefijo: 'RLS',
    });
    const concurrent = await Promise.all([allocate(), allocate()]);
    expect(concurrent.map(({ numero }) => numero).sort()).toEqual([2, 3]);
    expect(auditLog).toHaveBeenCalledTimes(3);

    await runAsTenant(tenantB, () =>
      configuration.deactivateNumberingRange('rls-fe-test-user', rangeB, {
        motivo: 'Rango de prueba retirado',
      }),
    );
    await expect(
      prisma.rangoNumeracionElectronica.update({
        where: { id: rangeB },
        data: { motivoInactivacion: 'Cambio de motivo historico' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.rangoNumeracionElectronica.update({
        where: { id: rangeB },
        data: { ultimoNumeroAsignado: 4 },
      }),
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

  function rangeData(id: string, perfilEmisorId: string, tenantId: string) {
    return {
      id,
      tenantId,
      perfilEmisorId,
      numeroAutorizacion: '187600000001',
      fechaAutorizacion: new Date('2026-10-01T00:00:00.000Z'),
      vigenciaDesde: new Date('2026-10-01T00:00:00.000Z'),
      vigenciaHasta: new Date('2026-12-31T00:00:00.000Z'),
      prefijo: 'RLS',
      numeroDesde: 1,
      numeroHasta: 10,
      ultimoNumeroAsignado: 0,
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
