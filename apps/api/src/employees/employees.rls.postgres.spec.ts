import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';
import { SocialSecurityAffiliationsService } from './social-security-affiliations.service';
import { EmployeesService } from './employees.service';

const TEST_ROLE = 'rls_empleados_test_role';

describe('empleados PostgreSQL RLS', () => {
  const suffix = randomUUID();
  const tenantA = `rls-empleados-a-${suffix}`;
  const tenantB = `rls-empleados-b-${suffix}`;
  const employeeA = `rls-empleado-a-${suffix}`;
  const employeeB = `rls-empleado-b-${suffix}`;
  const employeeToDelete = `rls-empleado-delete-${suffix}`;
  const affiliationA = `rls-afiliacion-a-${suffix}`;
  const affiliationB = `rls-afiliacion-b-${suffix}`;
  const municipalityId = randomUUID();
  const municipalityCode = `RLS-${suffix}`;
  const workLocationA = `rls-ubicacion-a-${suffix}`;
  const workLocationB = `rls-ubicacion-b-${suffix}`;
  const customerA = `rls-customer-a-${suffix}`;
  const customerB = `rls-customer-b-${suffix}`;
  const invoiceA = `rls-invoice-a-${suffix}`;
  const invoiceB = `rls-invoice-b-${suffix}`;
  const receiptA = `rls-receipt-a-${suffix}`;
  const receiptB = `rls-receipt-b-${suffix}`;
  const allocationA = `rls-allocation-a-${suffix}`;
  const allocationB = `rls-allocation-b-${suffix}`;
  const reversalA = `rls-reversal-a-${suffix}`;
  const reversalB = `rls-reversal-b-${suffix}`;
  const tenantContext = new TenantContextService();
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrismaService(
    { $transaction: runAsRlsRole } as unknown as PrismaService,
    new TenantContextBoundary(tenantContext),
  );
  const auditService = { log: jest.fn() } as unknown as AuditService;
  const affiliationsService = new SocialSecurityAffiliationsService(
    tenantPrisma,
    auditService,
  );
  const employeesService = new EmployeesService(
    tenantPrisma,
    auditService,
    affiliationsService,
  );

  beforeAll(async () => {
    await prisma.$connect();
    await dropTestRole();
    await prisma.$executeRawUnsafe(
      `CREATE ROLE "${TEST_ROLE}" NOLOGIN NOSUPERUSER NOBYPASSRLS`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT USAGE ON SCHEMA public TO "${TEST_ROLE}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "empleados" TO "${TEST_ROLE}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "afiliaciones_seguridad_social" TO "${TEST_ROLE}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "pila_ubicaciones_laborales" TO "${TEST_ROLE}"`,
    );
    await prisma.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "customer_receipts", "invoice_receipt_allocations", "customer_receipt_reversals" TO "${TEST_ROLE}"`,
    );

    await prisma.tenant.createMany({
      data: [
        tenantData(tenantA, `900${suffix.slice(0, 8)}`),
        tenantData(tenantB, `901${suffix.slice(0, 8)}`),
      ],
    });
    await prisma.empleado.createMany({
      data: [
        employeeData(employeeA, tenantA, '1001'),
        employeeData(employeeB, tenantB, '2001'),
        employeeData(employeeToDelete, tenantA, '1002'),
      ],
    });
    await prisma.afiliacionSeguridadSocial.createMany({
      data: [
        affiliationData(affiliationA, tenantA, employeeA),
        affiliationData(affiliationB, tenantB, employeeB),
      ],
    });
    await prisma.municipioDane.create({
      data: {
        id: municipalityId,
        codigo: municipalityCode,
        nombre: 'Municipio RLS',
        departamento: 'Pruebas',
      },
    });
    await prisma.pilaUbicacionLaboral.createMany({
      data: [
        workLocationData(workLocationA, tenantA, employeeA),
        workLocationData(workLocationB, tenantB, employeeB),
      ],
    });
    await prisma.customer.createMany({
      data: [
        {
          id: customerA,
          tenantId: tenantA,
          razonSocial: 'Cliente RLS A',
          nit: `900${suffix}`,
        },
        {
          id: customerB,
          tenantId: tenantB,
          razonSocial: 'Cliente RLS B',
          nit: `901${suffix}`,
        },
      ],
    });
    await prisma.invoice.createMany({
      data: [
        {
          id: invoiceA,
          tenantId: tenantA,
          customerId: customerA,
          numero: `RLS-A-${suffix}`,
          subtotal: 100,
          impuestos: 0,
          total: 100,
          status: 'ISSUED',
        },
        {
          id: invoiceB,
          tenantId: tenantB,
          customerId: customerB,
          numero: `RLS-B-${suffix}`,
          subtotal: 100,
          impuestos: 0,
          total: 100,
          status: 'ISSUED',
        },
      ],
    });
    await prisma.customerReceipt.createMany({
      data: [
        receiptData(receiptA, tenantA, customerA),
        receiptData(receiptB, tenantB, customerB),
      ],
    });
    await prisma.invoiceReceiptAllocation.createMany({
      data: [
        allocationData(allocationA, tenantA, receiptA, invoiceA),
        allocationData(allocationB, tenantB, receiptB, invoiceB),
      ],
    });
    await prisma.customerReceiptReversal.createMany({
      data: [
        reversalData(reversalA, tenantA, receiptA),
        reversalData(reversalB, tenantB, receiptB),
      ],
    });
  });

  afterAll(async () => {
    await prisma.customerReceiptReversal.deleteMany({
      where: { id: { in: [reversalA, reversalB] } },
    });
    await prisma.invoiceReceiptAllocation.deleteMany({
      where: { id: { in: [allocationA, allocationB] } },
    });
    await prisma.customerReceipt.deleteMany({
      where: { id: { in: [receiptA, receiptB] } },
    });
    await prisma.invoice.deleteMany({
      where: { id: { in: [invoiceA, invoiceB] } },
    });
    await prisma.customer.deleteMany({
      where: { id: { in: [customerA, customerB] } },
    });
    await prisma.pilaUbicacionLaboral.deleteMany({
      where: { id: { in: [workLocationA, workLocationB] } },
    });
    await prisma.municipioDane.deleteMany({ where: { id: municipalityId } });
    await prisma.afiliacionSeguridadSocial.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await prisma.empleado.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA, tenantB] } },
    });
    await dropTestRole();
    await prisma.$disconnect();
  });

  it('enables and forces RLS for tenant-scoped tables', async () => {
    const protectedTables = await prisma.$queryRaw<{ tableName: string }[]>`
      SELECT relname AS "tableName"
      FROM pg_class
      WHERE relkind = 'r' AND relrowsecurity
      ORDER BY relname COLLATE "C"
    `;
    const forcedTables = await prisma.$queryRaw<{ tableName: string }[]>`
      SELECT relname AS "tableName"
      FROM pg_class
      WHERE relkind = 'r' AND relforcerowsecurity
      ORDER BY relname COLLATE "C"
    `;

    const expectedTenantTables = [
      { tableName: 'afiliaciones_seguridad_social' },
      { tableName: 'centros_costo' },
      { tableName: 'comprobantes_contables' },
      { tableName: 'customer_receipt_reversals' },
      { tableName: 'customer_receipts' },
      { tableName: 'cuenta_sistema_map' },
      { tableName: 'cuentas_contables' },
      { tableName: 'empleados' },
      { tableName: 'facturas_electronicas' },
      { tableName: 'intentos_facturas_electronicas' },
      { tableName: 'invoice_receipt_allocations' },
      { tableName: 'lineas_facturas_electronicas' },
      { tableName: 'movimientos_contables' },
      { tableName: 'perfiles_emisor_electronicos' },
      { tableName: 'periodos_contables' },
      { tableName: 'pila_asignaciones_centro_trabajo' },
      { tableName: 'pila_centros_trabajo' },
      { tableName: 'pila_exports' },
      { tableName: 'pila_ubicaciones_laborales' },
      { tableName: 'rangos_numeracion_electronica' },
      { tableName: 'resultados_intentos_facturas_electronicas' },
      { tableName: 'secuencias_comprobante' },
      { tableName: 'service_premium_batches' },
      { tableName: 'service_premium_lines' },
      { tableName: 'terceros' },
      { tableName: 'transiciones_facturas_electronicas' },
      { tableName: 'transmisiones_facturas_electronicas' },
    ];
    expect(protectedTables).toEqual(expectedTenantTables);
    expect(forcedTables).toEqual(expectedTenantTables);
  });

  it('isolates receipts, invoice allocations, and reversals by tenant', async () => {
    const readFinancialRows = (client: TenantPrismaClient) =>
      Promise.all([
        client.customerReceipt.findMany({
          where: { id: { in: [receiptA, receiptB] } },
        }),
        client.invoiceReceiptAllocation.findMany({
          where: { id: { in: [allocationA, allocationB] } },
        }),
        client.customerReceiptReversal.findMany({
          where: { id: { in: [reversalA, reversalB] } },
        }),
      ]);
    const readForTenant = (tenantId: string) =>
      runAsTenant(tenantId, () => tenantPrisma.execute(readFinancialRows));

    const [tenantAResults, tenantBResults, noTenantResults] = await Promise.all(
      [
        readForTenant(tenantA),
        readForTenant(tenantB),
        runAsRlsRole(readFinancialRows),
      ],
    );

    expect(
      tenantAResults.map((rows) => rows.map(({ tenantId }) => tenantId)),
    ).toEqual([[tenantA], [tenantA], [tenantA]]);
    expect(
      tenantBResults.map((rows) => rows.map(({ tenantId }) => tenantId)),
    ).toEqual([[tenantB], [tenantB], [tenantB]]);
    expect(noTenantResults.map((rows) => rows.length)).toEqual([0, 0, 0]);
  });

  it('allows each tenant to read only its own security affiliation history', async () => {
    const tenantAAffiliations = await runAsTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.afiliacionSeguridadSocial.findMany({
          where: { id: { in: [affiliationA, affiliationB] } },
        }),
      ),
    );
    const tenantBAffiliations = await runAsTenant(tenantB, () =>
      tenantPrisma.execute((client) =>
        client.afiliacionSeguridadSocial.findMany({
          where: { id: { in: [affiliationA, affiliationB] } },
        }),
      ),
    );

    expect(tenantAAffiliations.map(({ id }) => id)).toEqual([affiliationA]);
    expect(tenantBAffiliations.map(({ id }) => id)).toEqual([affiliationB]);
  });

  it('isolates PILA work locations by active tenant and rejects cross-tenant inserts', async () => {
    const tenantALocations = await runAsTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.pilaUbicacionLaboral.findMany({
          where: { id: { in: [workLocationA, workLocationB] } },
        }),
      ),
    );
    const tenantBLocations = await runAsTenant(tenantB, () =>
      tenantPrisma.execute((client) =>
        client.pilaUbicacionLaboral.findMany({
          where: { id: { in: [workLocationA, workLocationB] } },
        }),
      ),
    );

    expect(tenantALocations.map(({ id }) => id)).toEqual([workLocationA]);
    expect(tenantBLocations.map(({ id }) => id)).toEqual([workLocationB]);

    const crossTenantLocationId = randomUUID();
    await expect(
      runAsTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.pilaUbicacionLaboral.create({
            data: workLocationData(crossTenantLocationId, tenantB, employeeB),
          }),
        ),
      ),
    ).rejects.toBeDefined();
    await expect(
      prisma.pilaUbicacionLaboral.findUnique({
        where: { id: crossTenantLocationId },
      }),
    ).resolves.toBeNull();
  });

  it('returns no PILA work locations without a tenant context', async () => {
    const locations = await runAsRlsRole((client) =>
      client.pilaUbicacionLaboral.findMany({
        where: { id: { in: [workLocationA, workLocationB] } },
      }),
    );

    expect(locations).toEqual([]);
  });

  it('allows each tenant to read only its own employees', async () => {
    const tenantAEmployees = await runAsTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.empleado.findMany({
          where: { id: { in: [employeeA, employeeB] } },
          orderBy: { id: 'asc' },
        }),
      ),
    );
    const tenantBEmployees = await runAsTenant(tenantB, () =>
      tenantPrisma.execute((client) =>
        client.empleado.findMany({
          where: { id: { in: [employeeA, employeeB] } },
          orderBy: { id: 'asc' },
        }),
      ),
    );

    expect(tenantAEmployees.map(({ id }) => id)).toEqual([employeeA]);
    expect(tenantBEmployees.map(({ id }) => id)).toEqual([employeeB]);
  });

  it('returns no employees without a tenant context', async () => {
    const employees = await runAsRlsRole((client) =>
      client.empleado.findMany({
        where: { id: { in: [employeeA, employeeB] } },
      }),
    );

    expect(employees).toEqual([]);
  });

  it('allows inserts only for the active tenant', async () => {
    const ownEmployee = await runAsTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.empleado.create({
          data: employeeData(`rls-empleado-insert-${suffix}`, tenantA, '1003'),
        }),
      ),
    );

    await expect(
      runAsTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.empleado.create({
            data: employeeData(
              `rls-empleado-cross-insert-${suffix}`,
              tenantB,
              '2002',
            ),
          }),
        ),
      ),
    ).rejects.toThrow();

    expect(ownEmployee.tenantId).toBe(tenantA);
  });

  it('allows updates only for the active tenant', async () => {
    const ownUpdate = await runAsTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.empleado.updateMany({
          where: { id: employeeA },
          data: { cargo: 'Cargo actualizado por tenant A' },
        }),
      ),
    );
    const crossTenantUpdate = await runAsTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.empleado.updateMany({
          where: { id: employeeB },
          data: { cargo: 'No debe actualizarse' },
        }),
      ),
    );

    await expect(
      runAsTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.empleado.update({
            where: { id: employeeA },
            data: { tenantId: tenantB },
          }),
        ),
      ),
    ).rejects.toThrow();

    expect(ownUpdate.count).toBe(1);
    expect(crossTenantUpdate.count).toBe(0);
    await expect(
      prisma.empleado.findUnique({ where: { id: employeeB } }),
    ).resolves.toMatchObject({
      cargo: 'Cargo base',
      tenantId: tenantB,
    });
  });

  it('allows deletes only for the active tenant', async () => {
    const crossTenantDelete = await runAsTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.empleado.deleteMany({ where: { id: employeeB } }),
      ),
    );
    const ownDelete = await runAsTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.empleado.deleteMany({ where: { id: employeeToDelete } }),
      ),
    );

    expect(crossTenantDelete.count).toBe(0);
    expect(ownDelete.count).toBe(1);
    await expect(
      prisma.empleado.findUnique({ where: { id: employeeToDelete } }),
    ).resolves.toBeNull();
  });

  it('preserves the existing tenantId filter and observable employee service result', async () => {
    const result = await runAsTenant(tenantA, () =>
      employeesService.findAll({ page: 1, limit: 20 }),
    );

    expect(result.data.map(({ tenantId }) => tenantId)).toEqual([
      tenantA,
      tenantA,
    ]);
    expect(result.meta).toMatchObject({ total: 2, page: 1, limit: 20 });
  });

  function runAsRlsRole<T>(
    work: (client: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (client) => {
      await client.$executeRawUnsafe(`SET LOCAL ROLE "${TEST_ROLE}"`);
      return work(client);
    });
  }

  async function dropTestRole(): Promise<void> {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${TEST_ROLE}') THEN
          REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "${TEST_ROLE}";
          REVOKE ALL PRIVILEGES ON SCHEMA public FROM "${TEST_ROLE}";
          DROP ROLE "${TEST_ROLE}";
        END IF;
      END
      $$
    `);
  }

  function runAsTenant<T>(
    tenantId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    return tenantContext.run(
      {
        tenantId,
        userId: 'rls-empleados-test-user',
        rol: 'ADMIN',
        email: 'rls-empleados-test@example.com',
      },
      work,
    );
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

  function employeeData(id: string, tenantId: string, cedula: string) {
    return {
      id,
      tenantId,
      cedula: `${cedula}-${suffix}`,
      primerNombre: 'Empleado',
      primerApellido: 'RLS',
      cargo: 'Cargo base',
      salario: 1_000_000,
      fechaIngreso: new Date('2026-01-01T00:00:00.000Z'),
    };
  }

  function workLocationData(id: string, tenantId: string, empleadoId: string) {
    return {
      id,
      tenantId,
      empleadoId,
      municipioId: municipalityId,
      vigenteDesde: new Date('2026-01-01T00:00:00.000Z'),
      vigenteHasta: null,
      registradoPorId: 'rls-empleados-test-user',
    };
  }

  function receiptData(id: string, tenantId: string, customerId: string) {
    return {
      id,
      tenantId,
      customerId,
      fechaRecibo: new Date('2026-01-01T00:00:00.000Z'),
      medio: 'EFECTIVO' as const,
      monto: 100,
      idempotencyKey: randomUUID(),
      requestHash: 'f'.repeat(64),
      registradoPorId: 'rls-empleados-test-user',
    };
  }

  function allocationData(
    id: string,
    tenantId: string,
    receiptId: string,
    invoiceId: string,
  ) {
    return { id, tenantId, receiptId, invoiceId, amount: 100 };
  }

  function reversalData(id: string, tenantId: string, receiptId: string) {
    return {
      id,
      tenantId,
      receiptId,
      reason: 'Reversión de prueba RLS',
      reversedById: 'rls-empleados-test-user',
      originalVoucherId: randomUUID(),
      reversalVoucherId: randomUUID(),
    };
  }

  function affiliationData(id: string, tenantId: string, empleadoId: string) {
    return {
      id,
      tenantId,
      empleadoId,
      tipoCotizanteCodigo: '01',
      subtipoCotizanteCodigo: null,
      epsCodigo: 'EPS001',
      epsNombre: 'EPS de prueba',
      fondoPensionCodigo: 'AFP001',
      fondoPensionNombre: 'Fondo de prueba',
      arlCodigo: 'ARL001',
      arlNombre: 'ARL de prueba',
      arlClaseRiesgo: '1',
      cajaCompensacionCodigo: 'CCF001',
      cajaCompensacionNombre: 'Caja de prueba',
      cajaCompensacionDepartamentoCodigo: '08',
      vigenteDesde: new Date('2026-01-01T00:00:00.000Z'),
      vigenteHasta: null,
      versionCaptura: 'PILA_AFFILIATION_CAPTURE_V1',
      registradoPorId: 'rls-empleados-test-user',
    };
  }
});
