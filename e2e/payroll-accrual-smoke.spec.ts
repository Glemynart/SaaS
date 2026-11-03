import { randomInt } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { seedPayrollCalculationFixture } from './helpers/payroll-calculation-fixture';

async function registerAndSignIn(page: Page) {
  const suffix = randomInt(10_000_000, 100_000_000).toString();
  const nit = `6${suffix}`;
  const email = `payroll-accrual-${suffix}@example.test`;
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('Payroll Accrual E2E');
  await page.getByLabel('Razón social').fill('Payroll Accrual E2E S.A.S.');
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
  };

  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await page.getByLabel('NIT de la empresa').fill(nit);
  await page.getByLabel('Correo').fill(email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  return registration.tenant.id;
}

test('genera, aprueba y contabiliza una nómina desde el flujo de usuario', async ({ page }) => {
  test.setTimeout(90_000);
  const tenantId = await registerAndSignIn(page);
  const fixture = await seedPayrollCalculationFixture(tenantId);
  const periodName = 'Nómina octubre 2026';
  let periodId = '';

  try {
    await page.goto('/nomina/periodos');
    await page.getByRole('button', { name: 'Nuevo periodo' }).click();
    await page.getByPlaceholder('Octubre 2026').fill(periodName);
    const periodDates = page.locator('input[type="date"]');
    await periodDates.nth(0).fill('2026-10-01');
    await periodDates.nth(1).fill('2026-10-31');

    const createResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/payroll/periods' &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Crear', exact: true }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(200);
    periodId = ((await createResponse.json()) as { id: string }).id;

    const periodCard = () => page.getByText(periodName, { exact: true }).locator('xpath=../..');
    await expect(periodCard()).toBeVisible();

    const generateResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/payroll/periods/${periodId}/generate` &&
        response.request().method() === 'POST',
    );
    await periodCard().getByRole('button', { name: 'Generar' }).click();
    const generateResponse = await generateResponsePromise;
    expect(generateResponse.status()).toBe(200);
    expect(await generateResponse.json()).toMatchObject({ created: 1 });

    await page.reload();
    await expect(periodCard()).toContainText('Calculada');
    const reviewResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/payroll/periods/${periodId}/enviar-revision` &&
        response.request().method() === 'POST',
    );
    await periodCard().getByRole('button', { name: 'Enviar' }).click();
    expect((await reviewResponsePromise).status()).toBe(200);

    await page.reload();
    await expect(periodCard()).toContainText('En revisión');
    const approveResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/payroll/periods/${periodId}/aprobar` &&
        response.request().method() === 'POST',
    );
    await periodCard().getByRole('button', { name: 'Aprobar' }).click();
    expect((await approveResponsePromise).status()).toBe(200);

    await page.reload();
    await expect(periodCard()).toContainText('Aprobada');
    await periodCard().getByRole('link', { name: periodName }).click();
    await expect(page).toHaveURL(new RegExp(`/nomina/periodos/${periodId}$`));
    await expect(page.getByRole('heading', { name: periodName })).toBeVisible();
    await expect(page.getByText(fixture.employeeName)).toBeVisible();
    await expect(page.getByText('2.000.000', { exact: false }).first()).toBeVisible();

    const approved = await fixture.inspect(periodId);
    expect(approved.periodStatus).toBe('APROBADA');
    expect(approved.runs).toHaveLength(1);
    expect(approved.runs[0].totalDevengos).toBeGreaterThan(0);
    expect(approved.runs[0].totalDeducciones).toBeGreaterThan(0);
    expect(approved.runs[0].netoPagar).toBeGreaterThan(0);
    expect(approved.runs[0].totalDevengos - approved.runs[0].totalDeducciones).toBe(
      approved.runs[0].netoPagar,
    );
    expect(approved.snapshots).toHaveLength(1);
    expect(approved.snapshots[0].estadoPeriodo).toBe('APROBADA');
    expect(approved.snapshots[0].payload.employee).toMatchObject({
      salarioBaseUsado: 2_000_000,
    });

    const postingResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/payroll/periods/${periodId}/contabilizar` &&
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
      payrollPeriodId: string;
      comprobanteId: string;
    };
    expect(posting).toMatchObject({ status: 'CAUSADA', payrollPeriodId: periodId });

    await expect(page.getByText('Nómina contabilizada en el Ledger.')).toBeVisible();
    await expect(page.getByText(`ID de comprobante: ${posting.comprobanteId}`)).toBeVisible();
    await expect(page.getByText('GASTO_SUELDOS')).toBeVisible();
    await expect(page.getByText('SALARIOS_POR_PAGAR')).toBeVisible();

    const retryResponse = await page.evaluate(async (path) => {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return { status: response.status, body: await response.json() };
    }, `/api/payroll/periods/${periodId}/contabilizar`);
    expect(retryResponse.status).toBe(200);
    expect(retryResponse.body).toEqual({
      status: 'YA_CAUSADA',
      payrollPeriodId: periodId,
      comprobanteId: posting.comprobanteId,
    });

    await page.reload();
    await expect(page.getByText(`ID de comprobante: ${posting.comprobanteId}`)).toBeVisible();

    const caused = await fixture.inspect(periodId);
    expect(caused.periodStatus).toBe('CAUSADA');
    expect(caused.runs).toEqual(approved.runs);
    expect(caused.snapshots).toEqual(approved.snapshots);
    expect(caused.vouchers).toHaveLength(1);
    expect(caused.vouchers[0].id).toBe(posting.comprobanteId);
    expect(caused.vouchers[0].totalDebito).toBe(caused.vouchers[0].totalCredito);
    expect(caused.vouchers[0].movimientoCount).toBeGreaterThan(2);
  } finally {
    await fixture.disconnect();
  }
});
