import { randomInt } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

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
  await registerAndSignIn(page, suffix);

  await page.goto('/facturacion/clientes');
  await page.getByRole('button', { name: 'Nuevo' }).click();
  const customerInputs = page.locator('input');
  await customerInputs.nth(0).fill(customerName);
  await customerInputs.nth(1).fill(customerNit);
  await customerInputs.nth(2).fill(`cliente-${suffix}@example.test`);
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
  await productInputs.nth(2).fill('19');
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
  await page.locator('select').nth(1).selectOption({ label: productName });
  await page.getByPlaceholder('Cant').fill('1');
  await page.getByPlaceholder('V. Unit').fill('120000');

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
  await expect(page.getByText('ISSUED', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: invoiceNumber }).click();
  await expect(page.getByRole('heading', { name: `Factura ${invoiceNumber}` })).toBeVisible();
  await expect(page.getByText(customerName, { exact: true })).toBeVisible();
  await expect(page.getByText(productName, { exact: true })).toBeVisible();
  await expect(page.getByText('IVA (19%)')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: `Factura ${invoiceNumber}` })).toBeVisible();
  await expect(page.getByText('ISSUED', { exact: true })).toBeVisible();
  await expect(page.getByText(productName, { exact: true })).toBeVisible();
});
