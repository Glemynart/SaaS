import { randomInt } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { seedPayrollCorrectionFixture } from './helpers/payroll-correction-fixture';

async function registerAndSignIn(page: Page) {
  const suffix = randomInt(10_000_000, 100_000_000).toString();
  const nit = `7${suffix}`;
  const email = `payroll-correction-${suffix}@example.test`;
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('Payroll Corrections E2E');
  await page.getByLabel('Razón social').fill('Payroll Corrections E2E S.A.S.');
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
  return { tenantId: registration.tenant.id, userId: registration.user.id };
}

test('crea, aprueba y contabiliza una corrección post-aprobación con persistencia real', async ({
  page,
}) => {
  const { tenantId, userId } = await registerAndSignIn(page);
  const fixture = await seedPayrollCorrectionFixture(tenantId, userId);

  try {
    await page.goto(`/nomina/periodos/${fixture.periodId}`);
    await expect(page.getByRole('heading', { name: 'Nómina marzo 2026' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Correcciones de nómina' })).toBeVisible();
    await expect(page.getByText('No hay correcciones para este período.')).toBeVisible();

    await page.getByRole('button', { name: 'Nueva corrección' }).click();
    await page.getByLabel('Descripción de la corrección').fill('Diferencia salario base');
    await page.getByLabel('Empleado de la nómina aprobada').selectOption(fixture.snapshotId);
    await page.getByLabel('Dato que se corrige').selectOption('SALARIO_BASE');
    await page.getByLabel('Nuevo valor en pesos').fill('2500000');

    const createResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/payroll/periods/${fixture.periodId}/corrections` &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Crear corrección' }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const created = (await createResponse.json()) as { id: string; status: string };
    expect(created.status).toBe('BORRADOR');

    await expect(page.getByText('Corrección creada como borrador.')).toBeVisible();
    const correctionCard = page.getByRole('article').filter({ hasText: 'Diferencia salario base' });
    await expect(correctionCard.getByText('Nuevo salario base')).toBeVisible();
    await expect(correctionCard.getByText(/2\.500\.000/)).toBeVisible();

    const reviewResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/payroll/corrections/${created.id}/enviar-revision` &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Enviar a revisión' }).click();
    const reviewResponse = await reviewResponsePromise;
    expect(reviewResponse.status()).toBe(200);
    expect(await reviewResponse.json()).toMatchObject({ id: created.id, status: 'EN_REVISION' });
    await expect(correctionCard.getByText('En revisión', { exact: true })).toBeVisible();

    const approvalResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/payroll/corrections/${created.id}/aprobar` &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Aprobar corrección' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Aprobar corrección' }).click();
    const approvalResponse = await approvalResponsePromise;
    expect(approvalResponse.status()).toBe(200);
    const approved = (await approvalResponse.json()) as {
      status: string;
      materialization: {
        entries: Array<{ concept: { codigo: string }; delta: number }>;
      };
    };
    expect(approved.status).toBe('APROBADA');
    expect(approved.materialization.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          concept: expect.objectContaining({ codigo: 'SALARIO_BASE' }),
          delta: 500_000,
        }),
      ]),
    );
    await expect(correctionCard.getByText('Aprobada', { exact: true })).toBeVisible();
    await expect(correctionCard.getByText(/\+\s*\$\s*500\.000/)).toBeVisible();
    await expect(
      correctionCard.getByText(
        'El ajuste se podrá contabilizar cuando la nómina original esté causada y tenga un comprobante vigente en el Ledger.',
      ),
    ).toBeVisible();
    await expect(correctionCard.getByRole('button', { name: 'Contabilizar ajuste' })).toHaveCount(
      0,
    );

    const payrollAccountingResponsePromise = page.waitForResponse(
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
    const payrollAccountingResponse = await payrollAccountingResponsePromise;
    expect(payrollAccountingResponse.status()).toBe(200);
    expect(await payrollAccountingResponse.json()).toMatchObject({
      status: 'CAUSADA',
      payrollPeriodId: fixture.periodId,
    });
    await expect(correctionCard.getByRole('button', { name: 'Contabilizar ajuste' })).toBeVisible();

    const accountingResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/payroll/corrections/${created.id}/contabilizar` &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Contabilizar ajuste' }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Contabilizar ajuste' })
      .click();
    const accountingResponse = await accountingResponsePromise;
    expect(accountingResponse.status()).toBe(200);
    const accounting = (await accountingResponse.json()) as {
      status: string;
      payrollCorrectionId: string;
      comprobanteId: string;
    };
    expect(accounting).toMatchObject({ status: 'AJUSTADA', payrollCorrectionId: created.id });

    await expect(page.getByText(/Ajuste contabilizado · Comprobante \d+/)).toBeVisible();
    await expect(page.getByText(new RegExp(`ID ${accounting.comprobanteId}`))).toBeVisible();
    await expect(page.getByText('Sede Centro')).toBeVisible();

    const retry = await page.evaluate(async (path) => {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      return { status: response.status, body: await response.json() };
    }, `/api/payroll/corrections/${created.id}/contabilizar`);
    expect(retry.status).toBe(200);
    expect(retry.body).toEqual({
      status: 'YA_AJUSTADA',
      payrollCorrectionId: created.id,
      comprobanteId: accounting.comprobanteId,
    });

    await page.reload();
    await expect(page.getByText(new RegExp(`ID ${accounting.comprobanteId}`))).toBeVisible();

    const persisted = await fixture.inspectPersistedState();
    expect(persisted.periodStatus).toBe('CAUSADA');
    expect(persisted.run).toEqual({
      salarioBaseSnapshot: 2_000_000,
      totalDevengos: fixture.originalTotals.devengos,
      totalDeducciones: fixture.originalTotals.deducciones,
      netoPagar: fixture.originalTotals.neto,
    });
    expect(persisted.snapshotPayload).toEqual(fixture.originalPayload);
    expect(persisted.snapshotStatus).toBe('APROBADA');
    expect(persisted.correctionStatus).toBe('APROBADA');
    expect(persisted.correctionMaterialization).toEqual(approved.materialization);
    expect(persisted.vouchers).toHaveLength(1);
    expect(persisted.vouchers[0]).toMatchObject({
      id: accounting.comprobanteId,
      estado: 'CONTABILIZADO',
      totalDebito: persisted.vouchers[0].totalCredito,
    });
    expect(persisted.vouchers[0].movementCount).toBeGreaterThanOrEqual(2);
    expect(persisted.auditActions).toEqual(
      expect.arrayContaining([
        'PAYROLL_CORRECTION_CREATED',
        'PAYROLL_CORRECTION_SENT_TO_REVIEW',
        'PAYROLL_CORRECTION_APPROVED',
        'PAYROLL_CORRECTION_ACCOUNTING_COMPLETED',
      ]),
    );
  } finally {
    await fixture.disconnect();
  }
});
