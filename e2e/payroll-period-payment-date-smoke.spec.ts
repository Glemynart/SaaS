import { randomInt } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

async function registerAndSignIn(page: Page) {
  const suffix = randomInt(10_000_000, 100_000_000).toString();
  const nit = `8${suffix}`;
  const email = `payroll-payment-date-${suffix}@example.test`;
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('Payroll Payment Date E2E');
  await page.getByLabel('Razón social').fill('Payroll Payment Date E2E S.A.S.');
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

  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await page.getByLabel('NIT de la empresa').fill(nit);
  await page.getByLabel('Correo').fill(email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('captura y muestra la fecha prevista de pago del período', async ({ page }) => {
  await registerAndSignIn(page);
  await page.goto('/nomina/periodos');
  await page.getByRole('button', { name: 'Nuevo periodo' }).click();
  await page.getByPlaceholder('Octubre 2026').fill('Nómina de octubre 2026');

  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill('2026-10-01');
  await dateInputs.nth(1).fill('2026-10-31');
  await dateInputs.nth(2).fill('2026-11-05');

  const createResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/payroll/periods' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear', exact: true }).click();

  const createResponse = await createResponsePromise;
  expect(createResponse.status()).toBe(201);
  await expect(page.getByText(/Pago PILA previsto: \d{1,2}\/11\/2026/)).toBeVisible();
});
