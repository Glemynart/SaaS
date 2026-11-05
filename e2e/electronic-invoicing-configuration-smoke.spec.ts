import { randomInt } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

async function registerAndSignIn(page: Page, suffix: string) {
  const nit = `7${suffix}`;
  const email = `electronic-config-${suffix}@example.test`;
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('Configuración FE E2E');
  await page.getByLabel('Razón social').fill('Configuración FE E2E S.A.S.');
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

test('administra perfil, rango y seguimiento de transmisiones desde la interfaz', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const suffix = randomInt(10_000_000, 100_000_000).toString();
  const prefix = `E${suffix.slice(0, 3)}`;
  const start = randomInt(10_000, 20_000);
  const end = start + 9;

  await registerAndSignIn(page, suffix);
  const transmissionsResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/electronic-invoicing/transmissions' &&
      response.request().method() === 'GET',
  );
  await page.goto('/facturacion/electronica');
  const transmissionsResponse = await transmissionsResponsePromise;
  expect(transmissionsResponse.status()).toBe(200);
  expect(await transmissionsResponse.json()).toEqual({ items: [] });
  await expect(
    page.getByRole('heading', { name: 'Configuración de facturación electrónica' }),
  ).toBeVisible();
  await expect(page.getByText(/Todavía no emite ni transmite facturas a la DIAN/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Seguimiento de transmisiones' })).toBeVisible();
  await expect(page.getByText('No hay transmisiones registradas para esta empresa.')).toBeVisible();

  const transmission = {
    id: 'transmission-e2e',
    createdAt: '2026-11-05T10:00:00.000Z',
    providerId: 'matias',
    contractVersion: '3.9.2',
    invoice: {
      status: 'PENDIENTE_CONCILIACION',
      prefix: 'FE',
      number: 42,
      issuedAt: '2026-11-05T00:00:00.000Z',
    },
    latestAttempt: {
      number: 1,
      type: 'ENVIO',
      startedAt: '2026-11-05T10:01:00.000Z',
      result: {
        status: 'DESCONOCIDO',
        errorCode: 'TIMEOUT',
        finishedAt: '2026-11-05T10:02:00.000Z',
      },
    },
  };
  await page.route('**/api/electronic-invoicing/transmissions', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [transmission] }),
    });
  });
  const populatedResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/electronic-invoicing/transmissions' &&
      response.request().method() === 'GET',
  );
  await page.reload();
  const populatedResponse = await populatedResponsePromise;
  expect(populatedResponse.status()).toBe(200);
  expect(await populatedResponse.json()).toEqual({ items: [transmission] });
  const transmissionCard = page.locator('article').filter({ hasText: 'Factura FE42' });
  await expect(transmissionCard).toContainText('Pendiente de conciliación');
  await expect(transmissionCard).toContainText('Envío #1: Resultado desconocido');
  await expect(transmissionCard).toContainText('Código técnico: TIMEOUT');

  await page.getByLabel('Responsabilidades tributarias').fill('05, 48');
  await page.getByLabel('Motivo del cambio').fill('Configurar perfil de prueba');
  const profileResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/electronic-invoicing/profiles' &&
      response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Crear perfil' }).click();
  const profileResponse = await profileResponsePromise;
  expect(profileResponse.status()).toBe(200);

  await page.getByLabel('Número de autorización DIAN').fill(`1876-${suffix}`);
  await page.getByLabel('Fecha de autorización').fill('2026-01-01');
  await page.getByLabel('Prefijo (hasta 4 caracteres)').fill(prefix);
  await page.getByLabel('Vigencia desde').fill('2026-01-01');
  await page.getByLabel('Vigencia hasta').fill('2027-12-31');
  await page.getByLabel('Número inicial').fill(String(start));
  await page.getByLabel('Número final').fill(String(end));
  await page.getByLabel('Motivo de registro').fill('Registrar autorización de prueba');
  const rangeResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/electronic-invoicing/ranges' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Registrar rango' }).click();
  const rangeResponse = await rangeResponsePromise;
  // The same-origin BFF normalizes successful responses to HTTP 200.
  expect(rangeResponse.status()).toBe(200);
  const range = (await rangeResponse.json()) as { id: string };

  const rangeCard = page.locator('article').filter({ hasText: `Autorización 1876-${suffix}` });
  await expect(rangeCard).toContainText(`${prefix} · ${start}–${end}`);
  await expect(rangeCard.getByText('Vigente', { exact: true })).toBeVisible();
  await expect(rangeCard).toContainText(`Ninguno / ${start}`);
  await rangeCard.getByRole('button', { name: 'Inactivar' }).click();
  await rangeCard.getByLabel('Motivo de inactivación').fill('Retirar rango de demostración');

  const deactivateResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/electronic-invoicing/ranges/${range.id}/deactivate` &&
      response.request().method() === 'PATCH',
  );
  await rangeCard.getByRole('button', { name: 'Inactivar rango' }).click();
  const deactivateResponse = await deactivateResponsePromise;
  expect(deactivateResponse.status()).toBe(200);
  await expect(rangeCard.getByText('Inactivo', { exact: true })).toBeVisible();
  await expect(rangeCard).toContainText('Ninguno / Sin disponibles');

  await page.reload();
  await expect(
    page.locator('article').filter({ hasText: `Autorización 1876-${suffix}` }),
  ).toContainText('Inactivo');
});
