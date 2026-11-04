import { randomInt } from 'node:crypto';
import { expect, test, type Dialog, type Page } from '@playwright/test';
import { seedBillingLedgerFixture } from './helpers/billing-ledger-fixture';

function dateInDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function registerAndSignIn(page: Page, suffix: string) {
  const nit = `8${suffix}`;
  const email = `billing-invoice-${suffix}@example.test`;
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('Facturación E2E');
  await page.getByLabel('Razón social').fill('Facturación E2E S.A.S.');
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

test('crea y emite una factura desde la interfaz y conserva sus valores', async ({ page }) => {
  const suffix = randomInt(10_000_000, 100_000_000).toString();
  const customerName = `Cliente Demo ${suffix}`;
  const customerNit = `9${suffix}`;
  const productName = `Servicio Educativo ${suffix}`;
  const invoiceNumber = `DEMO-${suffix}`;
  const secondInvoiceNumber = `DEMO-2-${suffix}`;
  const fechaVencimiento = dateInDays(30);
  const registration = await registerAndSignIn(page, suffix);
  const accountingFixture = await seedBillingLedgerFixture(
    registration.tenant.id,
    customerNit,
    customerName,
  );

  try {
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
    const createCustomerResponse = await createCustomerResponsePromise;
    expect(createCustomerResponse.status()).toBe(200);
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
    const createProductResponse = await createProductResponsePromise;
    expect(createProductResponse.status()).toBe(200);
    await expect(page.getByText(productName, { exact: true })).toBeVisible();

    await page.goto('/facturacion/facturas');
    await page.getByRole('button', { name: 'Nueva' }).click();
    await page.locator('select').nth(0).selectOption({ label: customerName });
    await page.getByPlaceholder('FAC-001').fill(invoiceNumber);
    await page.getByLabel('Fecha de vencimiento').fill(fechaVencimiento);
    await page.locator('select').nth(1).selectOption({ label: productName });
    await expect(page.getByPlaceholder('V. Unit')).toHaveValue('120000');
    await page.getByPlaceholder('Cant').fill('1');

    const createInvoiceResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/billing/invoices' &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Crear factura' }).click();
    const createInvoiceResponse = await createInvoiceResponsePromise;
    expect(createInvoiceResponse.status()).toBe(200);
    const invoice = (await createInvoiceResponse.json()) as {
      id: string;
      numero: string;
      subtotal: number | string;
      impuestos: number | string;
      total: number | string;
      status: string;
      items: Array<{ descripcion: string; subtotal: number | string }>;
    };
    expect(invoice).toMatchObject({ numero: invoiceNumber, status: 'DRAFT' });
    expect(Number(invoice.subtotal)).toBe(120_000);
    expect(Number(invoice.impuestos)).toBe(22_800);
    expect(Number(invoice.total)).toBe(142_800);
    expect(invoice.items).toHaveLength(1);
    expect(invoice.items[0].descripcion).toBe(productName);
    expect(Number(invoice.items[0].subtotal)).toBe(120_000);

    const issueResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/billing/invoices/${invoice.id}/status` &&
        response.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Emitir' }).click();
    const issueResponse = await issueResponsePromise;
    expect(issueResponse.status()).toBe(200);
    const invoiceRow = page.getByRole('link', { name: invoiceNumber }).locator('xpath=..');
    await expect(invoiceRow.getByText('Emitida', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Nueva' }).click();
    await page.locator('select').nth(0).selectOption({ label: customerName });
    await page.getByPlaceholder('FAC-001').fill(secondInvoiceNumber);
    await page.getByLabel('Fecha de vencimiento').fill(fechaVencimiento);
    await page.locator('select').nth(1).selectOption({ label: productName });
    await expect(page.getByPlaceholder('V. Unit')).toHaveValue('120000');
    await page.getByPlaceholder('Cant').fill('1');

    const createSecondInvoiceResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/billing/invoices' &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Crear factura' }).click();
    const createSecondInvoiceResponse = await createSecondInvoiceResponsePromise;
    expect(createSecondInvoiceResponse.status()).toBe(200);
    const secondInvoice = (await createSecondInvoiceResponse.json()) as {
      id: string;
      numero: string;
      total: number | string;
    };
    expect(secondInvoice.numero).toBe(secondInvoiceNumber);
    expect(Number(secondInvoice.total)).toBe(142_800);

    const issueSecondInvoiceResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/billing/invoices/${secondInvoice.id}/status` &&
        response.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Emitir' }).click();
    const issueSecondInvoiceResponse = await issueSecondInvoiceResponsePromise;
    expect(issueSecondInvoiceResponse.status()).toBe(200);
    await expect(
      page
        .getByRole('link', { name: secondInvoiceNumber })
        .locator('xpath=..')
        .getByText('Emitida', { exact: true }),
    ).toBeVisible();

    await page.getByRole('link', { name: invoiceNumber }).click();
    const invoiceHeading = page.getByRole('heading', { name: `Factura ${invoiceNumber}` });
    await expect(invoiceHeading).toBeVisible();
    await expect(
      invoiceHeading.locator('xpath=..').getByText('Emitida', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(customerName, { exact: true })).toBeVisible();
    await expect(page.getByText(productName, { exact: true })).toBeVisible();
    await expect(page.getByText('Contabilización interna')).toBeVisible();
    await expect(page.getByText(/Débitos.*Créditos/)).toBeVisible();
    await expect(page.getByText('Impuestos según tasas congeladas en las líneas')).toBeVisible();

    await page.getByLabel(`Aplicar a ${invoiceNumber} (COP)`).fill('20000');
    await page.getByLabel(`Aplicar a ${secondInvoiceNumber} (COP)`).fill('30000');
    await expect(page.getByText(/Total recibido:.*50\.000.*2 factura/)).toBeVisible();
    const createReceiptResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/billing/receipts' &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Registrar recaudo' }).click();
    const createReceiptResponse = await createReceiptResponsePromise;
    expect(createReceiptResponse.status()).toBe(200);
    const receipt = (await createReceiptResponse.json()) as {
      id: string;
      monto: number | string;
      aplicaciones: Array<{ invoiceId: string; amount: number | string }>;
    };
    expect(Number(receipt.monto)).toBe(50_000);
    expect(receipt.aplicaciones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ invoiceId: invoice.id }),
        expect.objectContaining({ invoiceId: secondInvoice.id }),
      ]),
    );
    expect(
      Object.fromEntries(
        receipt.aplicaciones.map(({ invoiceId, amount }) => [invoiceId, Number(amount)]),
      ),
    ).toEqual({ [invoice.id]: 20_000, [secondInvoice.id]: 30_000 });
    await expect(
      page.getByText('Pendiente', { exact: true }).locator('xpath=following-sibling::strong[1]'),
    ).toContainText('122.800');
    await expect(
      page.getByText(new RegExp(`Recaudo total.*2 facturas.*${secondInvoiceNumber}`)),
    ).toBeVisible();

    const receiptDialogTypes: string[] = [];
    const acceptReceiptReversalDialogs = async (dialog: Dialog) => {
      receiptDialogTypes.push(dialog.type());
      if (dialog.type() === 'confirm') await dialog.accept();
      else await dialog.accept('Reversión E2E de recaudo distribuido');
    };
    page.on('dialog', acceptReceiptReversalDialogs);
    const reverseReceiptResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/billing/receipts/${receipt.id}/reversal` &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Reversar recaudo completo' }).click();
    const reverseReceiptResponse = await reverseReceiptResponsePromise;
    expect(reverseReceiptResponse.status()).toBe(200);
    page.off('dialog', acceptReceiptReversalDialogs);
    expect(receiptDialogTypes).toEqual(['confirm', 'prompt']);
    await expect(page.getByText(/Recaudo total.*2 facturas.*Reversado/)).toBeVisible();

    await page.goto(`/facturacion/facturas/${secondInvoice.id}`);
    await expect(
      page.getByRole('heading', { name: `Factura ${secondInvoiceNumber}` }),
    ).toBeVisible();
    await expect(
      page.getByText('Pendiente', { exact: true }).locator('xpath=following-sibling::strong[1]'),
    ).toContainText('142.800');

    await page.goto(`/facturacion/facturas/${invoice.id}`);
    await expect(invoiceHeading).toBeVisible();
    await page.reload();
    await expect(invoiceHeading).toBeVisible();
    await expect(
      invoiceHeading.locator('xpath=..').getByText('Emitida', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(productName, { exact: true })).toBeVisible();

    await page.goto('/facturacion/facturas');
    const cancelResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/billing/invoices/${invoice.id}/status` &&
        response.request().method() === 'PATCH',
    );
    page.once('dialog', (dialog) => dialog.accept('Cancelación de prueba E2E'));
    await page
      .getByRole('link', { name: invoiceNumber })
      .locator('xpath=../../..')
      .getByRole('button', { name: 'Revertir' })
      .click();
    const cancelResponse = await cancelResponsePromise;
    expect(cancelResponse.status()).toBe(200);
    const cancelledInvoice = (await cancelResponse.json()) as { status: string };
    expect(cancelledInvoice.status).toBe('CANCELLED');

    const cancelledRow = page.getByRole('link', { name: invoiceNumber }).locator('xpath=..');
    await expect(cancelledRow.getByText('Anulada', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: invoiceNumber }).click();
    const accountingSection = page
      .locator('section')
      .filter({ hasText: 'Contabilización interna' });
    await expect(accountingSection.getByText(/· ANULADO/)).toBeVisible();
    await page.reload();
    await expect(accountingSection.getByText(/· ANULADO/)).toBeVisible();
  } finally {
    await accountingFixture.disconnect();
  }
});
