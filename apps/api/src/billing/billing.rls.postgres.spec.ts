import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextBoundary } from '../tenant-context/tenant-context.boundary';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import {
  TenantPrismaClient,
  TenantPrismaService,
} from '../tenant-prisma/tenant-prisma.service';

describe('internal Billing PostgreSQL RLS', () => {
  const suffix = randomUUID();
  const role = `rls_billing_${suffix.replaceAll('-', '')}`;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const customerAId = randomUUID();
  const customerBId = randomUUID();
  const customerToDeleteId = randomUUID();
  const productAId = randomUUID();
  const productBId = randomUUID();
  const invoiceAId = randomUUID();
  const invoiceBId = randomUUID();
  const invoiceItemAId = randomUUID();
  const invoiceItemBId = randomUUID();
  const createdCustomerId = randomUUID();
  const createdInvoiceId = randomUUID();
  const createdInvoiceItemId = randomUUID();
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
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "customers", "product_services", "invoices", "invoice_items" TO "${role}"`,
    );

    await prisma.tenant.createMany({
      data: [
        tenantData(tenantA, `91${suffix.replaceAll('-', '').slice(0, 9)}`),
        tenantData(tenantB, `92${suffix.replaceAll('-', '').slice(0, 9)}`),
      ],
    });
    await prisma.customer.createMany({
      data: [
        {
          id: customerAId,
          tenantId: tenantA,
          razonSocial: 'Cliente RLS A',
          nit: `900A-${suffix}`,
        },
        {
          id: customerBId,
          tenantId: tenantB,
          razonSocial: 'Cliente RLS B',
          nit: `900B-${suffix}`,
        },
        {
          id: customerToDeleteId,
          tenantId: tenantA,
          razonSocial: 'Cliente RLS para borrar',
          nit: `900D-${suffix}`,
        },
      ],
    });
    await prisma.productService.createMany({
      data: [
        {
          id: productAId,
          tenantId: tenantA,
          nombre: `Producto A ${suffix}`,
          precio: 100,
        },
        {
          id: productBId,
          tenantId: tenantB,
          nombre: `Producto B ${suffix}`,
          precio: 200,
        },
      ],
    });
    await prisma.invoice.createMany({
      data: [
        invoiceData(invoiceAId, tenantA, customerAId, `A-${suffix}`),
        invoiceData(invoiceBId, tenantB, customerBId, `B-${suffix}`),
      ],
    });
    await prisma.invoiceItem.createMany({
      data: [
        invoiceItemData(invoiceItemAId, invoiceAId),
        invoiceItemData(invoiceItemBId, invoiceBId),
      ],
    });
  });

  afterAll(async () => {
    await prisma.invoiceItem.deleteMany({
      where: { invoiceId: { in: [invoiceAId, invoiceBId, createdInvoiceId] } },
    });
    await prisma.invoice.deleteMany({
      where: { id: { in: [invoiceAId, invoiceBId, createdInvoiceId] } },
    });
    await prisma.productService.deleteMany({
      where: { id: { in: [productAId, productBId] } },
    });
    await prisma.customer.deleteMany({
      where: {
        id: {
          in: [customerAId, customerBId, customerToDeleteId, createdCustomerId],
        },
      },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA, tenantB] } },
    });
    await dropTestRole();
    await prisma.$disconnect();
  });

  it('enables and forces RLS for all internal Billing tables', async () => {
    const protectedTables = await prisma.$queryRaw<{ tableName: string }[]>`
      SELECT relname AS "tableName" FROM pg_class
      WHERE relkind = 'r' AND relrowsecurity
    `;
    const forcedTables = await prisma.$queryRaw<{ tableName: string }[]>`
      SELECT relname AS "tableName" FROM pg_class
      WHERE relkind = 'r' AND relforcerowsecurity
    `;

    for (const tableName of [
      'customers',
      'product_services',
      'invoices',
      'invoice_items',
    ]) {
      expect(protectedTables).toContainEqual({ tableName });
      expect(forcedTables).toContainEqual({ tableName });
    }
  });

  it('isolates customers, products, invoices and invoice items by tenant', async () => {
    const readRows = (client: TenantPrismaClient) =>
      Promise.all([
        client.customer.findMany({
          where: { id: { in: [customerAId, customerBId] } },
          select: { id: true, tenantId: true },
        }),
        client.productService.findMany({
          where: { id: { in: [productAId, productBId] } },
          select: { id: true, tenantId: true },
        }),
        client.invoice.findMany({
          where: { id: { in: [invoiceAId, invoiceBId] } },
          select: { id: true, tenantId: true },
        }),
        client.invoiceItem.findMany({
          where: { id: { in: [invoiceItemAId, invoiceItemBId] } },
          select: { id: true, invoiceId: true },
        }),
      ]);
    const readForTenant = (tenantId: string) =>
      tenantContext.run(
        {
          tenantId,
          userId: 'billing-rls-test-user',
          rol: 'ADMIN',
          email: 'billing-rls-test@example.com',
        },
        () => tenantPrisma.execute(readRows),
      );

    const [rowsA, rowsB, rowsWithoutContext] = await Promise.all([
      readForTenant(tenantA),
      readForTenant(tenantB),
      runAsRlsRole(readRows),
    ]);

    expect(rowsA).toEqual([
      [{ id: customerAId, tenantId: tenantA }],
      [{ id: productAId, tenantId: tenantA }],
      [{ id: invoiceAId, tenantId: tenantA }],
      [{ id: invoiceItemAId, invoiceId: invoiceAId }],
    ]);
    expect(rowsB).toEqual([
      [{ id: customerBId, tenantId: tenantB }],
      [{ id: productBId, tenantId: tenantB }],
      [{ id: invoiceBId, tenantId: tenantB }],
      [{ id: invoiceItemBId, invoiceId: invoiceBId }],
    ]);
    expect(rowsWithoutContext.map((rows) => rows.length)).toEqual([0, 0, 0, 0]);
  });

  it('restricts customer, product and invoice writes to the active tenant', async () => {
    await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.customer.create({
          data: {
            id: createdCustomerId,
            tenantId: tenantA,
            razonSocial: 'Cliente creado en A',
            nit: `900C-${suffix}`,
          },
        }),
      ),
    );
    await expect(
      runForTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.customer.create({
            data: {
              tenantId: tenantB,
              razonSocial: 'Cliente cruzado',
              nit: `900X-${suffix}`,
            },
          }),
        ),
      ),
    ).rejects.toThrow();

    const ownCustomerUpdate = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.customer.updateMany({
          where: { id: customerAId },
          data: { status: 'INACTIVE' },
        }),
      ),
    );
    const crossTenantCustomerUpdate = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.customer.updateMany({
          where: { id: customerBId },
          data: { status: 'INACTIVE' },
        }),
      ),
    );
    await expect(
      runForTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.customer.update({
            where: { id: customerAId },
            data: { tenantId: tenantB },
          }),
        ),
      ),
    ).rejects.toThrow();
    expect(ownCustomerUpdate.count).toBe(1);
    expect(crossTenantCustomerUpdate.count).toBe(0);

    const createdProduct = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.productService.create({
          data: {
            tenantId: tenantA,
            nombre: `Producto nuevo ${suffix}`,
            precio: 300,
          },
        }),
      ),
    );
    const updatedProduct = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.productService.updateMany({
          where: { id: createdProduct.id },
          data: { activo: false },
        }),
      ),
    );
    expect(updatedProduct.count).toBe(1);

    await expect(
      runForTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.productService.create({
            data: {
              tenantId: tenantB,
              nombre: `Producto cruzado ${suffix}`,
              precio: 400,
            },
          }),
        ),
      ),
    ).rejects.toThrow();
    const productCrossUpdate = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.productService.updateMany({
          where: { id: productBId },
          data: { activo: false },
        }),
      ),
    );
    const productDelete = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.productService.deleteMany({ where: { id: createdProduct.id } }),
      ),
    );
    expect(productCrossUpdate.count).toBe(0);
    expect(productDelete.count).toBe(0);

    const createdInvoice = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.invoice.create({
          data: invoiceData(
            createdInvoiceId,
            tenantA,
            customerAId,
            `CREATED-${suffix}`,
          ),
        }),
      ),
    );
    expect(createdInvoice.tenantId).toBe(tenantA);

    await expect(
      runForTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.invoice.create({
            data: invoiceData(
              randomUUID(),
              tenantA,
              customerBId,
              `CROSS-CUSTOMER-${suffix}`,
            ),
          }),
        ),
      ),
    ).rejects.toThrow();

    const invoiceCrossUpdate = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.invoice.updateMany({
          where: { id: invoiceBId },
          data: { status: 'CANCELLED' },
        }),
      ),
    );
    expect(invoiceCrossUpdate.count).toBe(0);
    await expect(
      runForTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.invoice.update({
            where: { id: createdInvoiceId },
            data: { tenantId: tenantB },
          }),
        ),
      ),
    ).rejects.toThrow();
    const invoiceDelete = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.invoice.deleteMany({ where: { id: createdInvoiceId } }),
      ),
    );
    expect(invoiceDelete.count).toBe(0);
  });

  it('scopes immutable invoice items through their owning invoice', async () => {
    const createdItem = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.invoiceItem.create({
          data: invoiceItemData(createdInvoiceItemId, createdInvoiceId),
        }),
      ),
    );
    expect(createdItem.invoiceId).toBe(createdInvoiceId);

    await expect(
      runForTenant(tenantA, () =>
        tenantPrisma.execute((client) =>
          client.invoiceItem.create({
            data: invoiceItemData(randomUUID(), invoiceBId),
          }),
        ),
      ),
    ).rejects.toThrow();

    const crossTenantUpdate = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.invoiceItem.updateMany({
          where: { id: invoiceItemBId },
          data: { descripcion: 'No debe actualizarse desde A' },
        }),
      ),
    );
    const ownUpdate = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.invoiceItem.updateMany({
          where: { id: createdInvoiceItemId },
          data: { descripcion: 'Las líneas snapshot son inmutables' },
        }),
      ),
    );
    const ownDelete = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.invoiceItem.deleteMany({
          where: { id: createdInvoiceItemId },
        }),
      ),
    );
    expect(crossTenantUpdate.count).toBe(0);
    expect(ownUpdate.count).toBe(0);
    expect(ownDelete.count).toBe(0);
  });

  it('allows customer deletion only inside its tenant', async () => {
    const crossTenantDelete = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.customer.deleteMany({ where: { id: customerBId } }),
      ),
    );
    const ownDelete = await runForTenant(tenantA, () =>
      tenantPrisma.execute((client) =>
        client.customer.deleteMany({ where: { id: customerToDeleteId } }),
      ),
    );
    expect(crossTenantDelete.count).toBe(0);
    expect(ownDelete.count).toBe(1);
  });

  function runAsRlsRole<T>(
    work: (client: TenantPrismaClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (client) => {
      await client.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
      return work(client);
    });
  }

  function runForTenant<T>(
    tenantId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    return tenantContext.run(
      {
        tenantId,
        userId: 'billing-rls-test-user',
        rol: 'ADMIN',
        email: 'billing-rls-test@example.com',
      },
      work,
    );
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

  function invoiceData(
    id: string,
    tenantId: string,
    customerId: string,
    numero: string,
  ) {
    return {
      id,
      tenantId,
      customerId,
      numero,
      subtotal: 100,
      impuestos: 19,
      total: 119,
    };
  }

  function invoiceItemData(id: string, invoiceId: string) {
    return {
      id,
      invoiceId,
      descripcion: 'Línea de factura RLS',
      cantidad: 1,
      valorUnitario: 100,
      subtotal: 100,
      porcentajeImpuesto: 19,
      valorImpuesto: 19,
    };
  }
});
