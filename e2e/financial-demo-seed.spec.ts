import { randomInt, randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { seedFinancialDemoScenario } from '../apps/api/prisma/seed-financial-demo';

async function registerAndSignIn(page: Page) {
  const suffix = randomInt(10_000_000, 100_000_000).toString();
  const nit = `5${suffix}`;
  const email = `financial-demo-seed-${suffix}@example.test`;
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('DEMO Financiera Seed E2E');
  await page.getByLabel('Razón social').fill('DEMO Financiera Seed E2E S.A.S.');
  await page.getByLabel('Nombre administrador').fill('Laura');
  await page.getByLabel('Apellido').fill('Gómez');
  await page.getByLabel('Correo administrador').fill(email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);

  const registrationResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/auth/register' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear empresa' }).click();
  const registrationResponse = await registrationResponsePromise;
  expect(registrationResponse.status()).toBe(201);
  const registration = (await registrationResponse.json()) as {
    tenant: { id: string };
    user: { id: string };
  };

  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await page.getByLabel('NIT de la empresa').fill(nit);
  await page.getByLabel('Correo').fill(email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  return registration;
}

async function seedAsExplicitTarget(tenantId: string, actorId: string) {
  const previousTenantId = process.env.FINANCIAL_DEMO_SEED_TENANT_ID;
  process.env.FINANCIAL_DEMO_SEED_TENANT_ID = tenantId;
  try {
    return await seedFinancialDemoScenario(tenantId, actorId);
  } finally {
    if (previousTenantId === undefined) {
      delete process.env.FINANCIAL_DEMO_SEED_TENANT_ID;
    } else {
      process.env.FINANCIAL_DEMO_SEED_TENANT_ID = previousTenantId;
    }
  }
}

test('carga datos financieros de demo de forma tenant-scoped e idempotente', async ({ page }) => {
  const { tenant, user } = await registerAndSignIn(page);
  const { PrismaClient } = require('../apps/api/node_modules/@prisma/client') as {
    PrismaClient: new () => any;
  };
  const prisma = new PrismaClient();
  const otherTenantId = randomUUID();
  const otherTenantActorId = randomUUID();
  const isolationSuffix = randomInt(100_000_000, 999_999_999).toString();

  try {
    await prisma.$connect();
    const payrollVoucherType = await prisma.tipoComprobante.findUnique({
      where: { codigo: 'NOM' },
    });
    if (!payrollVoucherType) {
      await prisma.tipoComprobante.create({
        data: { codigo: 'NOM', nombre: 'Comprobante de nómina', prefijo: 'NOM' },
      });
    } else {
      expect(payrollVoucherType.activo).toBe(true);
    }
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        nombre: 'Tenant aislado',
        nit: isolationSuffix,
        digitoVerif: '1',
        razonSocial: 'Tenant aislado S.A.S.',
      },
    });
    await prisma.user.create({
      data: {
        id: otherTenantActorId,
        tenantId: otherTenantId,
        email: `financial-demo-isolated-${isolationSuffix}@example.test`,
        passwordHash: 'not-a-real-password-hash',
        nombre: 'Usuario',
        apellido: 'Aislado',
        rol: 'ADMIN',
      },
    });

    await expect(seedAsExplicitTarget(otherTenantId, otherTenantActorId)).rejects.toThrow(
      'El nombre del tenant debe identificarlo explícitamente',
    );

    const first = await seedAsExplicitTarget(tenant.id, user.id);
    expect(first.status).toBe('CAUSADA');
    expect(first.created).toMatchObject({
      customers: 2,
      products: 3,
      invoices: 3,
      invoiceItems: 4,
      employees: 1,
      thirdParties: 1,
      costCenters: 1,
      payrollPeriods: 1,
      payrollRuns: 1,
      payrollSnapshots: 1,
      accountMaps: 20,
    });

    const second = await seedAsExplicitTarget(tenant.id, user.id);
    expect(second.status).toBe('YA_CAUSADA');
    expect(second.comprobanteId).toBe(first.comprobanteId);
    expect(Object.values(second.created).every((count) => count === 0)).toBe(true);

    const targetData = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.id}, true)`;
      const [
        customers,
        products,
        invoices,
        employees,
        thirdParties,
        costCenters,
        periods,
        runs,
        snapshots,
        accountingPeriods,
        accounts,
        accountMaps,
        vouchers,
      ] = await Promise.all([
        tx.customer.findMany({ where: { tenantId: tenant.id } }),
        tx.productService.findMany({ where: { tenantId: tenant.id } }),
        tx.invoice.findMany({
          where: { tenantId: tenant.id },
          include: { items: true },
          orderBy: { numero: 'asc' },
        }),
        tx.empleado.findMany({ where: { tenantId: tenant.id } }),
        tx.tercero.findMany({ where: { tenantId: tenant.id } }),
        tx.centroCosto.findMany({ where: { tenantId: tenant.id } }),
        tx.payrollPeriod.findMany({ where: { tenantId: tenant.id } }),
        tx.payrollRun.findMany({ where: { tenantId: tenant.id } }),
        tx.payrollSnapshot.findMany({ where: { tenantId: tenant.id } }),
        tx.periodoContable.findMany({ where: { tenantId: tenant.id } }),
        tx.cuentaContable.findMany({ where: { tenantId: tenant.id } }),
        tx.cuentaSistemaMap.findMany({ where: { tenantId: tenant.id } }),
        tx.comprobanteContable.findMany({
          where: {
            tenantId: tenant.id,
            origenTipo: 'PAYROLL',
            origenId: first.payrollPeriodId,
            origenEvento: 'CAUSACION',
            estado: 'CONTABILIZADO',
          },
          include: {
            movimientos: { include: { cuenta: true } },
          },
        }),
      ]);
      return {
        customers,
        products,
        invoices,
        employees,
        thirdParties,
        costCenters,
        periods,
        runs,
        snapshots,
        accountingPeriods,
        accounts,
        accountMaps,
        vouchers,
      };
    });

    expect(targetData.customers).toHaveLength(2);
    expect(targetData.products).toHaveLength(3);
    expect(targetData.invoices).toHaveLength(3);
    expect(targetData.invoices.map((invoice: any) => invoice.status)).toEqual([
      'DRAFT',
      'DRAFT',
      'DRAFT',
    ]);
    expect(Number(targetData.invoices[0].subtotal)).toBe(240_000);
    expect(Number(targetData.invoices[0].impuestos)).toBe(45_600);
    expect(Number(targetData.invoices[0].total)).toBe(285_600);
    expect(Number(targetData.invoices[0].items[0].porcentajeImpuesto)).toBe(19);
    expect(Number(targetData.invoices[0].items[0].valorImpuesto)).toBe(45_600);
    expect(targetData.employees).toHaveLength(1);
    expect(targetData.thirdParties).toHaveLength(1);
    expect(targetData.thirdParties[0]).toMatchObject({
      numeroDocumento: 'DEMO-EMP-001',
      esEmpleado: true,
    });
    expect(targetData.costCenters).toHaveLength(1);
    expect(targetData.costCenters[0]).toMatchObject({ codigo: 'DEMO-NOMINA' });
    expect(targetData.periods).toHaveLength(1);
    expect(targetData.accountingPeriods.length).toBeGreaterThan(0);
    expect(targetData.accounts.length).toBeGreaterThan(0);
    expect(targetData.accountMaps).toHaveLength(20);
    expect(targetData.periods[0].status).toBe('CAUSADA');
    expect(targetData.runs).toHaveLength(1);
    expect(targetData.snapshots).toHaveLength(1);
    expect(targetData.snapshots[0].payload).toMatchObject({
      demo: { synthetic: true, operational: false },
    });
    expect(targetData.vouchers).toHaveLength(1);
    expect(Number(targetData.vouchers[0].totalDebito)).toBe(
      Number(targetData.vouchers[0].totalCredito),
    );
    expect(targetData.vouchers[0].id).toBe(first.comprobanteId);
    expect(
      targetData.vouchers[0].movimientos.find(
        (movement: any) => movement.cuenta.codigo === '250505',
      )?.terceroId,
    ).toBe(targetData.thirdParties[0].id);
    expect(
      targetData.vouchers[0].movimientos.find(
        (movement: any) => movement.cuenta.codigo === '510506',
      )?.centroCostoId,
    ).toBe(targetData.costCenters[0].id);

    const foreignTenantCounts = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${otherTenantId}, true)`;
      const [
        customers,
        products,
        invoices,
        employees,
        thirdParties,
        costCenters,
        periods,
        runs,
        snapshots,
        accountingPeriods,
        accounts,
        accountMaps,
        vouchers,
      ] = await Promise.all([
        tx.customer.count({ where: { tenantId: otherTenantId } }),
        tx.productService.count({ where: { tenantId: otherTenantId } }),
        tx.invoice.count({ where: { tenantId: otherTenantId } }),
        tx.empleado.count({ where: { tenantId: otherTenantId } }),
        tx.tercero.count({ where: { tenantId: otherTenantId } }),
        tx.centroCosto.count({ where: { tenantId: otherTenantId } }),
        tx.payrollPeriod.count({ where: { tenantId: otherTenantId } }),
        tx.payrollRun.count({ where: { tenantId: otherTenantId } }),
        tx.payrollSnapshot.count({ where: { tenantId: otherTenantId } }),
        tx.periodoContable.count({ where: { tenantId: otherTenantId } }),
        tx.cuentaContable.count({ where: { tenantId: otherTenantId } }),
        tx.cuentaSistemaMap.count({ where: { tenantId: otherTenantId } }),
        tx.comprobanteContable.count({ where: { tenantId: otherTenantId } }),
      ]);
      return {
        customers,
        products,
        invoices,
        employees,
        thirdParties,
        costCenters,
        periods,
        runs,
        snapshots,
        accountingPeriods,
        accounts,
        accountMaps,
        vouchers,
      };
    });
    expect(Object.values(foreignTenantCounts).every((count) => count === 0)).toBe(true);

    await page.goto('/facturacion/clientes');
    await expect(page.getByText('DEMO Colegio Horizonte', { exact: true })).toBeVisible();
    await page.goto('/facturacion/productos');
    await expect(page.getByText('DEMO Servicio de capacitación', { exact: true })).toBeVisible();
    await page.goto('/facturacion/facturas');
    await expect(page.getByRole('link', { name: /^DEMO-\d{4}-001$/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /^DEMO-\d{4}-003$/ })).toBeVisible();

    await page.goto(`/nomina/periodos/${first.payrollPeriodId}`);
    await expect(page.getByRole('heading', { name: /^DEMO Nómina / })).toBeVisible();
    await expect(page.getByText('Ana Demo Pérez')).toBeVisible();
    await expect(page.getByText('Contabilizado', { exact: true })).toBeVisible();
    await expect(page.getByText(`ID de comprobante: ${first.comprobanteId}`)).toBeVisible();
    await expect(page.getByText(/510506 · Sueldos/)).toBeVisible();
  } finally {
    await prisma.$disconnect();
  }
});
