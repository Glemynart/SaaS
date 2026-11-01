import { randomInt } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { seedPayrollAccrualFixture } from './helpers/payroll-accounting-fixture';
import { seedBillingLedgerFixture } from './helpers/billing-ledger-fixture';

async function registerAndSignIn(page: Page, suffix: string) {
  const nit = `5${suffix}`;
  const email = `financial-demo-${suffix}@example.test`;
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('Demo Financiera E2E');
  await page.getByLabel('Razón social').fill('Demo Financiera E2E S.A.S.');
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

test('muestra facturación y nómina contabilizada en el mismo tenant de demo', async ({ page }) => {
  const suffix = randomInt(10_000_000, 100_000_000).toString();
  const customerName = `Cliente Demo Financiero ${suffix}`;
  const customerNit = `9${suffix}`;
  const productName = `Servicio Demo Financiero ${suffix}`;
  const invoiceNumber = `DEMO-FIN-${suffix}`;
  const { tenant, user } = await registerAndSignIn(page, suffix);
  const billingFixture = await seedBillingLedgerFixture(tenant.id, customerNit, customerName);

  await page.goto('/facturacion/clientes');
  await page.getByRole('button', { name: 'Nuevo' }).click();
  const customerInputs = page.locator('input');
  await customerInputs.nth(0).fill(customerName);
  await customerInputs.nth(1).fill(customerNit);
  await customerInputs.nth(2).fill(`cliente-${suffix}@example.test`);
  await page.locator('select').selectOption({
    label: `${customerName} — NIT ${customerNit}`,
  });
  const createCustomerResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/billing/customers' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  expect((await createCustomerResponsePromise).status()).toBe(200);
  await expect(page.getByText(customerName, { exact: true })).toBeVisible();

  await page.goto('/facturacion/productos');
  await page.getByRole('button', { name: 'Nuevo' }).click();
  const productInputs = page.locator('input');
  await productInputs.nth(0).fill(productName);
  await productInputs.nth(1).fill('120000');
  await page.locator('select').selectOption('19');
  const createProductResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/billing/products' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  expect((await createProductResponsePromise).status()).toBe(200);
  await expect(page.getByText(productName, { exact: true })).toBeVisible();

  await page.goto('/facturacion/facturas');
  await page.getByRole('button', { name: 'Nueva' }).click();
  await page.locator('select').nth(0).selectOption({ label: customerName });
  await page.getByPlaceholder('FAC-001').fill(invoiceNumber);
  await page.locator('select').nth(1).selectOption({ label: productName });
  await page.getByPlaceholder('Cant').fill('1');
  // Re-enter the selected price to exercise the editable line-value field.
  await page.getByPlaceholder('V. Unit').fill('120000');

  const createInvoiceResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/billing/invoices' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear factura' }).click();
  const createInvoiceResponse = await createInvoiceResponsePromise;
  const invoiceBody = await createInvoiceResponse.text();
  expect(createInvoiceResponse.status(), invoiceBody).toBe(200);
  const invoice = JSON.parse(invoiceBody) as {
    id: string;
    subtotal: number | string;
    impuestos: number | string;
    total: number | string;
  };
  expect(Number(invoice.subtotal)).toBe(120_000);
  expect(Number(invoice.impuestos)).toBe(22_800);
  expect(Number(invoice.total)).toBe(142_800);

  const invoiceRow = page.getByRole('link', { name: invoiceNumber }).locator('xpath=..');
  const issueResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/billing/invoices/${invoice.id}/status` &&
      response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Emitir' }).click();
  expect((await issueResponsePromise).status()).toBe(200);
  await expect(invoiceRow.getByText('Emitida', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: invoiceNumber }).click();
  await expect(page.getByText(productName, { exact: true })).toBeVisible();

  const payroll = await seedPayrollAccrualFixture(tenant.id, user.id);
  try {
    await page.goto(`/nomina/periodos/${payroll.periodId}`);
    await expect(page.getByRole('heading', { name: 'Nómina marzo 2026' })).toBeVisible();
    await expect(page.getByText('Ana Pérez')).toBeVisible();

    const postingResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/payroll/periods/${payroll.periodId}/contabilizar` &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Contabilizar en Ledger' }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Contabilizar nómina' })
      .click();

    const postingResponse = await postingResponsePromise;
    expect(postingResponse.status()).toBe(200);
    const posting = (await postingResponse.json()) as {
      status: string;
      comprobanteId: string;
    };
    expect(posting.status).toBe('CAUSADA');
    await expect(page.getByText('Nómina contabilizada en el Ledger.')).toBeVisible();
    await expect(page.getByText(`ID de comprobante: ${posting.comprobanteId}`)).toBeVisible();

    await page.reload();
    await expect(page.getByText(`ID de comprobante: ${posting.comprobanteId}`)).toBeVisible();

    const pilaPreparationPanel = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Preparación de datos PILA' }) });
    await expect(pilaPreparationPanel).toBeVisible();

    const preparationResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/payroll/periods/${payroll.periodId}/pila-preparation` &&
        response.request().method() === 'GET',
    );
    await pilaPreparationPanel.getByRole('button', { name: 'Revisar datos' }).click();
    const preparationResponse = await preparationResponsePromise;
    expect(preparationResponse.status()).toBe(200);
    const preparation = (await preparationResponse.json()) as {
      formatVersion: string | null;
      normativeSourceStatus: string;
      snapshotsRevisados: number;
      empleadosConDatosPendientes: number;
      archivoGenerable: boolean;
      estadoArchivo: string;
      issues: Array<{ code: string; affectedCount: number }>;
    };
    expect(preparation.formatVersion).toBeNull();
    expect(preparation.normativeSourceStatus).toBe('RECONCILIATION_PENDING');
    expect(preparation.snapshotsRevisados).toBe(1);
    expect(preparation.empleadosConDatosPendientes).toBe(1);
    expect(preparation.archivoGenerable).toBe(false);
    expect(preparation.estadoArchivo).toBe('NO_IMPLEMENTADO');
    expect(preparation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PILA_SNAPSHOT_VERSION_NO_SOPORTADA',
          affectedCount: 1,
        }),
      ]),
    );
    await expect(pilaPreparationPanel.getByText('Snapshots revisados: 1')).toBeVisible();
    await expect(
      pilaPreparationPanel.getByText(
        /No existe un snapshot PILA aprobado con una versión compatible/,
      ),
    ).toBeVisible();
    await expect(
      pilaPreparationPanel.getByText(/no genera archivos ni confirma aceptación de un operador/i),
    ).toBeVisible();

    const persisted = await payroll.inspectPersistedState();
    expect(persisted.periodStatus).toBe('CAUSADA');
    expect(persisted.vouchers).toEqual([{ id: posting.comprobanteId, estado: 'CONTABILIZADO' }]);
    expect(persisted.snapshotPayload).toEqual(payroll.snapshotPayload);
    expect(persisted.snapshotStatus).toBe('APROBADA');
  } finally {
    await payroll.disconnect();
    await billingFixture.disconnect();
  }
});
