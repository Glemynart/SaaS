import { Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { ExpedienteDocsService } from '../expediente-docs/expediente-docs.service';
import { GeneratedDocumentsService } from '../generated-documents/generated-documents.service';
import { ContratoTipo } from './dto/create-contract.dto';
import { ContractsService } from './contracts.service';

describe('Contract PostgreSQL RLS', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const role = `rls_contract_${suffix}`;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const employeeA = randomUUID();
  const employeeB = randomUUID();
  const siteB = randomUUID();
  const contractA = randomUUID();
  const contractB = randomUUID();
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
  const service = new ContractsService(
    prisma,
    tenantPrisma,
    { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
    {} as GeneratedDocumentsService,
    {} as ExpedienteDocsService,
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
      'GRANT SELECT, INSERT, UPDATE ON TABLE "contratos" TO "' + role + '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT SELECT ON TABLE "empleados", "sedes", "plantillas", ' +
        '"lotes_contrato", "perfiles_contractuales" TO "' +
        role +
        '"',
    );
    await prisma.$executeRawUnsafe(
      'GRANT USAGE ON TYPE "ContratoTipo", "ContratoEstado" TO "' + role + '"',
    );

    await prisma.tenant.createMany({
      data: [tenantData(tenantA, '81'), tenantData(tenantB, '82')],
    });
    await prisma.empleado.createMany({
      data: [
        employeeData(employeeA, tenantA, 'a'),
        employeeData(employeeB, tenantB, 'b'),
      ],
    });
    await prisma.sede.create({
      data: { id: siteB, tenantId: tenantB, nombre: 'Sede tenant B' },
    });
    await prisma.contrato.createMany({
      data: [
        contractData(contractA, tenantA, employeeA),
        contractData(contractB, tenantB, employeeB),
      ],
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.contrato.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await prisma.sede.deleteMany({ where: { id: siteB } });
      await prisma.empleado.deleteMany({
        where: { id: { in: [employeeA, employeeB] } },
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

  it('enables and forces RLS without granting physical deletion', async () => {
    const [table] = await prisma.$queryRawUnsafe<
      { rowSecurity: boolean; forceRowSecurity: boolean }[]
    >(
      'SELECT relrowsecurity AS "rowSecurity", ' +
        'relforcerowsecurity AS "forceRowSecurity" ' +
        "FROM pg_class WHERE oid = 'public.contratos'::regclass",
    );
    const policies = await prisma.$queryRawUnsafe<
      { command: string; policy: string }[]
    >(
      'SELECT cmd AS command, policyname AS policy FROM pg_policies ' +
        "WHERE schemaname = 'public' AND tablename = 'contratos' " +
        'ORDER BY cmd',
    );
    const grants = await prisma.$queryRawUnsafe<{ canDelete: boolean }[]>(
      "SELECT has_table_privilege('" +
        role +
        "', 'public.contratos', 'DELETE') AS \"canDelete\"",
    );

    expect(table).toEqual({ rowSecurity: true, forceRowSecurity: true });
    expect(policies.map(({ command }) => command)).toEqual([
      'INSERT',
      'SELECT',
      'UPDATE',
    ]);
    expect(grants).toEqual([{ canDelete: false }]);
  });

  it('hides other tenants and requires context for contract reads', async () => {
    const withoutContext = await runAsRlsRole((tx) =>
      tx.contrato.findMany({ where: { id: { in: [contractA, contractB] } } }),
    );
    const listedA = await withTenant(tenantA, () =>
      service.findAll(tenantA, { page: 1, limit: 10 }),
    );
    const contractsForEmployeeA = await withTenant(tenantA, () =>
      service.findByEmployee(tenantA, employeeA),
    );

    expect(withoutContext).toEqual([]);
    expect(listedA.data.map(({ id }) => id)).toEqual([contractA]);
    expect(contractsForEmployeeA.map(({ id }) => id)).toEqual([contractA]);
    await expect(service.findByEmployee(tenantA, employeeA)).rejects.toThrow(
      'Se requiere un contexto de tenant válido.',
    );
  });

  it('allows tenant-scoped creation and updates while rejecting cross-tenant writes', async () => {
    const created = await withTenant(tenantA, () =>
      service.create(tenantA, randomUUID(), {
        employeeId: employeeA,
        cargo: 'Analista de prueba',
        salario: 2_500_000,
        tipo: ContratoTipo.TERMINO_FIJO,
        fechaInicio: '2028-01-01T00:00:00.000Z',
      }),
    );
    expect(created.tenantId).toBe(tenantA);

    const ownUpdate = await withTenant(tenantA, () =>
      tenantPrisma.execute((tx) =>
        tx.contrato.update({
          where: { id: contractA },
          data: { cargo: 'Cargo actualizado' },
        }),
      ),
    );
    const otherTenantUpdate = await withTenant(tenantA, () =>
      tenantPrisma.execute((tx) =>
        tx.contrato.updateMany({
          where: { id: contractB },
          data: { cargo: 'No debe modificarse' },
        }),
      ),
    );

    expect(ownUpdate.cargo).toBe('Cargo actualizado');
    expect(otherTenantUpdate.count).toBe(0);

    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.contrato.create({
            data: contractData(randomUUID(), tenantA, employeeB),
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.contrato.create({
            data: {
              ...contractData(randomUUID(), tenantA, employeeA),
              sedeId: siteB,
            },
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenant(tenantA, () =>
        tenantPrisma.execute((tx) =>
          tx.contrato.update({
            where: { id: contractA },
            data: { tenantId: tenantB },
          }),
        ),
      ),
    ).rejects.toThrow();
  }, 30000);

  function withTenant<T>(tenantId: string, work: () => Promise<T>) {
    return tenantContext.run(
      {
        tenantId,
        userId: 'contract-rls-test-user',
        rol: UserRole.ADMIN,
        email: 'contract-rls-test@example.test',
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
        '    REVOKE USAGE ON TYPE "ContratoTipo", "ContratoEstado" FROM "' +
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

  function tenantData(id: string, suffix: string) {
    return {
      id,
      nombre: `Tenant contract ${suffix}`,
      nit: `9000000${suffix}`,
      digitoVerif: '1',
      razonSocial: `Tenant contract ${suffix}`,
    };
  }

  function employeeData(id: string, tenantId: string, suffix: string) {
    return {
      id,
      tenantId,
      cedula: `contract-rls-${suffix}-${id}`,
      primerNombre: 'Empleado',
      primerApellido: 'Prueba',
      cargo: 'Analista',
      salario: 2_000_000,
      fechaIngreso: new Date('2025-01-01T00:00:00.000Z'),
    };
  }

  function contractData(id: string, tenantId: string, empleadoId: string) {
    return {
      id,
      tenantId,
      empleadoId,
      cargo: 'Cargo de prueba',
      salario: 2_000_000,
      tipo: ContratoTipo.TERMINO_FIJO,
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      anioContrato: 2026,
    };
  }
});
