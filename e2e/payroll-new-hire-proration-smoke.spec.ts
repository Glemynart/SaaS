import { randomInt } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { seedPayrollCalculationFixture } from './helpers/payroll-calculation-fixture';

async function registerAndSignIn(page: Page) {
  const suffix = randomInt(10_000_000, 100_000_000).toString();
  const nit = `8${suffix}`;
  const email = `payroll-new-hire-${suffix}@example.test`;
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('Payroll New Hire E2E');
  await page.getByLabel('Razón social').fill('Payroll New Hire E2E S.A.S.');
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

test('liquida desde la UI el salario proporcional de un ingreso dentro del mes', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const tenantId = await registerAndSignIn(page);
  const fixture = await seedPayrollCalculationFixture(tenantId, {
    fechaIngreso: '2026-10-10',
    fechaInicioContrato: '2026-10-10',
  });
  const periodName = 'Nómina octubre ingreso parcial 2026';
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
    await periodCard().getByRole('link', { name: periodName }).click();
    await expect(page.getByRole('heading', { name: periodName })).toBeVisible();
    await expect(page.getByText(fixture.employeeName, { exact: true }).last()).toBeVisible();
    await expect(page.getByText(/Salario base:.*5\.600\.000/)).toBeVisible();

    const generated = await fixture.inspect(periodId);
    expect(generated.runs).toHaveLength(1);
    expect(generated.runs[0].salarioBaseSnapshot).toBe(8_000_000);
    expect(generated.runs[0].ibc).toBe(5_600_000);
    expect(generated.runs[0].calculationTrace?.employee?.diasNomina).toBe(21);
    expect(
      generated.runs[0].concepts.find((concept) => concept.codigo === 'SALARIO_BASE')?.valor,
    ).toBe(5_600_000);
    expect(generated.snapshots).toHaveLength(0);
  } finally {
    await fixture.disconnect();
  }
});
