import { randomInt } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { seedPayrollAccrualFixture } from './helpers/payroll-accounting-fixture';

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
  await page.getByRole('button', { name: 'Crear empresa' }).click();

  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await page.getByLabel('NIT de la empresa').fill(nit);
  await page.getByLabel('Correo').fill(email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const meResponse = await page.request.get('/api/auth/me');
  expect(meResponse.status()).toBe(200);
  const { user } = (await meResponse.json()) as {
    user: { id: string; tenantId: string; rol: string };
  };
  expect(user.rol).toBe('ADMIN');
  return { tenantId: user.tenantId, userId: user.id };
}

test('contabiliza una nómina aprobada y confirma el comprobante persistido', async ({ page }) => {
  const { tenantId, userId } = await registerAndSignIn(page);
  const fixture = await seedPayrollAccrualFixture(tenantId, userId);

  try {
    await page.goto(`/nomina/periodos/${fixture.periodId}`);
    await expect(page.getByRole('heading', { name: 'Nómina marzo 2026' })).toBeVisible();
    await expect(page.getByText('Contabilizar en Ledger')).toBeVisible();
    await expect(page.getByText('Ana Pérez')).toBeVisible();

    const postingResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/payroll/periods/${fixture.periodId}/contabilizar` &&
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
    expect(posting).toMatchObject({
      status: 'CAUSADA',
      payrollPeriodId: fixture.periodId,
    });

    await expect(page.getByText('Nómina contabilizada en el Ledger.')).toBeVisible();
    await expect(page.getByText(/Comprobante \d+/)).toBeVisible();
    await expect(
      page.getByText(new RegExp(`ID de comprobante: ${posting.comprobanteId}`)),
    ).toBeVisible();
    await expect(page.getByText('Gasto de sueldos')).toBeVisible();
    await expect(page.getByText('Salarios netos por pagar')).toBeVisible();

    const retryResponse = await page.request.post(
      `/api/payroll/periods/${fixture.periodId}/contabilizar`,
      { data: {} },
    );
    expect(retryResponse.status()).toBe(200);
    expect(await retryResponse.json()).toEqual({
      status: 'YA_CAUSADA',
      payrollPeriodId: fixture.periodId,
      comprobanteId: posting.comprobanteId,
    });

    await page.reload();
    await expect(
      page.getByText(new RegExp(`ID de comprobante: ${posting.comprobanteId}`)),
    ).toBeVisible();

    const persisted = await fixture.inspectPersistedState();
    expect(persisted.periodStatus).toBe('CAUSADA');
    expect(persisted.vouchers).toEqual([{ id: posting.comprobanteId, estado: 'CONTABILIZADO' }]);
    expect(persisted.snapshotPayload).toEqual(fixture.snapshotPayload);
    expect(persisted.snapshotStatus).toBe('APROBADA');
  } finally {
    await fixture.disconnect();
  }
});
