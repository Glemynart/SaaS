import { createHash, randomUUID } from 'node:crypto';
import { EstadoFacturaElectronica } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';

describe('electronic invoice transmission PostgreSQL RLS and immutability', () => {
  const suffix = randomUUID();
  const role = `rls_fe_tx_${suffix.replaceAll('-', '')}`;
  const tenantA = `rls-fe-tx-a-${suffix}`;
  const tenantB = `rls-fe-tx-b-${suffix}`;
  const profileA = `rls-fe-tx-profile-a-${suffix}`;
  const profileB = `rls-fe-tx-profile-b-${suffix}`;
  const rangeA = `rls-fe-tx-range-a-${suffix}`;
  const rangeB = `rls-fe-tx-range-b-${suffix}`;
  const invoiceA = `rls-fe-tx-invoice-a-${suffix}`;
  const invoiceB = `rls-fe-tx-invoice-b-${suffix}`;
  const transmissionA = `rls-fe-tx-transmission-a-${suffix}`;
  const attemptA = `rls-fe-tx-attempt-a-${suffix}`;
  const resultA = `rls-fe-tx-result-a-${suffix}`;
  const transitionA = `rls-fe-tx-transition-a-${suffix}`;
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
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "facturas_electronicas", "transmisiones_facturas_electronicas", "intentos_facturas_electronicas", "resultados_intentos_facturas_electronicas", "transiciones_facturas_electronicas" TO "${role}"`,
    );
    await prisma.tenant.createMany({
      data: [tenantData(tenantA), tenantData(tenantB)],
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
        invoiceData(invoiceA, tenantA, rangeA),
        invoiceData(invoiceB, tenantB, rangeB),
      ],
    });
    const payload = '{"version":1,"total":"119.00"}';
    const payloadHash = createHash('sha256').update(payload).digest('hex');
    await prisma.facturaElectronicaTransmision.create({
      data: {
        id: transmissionA,
        tenantId: tenantA,
        facturaElectronicaId: invoiceA,
        eventoId: 'issue-event-1',
        claveIdempotencia: 'a'.repeat(64),
        versionPayload: '1',
        hashPayload: payloadHash,
        payloadCanonico: payload,
        providerId: 'fake-test',
        contractVersion: '1',
      },
    });
    await prisma.facturaElectronicaTransmision.update({
      where: { id: transmissionA },
      data: { ultimoIntento: 1 },
    });
    await prisma.intentoFacturaElectronica.create({
      data: {
        id: attemptA,
        tenantId: tenantA,
        transmisionId: transmissionA,
        numeroIntento: 1,
        tipo: 'ENVIO',
        providerId: 'fake-test',
        contractVersion: '1',
      },
    });
    await prisma.resultadoIntentoFacturaElectronica.create({
      data: {
        id: resultA,
        tenantId: tenantA,
        intentoId: attemptA,
        estado: 'DESCONOCIDO',
      },
    });
    await prisma.transicionFacturaElectronica.create({
      data: {
        id: transitionA,
        tenantId: tenantA,
        facturaElectronicaId: invoiceA,
        transmisionId: transmissionA,
        intentoId: attemptA,
        desde: EstadoFacturaElectronica.LISTA_PARA_EMITIR,
        hasta: EstadoFacturaElectronica.EN_COLA,
        evento: 'QUEUE',
        actorUserId: 'rls-test-user',
      },
    });
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA, tenantB] } },
    });
    await prisma.$executeRawUnsafe(
      `REVOKE ALL PRIVILEGES ON TABLE "facturas_electronicas", "transmisiones_facturas_electronicas", "intentos_facturas_electronicas", "resultados_intentos_facturas_electronicas", "transiciones_facturas_electronicas" FROM "${role}"`,
    );
    await prisma.$executeRawUnsafe(
      `REVOKE ALL PRIVILEGES ON SCHEMA public FROM "${role}"`,
    );
    await prisma.$executeRawUnsafe(`DROP ROLE IF EXISTS "${role}"`);
    await prisma.$disconnect();
  });

  it('isolates every attempt-history table by tenant', async () => {
    const tenantRows = await runAsTenant(tenantA, () =>
      tenantPrisma.execute(async (client) => ({
        transmissions: await client.facturaElectronicaTransmision.findMany(),
        attempts: await client.intentoFacturaElectronica.findMany(),
        results: await client.resultadoIntentoFacturaElectronica.findMany(),
        transitions: await client.transicionFacturaElectronica.findMany(),
      })),
    );
    expect(tenantRows.transmissions.map(({ id }) => id)).toEqual([
      transmissionA,
    ]);
    expect(tenantRows.attempts.map(({ id }) => id)).toEqual([attemptA]);
    expect(tenantRows.results.map(({ id }) => id)).toEqual([resultA]);
    expect(tenantRows.transitions.map(({ id }) => id)).toEqual([transitionA]);

    const otherTenantRows = await runAsTenant(tenantB, () =>
      tenantPrisma.execute(async (client) => ({
        transmissions: await client.facturaElectronicaTransmision.findMany(),
        attempts: await client.intentoFacturaElectronica.findMany(),
        results: await client.resultadoIntentoFacturaElectronica.findMany(),
        transitions: await client.transicionFacturaElectronica.findMany(),
      })),
    );
    expect(otherTenantRows).toEqual({
      transmissions: [],
      attempts: [],
      results: [],
      transitions: [],
    });
  });

  it('rejects cross-tenant inserts and hides rows when tenant context is absent', async () => {
    await expect(
      runAsTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.facturaElectronicaTransmision.create({
            data: {
              tenantId: tenantB,
              facturaElectronicaId: invoiceB,
              eventoId: 'forged-event',
              claveIdempotencia: 'b'.repeat(64),
              versionPayload: '1',
              hashPayload: 'c'.repeat(64),
              payloadCanonico: '{}',
              providerId: 'fake-test',
              contractVersion: '1',
            },
          }),
        ),
      ),
    ).rejects.toThrow();

    const unscoped = await runAsRlsRole(async (client) => ({
      transmissions: await client.facturaElectronicaTransmision.findMany(),
      attempts: await client.intentoFacturaElectronica.findMany(),
      results: await client.resultadoIntentoFacturaElectronica.findMany(),
      transitions: await client.transicionFacturaElectronica.findMany(),
    }));
    expect(unscoped).toEqual({
      transmissions: [],
      attempts: [],
      results: [],
      transitions: [],
    });
  });

  it('keeps transmission identity, attempts, outcomes, and transitions append-only', async () => {
    await expect(
      prisma.facturaElectronicaTransmision.update({
        where: { id: transmissionA },
        data: { providerId: 'other-provider' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.facturaElectronicaTransmision.update({
        where: { id: transmissionA },
        data: { ultimoIntento: 3 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.intentoFacturaElectronica.update({
        where: { id: attemptA },
        data: { numeroIntento: 2 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.resultadoIntentoFacturaElectronica.update({
        where: { id: resultA },
        data: { estado: 'ACEPTADO' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.transicionFacturaElectronica.update({
        where: { id: transitionA },
        data: { hasta: 'ACEPTADA' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.intentoFacturaElectronica.delete({ where: { id: attemptA } }),
    ).rejects.toThrow();
    await expect(
      prisma.resultadoIntentoFacturaElectronica.delete({
        where: { id: resultA },
      }),
    ).rejects.toThrow();
  });

  it('requires a persisted provider result with evidence before terminal state', async () => {
    await expect(
      prisma.facturaElectronica.update({
        where: { id: invoiceA },
        data: { estado: 'ACEPTADA' },
      }),
    ).rejects.toThrow();

    const attemptB = `rls-fe-tx-attempt-b-${suffix}`;
    await prisma.facturaElectronicaTransmision.update({
      where: { id: transmissionA },
      data: { ultimoIntento: 2 },
    });
    await prisma.intentoFacturaElectronica.create({
      data: {
        id: attemptB,
        tenantId: tenantA,
        transmisionId: transmissionA,
        numeroIntento: 2,
        tipo: 'CONCILIACION',
        providerId: 'fake-test',
        contractVersion: '1',
      },
    });
    await prisma.resultadoIntentoFacturaElectronica.create({
      data: {
        id: `rls-fe-tx-result-b-${suffix}`,
        tenantId: tenantA,
        intentoId: attemptB,
        estado: 'ACEPTADO',
        providerReference: 'provider-reference-test',
        providerAcceptedAt: new Date('2026-10-15T12:00:00.000Z'),
        contenidoTypeEvidencia: 'application/json',
        storageKeyEvidencia: `${tenantA}/facturacion-electronica/${transmissionA}/${attemptB}/evidence`,
        sha256Evidencia: 'd'.repeat(64),
      },
    });

    await expect(
      prisma.facturaElectronica.update({
        where: { id: invoiceA },
        data: { estado: 'ACEPTADA' },
      }),
    ).resolves.toMatchObject({ estado: 'ACEPTADA' });
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

  function tenantData(id: string) {
    const number = id === tenantA ? '93' : '94';
    return {
      id,
      nombre: `Tenant FE tx ${id}`,
      nit: `${number}${suffix.replaceAll('-', '').slice(0, 7)}`,
      digitoVerif: '1',
      razonSocial: `Tenant FE tx ${id}`,
    };
  }

  function rangeData(id: string, perfilEmisorId: string, tenantId: string) {
    return {
      id,
      tenantId,
      perfilEmisorId,
      numeroAutorizacion: '187600000002',
      fechaAutorizacion: new Date('2026-10-01T00:00:00.000Z'),
      vigenciaDesde: new Date('2026-10-01T00:00:00.000Z'),
      vigenciaHasta: new Date('2026-12-31T00:00:00.000Z'),
      prefijo: 'RLS',
      numeroDesde: 1,
      numeroHasta: 10,
      ultimoNumeroAsignado: 1,
    };
  }

  function invoiceData(id: string, tenantId: string, rangeId: string) {
    return {
      id,
      tenantId,
      estado: EstadoFacturaElectronica.EN_COLA,
      prefijo: 'RLS',
      numero: 1,
      rangoNumeracionId: rangeId,
      fechaEmision: new Date('2026-10-15T00:00:00.000Z'),
    };
  }
});
