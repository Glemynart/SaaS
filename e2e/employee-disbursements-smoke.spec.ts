import { randomInt } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { seedPayrollAccrualFixture } from './helpers/payroll-accounting-fixture';

function assertDisposableDatabase() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is required for this Browser E2E.');

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Browser E2E requires a valid DATABASE_URL.');
  }

  const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const namedAsDisposable = /(?:test|ci|disposable)/i.test(databaseName);
  // The Browser E2E workflow provisions this exact database in its disposable
  // PostgreSQL service; do not broadly allow arbitrary names containing "e2e".
  const isWorkflowE2eDatabase = databaseName === 'saas_e2e';
  if (!loopbackHosts.has(parsed.hostname) || (!namedAsDisposable && !isWorkflowE2eDatabase)) {
    throw new Error(
      'Employee disbursement Browser E2E requires a loopback database named for tests or the disposable saas_e2e workflow service.',
    );
  }
}

async function registerAndSignIn(page: Page, suffix: string) {
  const nit = `6${suffix}`;
  const email = `employee-disbursement-${suffix}@example.test`;
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('Desembolsos E2E');
  await page.getByLabel('Razón social').fill('Desembolsos E2E S.A.S.');
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

test('registra, respalda, verifica y reversa un desembolso desde la interfaz', async ({ page }) => {
  assertDisposableDatabase();

  const suffix = randomInt(10_000_000, 100_000_000).toString();
  const { tenant, user } = await registerAndSignIn(page, suffix);
  const payroll = await seedPayrollAccrualFixture(tenant.id, user.id);

  try {
    const obligationsResponsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/payroll/disbursements/obligations',
    );
    const pendingResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/payroll/disbursements/pending-verification',
    );
    await page.goto('/nomina/desembolsos');
    const [obligationsResponse, pendingResponse] = await Promise.all([
      obligationsResponsePromise,
      pendingResponsePromise,
    ]);
    expect(obligationsResponse.headers()['cache-control']).toBe('private, no-store');
    expect(pendingResponse.headers()['cache-control']).toBe('private, no-store');
    await expect(page.getByRole('heading', { name: 'Desembolsos a empleados' })).toBeVisible();
    await expect(page.getByText('Ana Pérez', { exact: true })).toBeVisible();
    await expect(page.getByText('Saldo pendiente', { exact: true })).toBeVisible();

    await page.getByLabel('Importe del desembolso (COP)').fill('920000');
    const createResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/payroll/disbursements' &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Registrar declaración' }).click();
    expect((await createResponsePromise).status()).toBe(201);
    await expect(page.getByText('Declarado', { exact: true })).toBeVisible();

    const supportInput = page.locator('input[type="file"]');
    const supportResponsePromise = page.waitForResponse(
      (response) =>
        /\/api\/payroll\/disbursements\/[^/]+\/support$/.test(new URL(response.url()).pathname) &&
        response.request().method() === 'POST',
    );
    await supportInput.setInputFiles({
      name: 'comprobante-demo.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\nsynthetic employee disbursement evidence\n'),
    });
    expect((await supportResponsePromise).status()).toBe(201);
    await expect(
      page.getByText('Soportado · pendiente de revisión', { exact: true }),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Pendientes de verificación' }).click();
    await expect(page.getByText('Ana Pérez', { exact: true })).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Ver soporte' }).click();
    expect((await downloadPromise).suggestedFilename()).toMatch(/\.pdf$/);

    await page.getByRole('button', { name: 'Diagnosticar soportes' }).click();
    await expect(
      page.getByRole('heading', { name: 'Diagnóstico de soportes privados' }),
    ).toBeVisible();
    await expect(page.getByText('No se encontraron diferencias.')).toBeVisible();

    await page.getByRole('button', { name: 'Ver obligación' }).click();
    const verifyResponsePromise = page.waitForResponse(
      (response) =>
        /\/api\/payroll\/disbursements\/[^/]+\/verify$/.test(new URL(response.url()).pathname) &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Verificar soporte revisado' }).click();
    expect((await verifyResponsePromise).status()).toBe(200);
    await expect(page.getByText('Verificado administrativamente', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Registrar reverso' }).click();
    await page.getByLabel('Importe (COP)', { exact: true }).fill('200000');
    await page.getByLabel('Motivo', { exact: true }).fill('Reverso de prueba E2E');
    const reversalResponsePromise = page.waitForResponse(
      (response) =>
        /\/api\/payroll\/disbursements\/[^/]+\/reversals$/.test(new URL(response.url()).pathname) &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Confirmar reverso' }).click();
    expect((await reversalResponsePromise).status()).toBe(201);
    const reversalHistory = page.getByText('Ver 1 reverso(s)', { exact: false });
    await expect(reversalHistory).toBeVisible();
    await reversalHistory.click();
    await expect(page.getByText('Reverso de prueba E2E')).toBeVisible();
  } finally {
    await payroll.disconnect();
  }
});
