import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { randomInt, randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

function colombiaCalendarDate(value: Date | string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    calendar: 'gregory',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: 'year' | 'month' | 'day') =>
    parts.find((entry) => entry.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function utcCalendarDate(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

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
  const apiDirectory = resolve(process.cwd(), 'apps/api');
  const apiRequire = createRequire(resolve(apiDirectory, 'package.json'));
  const tsNodeCli = apiRequire.resolve('ts-node/dist/bin.js');
  const runner = `
    const { seedFinancialDemoScenario } = require('./prisma/seed-financial-demo');
    seedFinancialDemoScenario(${JSON.stringify(tenantId)}, ${JSON.stringify(actorId)})
      .then((result: unknown) => console.log('FINANCIAL_DEMO_SEED_RESULT=' + JSON.stringify(result)))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.log('FINANCIAL_DEMO_SEED_ERROR=' + message);
        process.exitCode = 1;
      });
  `;
  let stdout: string;
  try {
    stdout = execFileSync(
      process.execPath,
      [tsNodeCli, '--project', 'tsconfig.json', '-r', 'tsconfig-paths/register', '-e', runner],
      {
        cwd: apiDirectory,
        env: {
          ...process.env,
          FINANCIAL_DEMO_SEED_TENANT_ID: tenantId,
        },
        encoding: 'utf8',
      },
    );
  } catch (error) {
    const output =
      typeof error === 'object' && error !== null
        ? [
            'stdout' in error ? String(error.stdout) : '',
            'stderr' in error ? String(error.stderr) : '',
          ].join('\n')
        : String(error);
    const errorLine = output
      .split(/\r?\n/)
      .find((line) => line.startsWith('FINANCIAL_DEMO_SEED_ERROR='));
    throw new Error(errorLine?.slice('FINANCIAL_DEMO_SEED_ERROR='.length) || output.trim());
  }
  const resultLine = stdout
    .split(/\r?\n/)
    .find((line) => line.startsWith('FINANCIAL_DEMO_SEED_RESULT='));
  if (!resultLine) {
    throw new Error('El proceso del seed no devolvió un resultado JSON.');
  }
  return JSON.parse(resultLine.slice('FINANCIAL_DEMO_SEED_RESULT='.length));
}

test('carga datos financieros de demo de forma tenant-scoped e idempotente', async ({ page }) => {
  test.setTimeout(90_000);
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
    for (const voucherType of [
      { codigo: 'NOM', nombre: 'Comprobante de nómina', prefijo: 'NOM' },
      { codigo: 'FV', nombre: 'Factura de venta', prefijo: 'FV' },
      { codigo: 'CI', nombre: 'Comprobante de ingreso', prefijo: 'CI' },
    ]) {
      const existingVoucherType = await prisma.tipoComprobante.findUnique({
        where: { codigo: voucherType.codigo },
      });
      if (!existingVoucherType) {
        await prisma.tipoComprobante.create({ data: voucherType });
      } else {
        expect(existingVoucherType.activo).toBe(true);
      }
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
      invoices: 4,
      invoiceItems: 5,
      employees: 1,
      thirdParties: 3,
      costCenters: 1,
      payrollPeriods: 1,
      payrollRuns: 1,
      payrollSnapshots: 1,
      accountMaps: 24,
      receipts: 2,
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
        receipts,
        receiptVouchers,
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
        invoiceVouchers,
      ] = await Promise.all([
        tx.customer.findMany({
          where: { tenantId: tenant.id },
          include: { tercero: true },
        }),
        tx.productService.findMany({ where: { tenantId: tenant.id } }),
        tx.invoice.findMany({
          where: { tenantId: tenant.id },
          include: { items: true },
          orderBy: { numero: 'asc' },
        }),
        tx.customerReceipt.findMany({
          where: { tenantId: tenant.id },
          include: { aplicaciones: true, reversal: true },
          orderBy: { referencia: 'asc' },
        }),
        tx.comprobanteContable.findMany({
          where: {
            tenantId: tenant.id,
            origenTipo: 'BILLING_RECEIPT',
            origenEvento: 'POSTED',
            estado: 'CONTABILIZADO',
          },
          include: { movimientos: { include: { cuenta: true } } },
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
        tx.comprobanteContable.findMany({
          where: {
            tenantId: tenant.id,
            origenTipo: 'BILLING_INVOICE',
            origenEvento: 'ISSUED',
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
        receipts,
        receiptVouchers,
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
        invoiceVouchers,
      };
    });

    expect(targetData.customers).toHaveLength(2);
    expect(targetData.products).toHaveLength(3);
    expect(targetData.invoices).toHaveLength(4);
    expect(targetData.invoices.map((invoice: any) => invoice.status)).toEqual([
      'ISSUED',
      'ISSUED',
      'DRAFT',
      'ISSUED',
    ]);
    expect(Number(targetData.invoices[0].subtotal)).toBe(240_000);
    expect(Number(targetData.invoices[0].impuestos)).toBe(45_600);
    expect(Number(targetData.invoices[0].total)).toBe(285_600);
    expect(Number(targetData.invoices[0].items[0].porcentajeImpuesto)).toBe(19);
    expect(Number(targetData.invoices[0].items[0].valorImpuesto)).toBe(45_600);
    expect(targetData.receipts).toHaveLength(2);
    const singleInvoiceReceipt = targetData.receipts.find(
      (receipt: any) => receipt.referencia === 'DEMO-TRX-001',
    );
    const multiInvoiceReceipt = targetData.receipts.find(
      (receipt: any) => receipt.referencia === 'DEMO-TRX-002',
    );
    expect(singleInvoiceReceipt).toBeDefined();
    expect(Number(singleInvoiceReceipt.monto)).toBe(100_000);
    expect(singleInvoiceReceipt.medio).toBe('TRANSFERENCIA');
    expect(singleInvoiceReceipt.reversal).toBeNull();
    expect(singleInvoiceReceipt.aplicaciones).toHaveLength(1);
    expect(Number(singleInvoiceReceipt.aplicaciones[0].amount)).toBe(100_000);
    expect(singleInvoiceReceipt.aplicaciones[0].invoiceId).toBe(targetData.invoices[0].id);
    expect(multiInvoiceReceipt).toBeDefined();
    expect(Number(multiInvoiceReceipt.monto)).toBe(150_000);
    expect(multiInvoiceReceipt.reversal).toBeNull();
    expect(multiInvoiceReceipt.aplicaciones).toHaveLength(2);
    const invoice001 = targetData.invoices.find((invoice: any) => invoice.numero.endsWith('-001'));
    const invoice004 = targetData.invoices.find((invoice: any) => invoice.numero.endsWith('-004'));
    expect(invoice001.customerId).toBe(invoice004.customerId);
    expect(
      multiInvoiceReceipt.aplicaciones.map((application: any) => ({
        invoiceId: application.invoiceId,
        amount: Number(application.amount),
      })),
    ).toEqual(
      expect.arrayContaining([
        { invoiceId: invoice001.id, amount: 80_000 },
        { invoiceId: invoice004.id, amount: 70_000 },
      ]),
    );
    expect(targetData.receiptVouchers).toHaveLength(2);
    const multiInvoiceReceiptVoucher = targetData.receiptVouchers.find(
      (voucher: any) => voucher.origenId === multiInvoiceReceipt.id,
    );
    expect(multiInvoiceReceiptVoucher).toBeDefined();
    expect(Number(multiInvoiceReceiptVoucher.totalDebito)).toBe(150_000);
    expect(Number(multiInvoiceReceiptVoucher.totalCredito)).toBe(150_000);
    expect(
      multiInvoiceReceiptVoucher.movimientos.some(
        (movement: any) =>
          movement.cuenta.codigo === '111005' && Number(movement.debito) === 150_000,
      ),
    ).toBe(true);
    expect(
      multiInvoiceReceiptVoucher.movimientos
        .filter((movement: any) => movement.cuenta.codigo === '130505')
        .reduce((sum: number, movement: any) => sum + Number(movement.credito), 0),
    ).toBe(150_000);
    const customerHorizonte = targetData.customers.find(
      (customer: any) => customer.id === invoice001.customerId,
    );
    expect(
      multiInvoiceReceiptVoucher.movimientos
        .filter((movement: any) => movement.cuenta.codigo === '130505')
        .every((movement: any) => movement.terceroId === customerHorizonte.terceroId),
    ).toBe(true);
    const singleInvoiceReceiptVoucher = targetData.receiptVouchers.find(
      (voucher: any) => voucher.origenId === singleInvoiceReceipt.id,
    );
    expect(Number(singleInvoiceReceiptVoucher.totalDebito)).toBe(100_000);
    expect(Number(singleInvoiceReceiptVoucher.totalCredito)).toBe(100_000);
    expect(targetData.employees).toHaveLength(1);
    expect(
      targetData.customers.every(
        (customer: any) =>
          customer.terceroId === customer.tercero?.id &&
          customer.tercero?.tenantId === tenant.id &&
          customer.tercero?.tipoDocumento === 'NIT' &&
          customer.tercero?.numeroDocumento === customer.nit &&
          customer.tercero?.esCliente === true &&
          customer.tercero?.activo === true,
      ),
    ).toBe(true);
    expect(targetData.thirdParties).toHaveLength(3);
    const payrollThirdParty = targetData.thirdParties.find(
      (thirdParty: any) => thirdParty.esEmpleado,
    );
    expect(payrollThirdParty).toMatchObject({
      numeroDocumento: 'DEMO-EMP-001',
      esEmpleado: true,
    });
    expect(targetData.thirdParties.filter((thirdParty: any) => thirdParty.esCliente)).toHaveLength(
      2,
    );
    expect(targetData.costCenters).toHaveLength(1);
    expect(targetData.costCenters[0]).toMatchObject({ codigo: 'DEMO-NOMINA' });
    expect(targetData.periods).toHaveLength(1);
    expect(targetData.accountingPeriods.length).toBeGreaterThan(0);
    expect(targetData.accounts.length).toBeGreaterThan(0);
    expect(targetData.accountMaps).toHaveLength(24);
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
    ).toBe(payrollThirdParty.id);
    expect(
      targetData.vouchers[0].movimientos.find(
        (movement: any) => movement.cuenta.codigo === '510506',
      )?.centroCostoId,
    ).toBe(targetData.costCenters[0].id);

    expect(targetData.invoiceVouchers).toHaveLength(3);
    const issuedInvoiceIds = targetData.invoices
      .filter((invoice: any) => invoice.status === 'ISSUED')
      .map((invoice: any) => invoice.id)
      .sort();
    expect(targetData.invoiceVouchers.map((voucher: any) => voucher.origenId).sort()).toEqual(
      issuedInvoiceIds,
    );
    for (const invoiceVoucher of targetData.invoiceVouchers) {
      expect(Number(invoiceVoucher.totalDebito)).toBe(Number(invoiceVoucher.totalCredito));
      const invoice = targetData.invoices.find((row: any) => row.id === invoiceVoucher.origenId);
      const customer = targetData.customers.find((row: any) => row.id === invoice.customerId);
      expect(colombiaCalendarDate(invoice.fechaEmision)).toBe(
        utcCalendarDate(invoiceVoucher.fecha),
      );
      expect(
        invoiceVoucher.movimientos.some(
          (movement: any) =>
            movement.cuenta.codigo === '130505' && movement.terceroId === customer.terceroId,
        ),
      ).toBe(true);
      expect(
        invoiceVoucher.movimientos.some((movement: any) => movement.cuenta.codigo === '413505'),
      ).toBe(true);
      expect(
        invoiceVoucher.movimientos.some((movement: any) => movement.cuenta.codigo === '240805'),
      ).toBe(true);
    }

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
        receipts,
        receiptAllocations,
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
        tx.customerReceipt.count({ where: { tenantId: otherTenantId } }),
        tx.invoiceReceiptAllocation.count({ where: { tenantId: otherTenantId } }),
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
        receipts,
        receiptAllocations,
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
    await expect(page.getByRole('link', { name: /^DEMO-\d{4}-004$/ })).toBeVisible();
    await page.getByRole('link', { name: /^DEMO-\d{4}-001$/ }).click();
    const invoiceAccounting = page.locator('section').filter({
      hasText: 'Contabilización interna',
    });
    await expect(invoiceAccounting.getByText(/· CONTABILIZADO/)).toBeVisible();
    const receivables = page.getByRole('region', { name: 'Cartera y recaudos' });
    await expect(receivables.locator('strong').nth(0)).toContainText('180.000');
    await expect(receivables.locator('strong').nth(1)).toContainText('105.600');
    await expect(
      receivables.getByText('Ref. DEMO-TRX-001 · Comprobante', { exact: false }),
    ).toBeVisible();
    await expect(receivables.getByText(/Ref\. DEMO-TRX-002.*2 facturas/)).toBeVisible();

    await page.goto('/facturacion/facturas');
    await page.getByRole('link', { name: /^DEMO-\d{4}-004$/ }).click();
    const secondInvoiceReceivables = page.getByRole('region', { name: 'Cartera y recaudos' });
    await expect(secondInvoiceReceivables.locator('strong').nth(0)).toContainText('70.000');
    await expect(secondInvoiceReceivables.locator('strong').nth(1)).toContainText('227.500');
    await expect(
      secondInvoiceReceivables.getByText(/Ref\. DEMO-TRX-002.*2 facturas/),
    ).toBeVisible();

    await page.goto(`/nomina/periodos/${first.payrollPeriodId}`);
    await expect(page.getByRole('heading', { name: /^DEMO Nómina / })).toBeVisible();
    await expect(page.getByText('Ana Demo Pérez', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('Contabilizado', { exact: true })).toBeVisible();
    await expect(page.getByText(`ID de comprobante: ${first.comprobanteId}`)).toBeVisible();
    await expect(page.getByText(/510506 · Sueldos/)).toBeVisible();
  } finally {
    await prisma.$disconnect();
  }
});
