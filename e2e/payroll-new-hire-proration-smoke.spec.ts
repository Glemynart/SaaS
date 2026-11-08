import { randomInt } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { mapPilaAt2V30DetailCandidate } from '../apps/api/src/payroll/pila-at2-v30-detail-mapper';
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
  test.setTimeout(120_000);
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

    await page.goto('/nomina/periodos');
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
    const approved = await fixture.inspect(periodId);
    expect(approved.periodStatus).toBe('APROBADA');
    expect(approved.snapshots).toHaveLength(1);
    expect(approved.snapshots[0].estadoPeriodo).toBe('APROBADA');
    expect(approved.snapshots[0].payload.employee).toMatchObject({
      salarioBaseUsado: 8_000_000,
      diasNomina: 21,
    });
    expect(
      approved.snapshots[0].payload.concepts.find(
        (concept: { codigo: string }) => concept.codigo === 'SALARIO_BASE',
      )?.valor,
    ).toBe(5_600_000);

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

test('liquida desde la UI un retiro RET único y lo congela en PayrollSnapshot', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const tenantId = await registerAndSignIn(page);
  const fixture = await seedPayrollCalculationFixture(tenantId, {
    fechaIngreso: '2025-01-01',
    fechaInicioContrato: '2025-01-01',
    fechaRetiro: '2026-10-20',
  });
  const periodName = 'Nómina octubre retiro parcial 2026';
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
    await periodCard().getByRole('link', { name: periodName }).click();

    const pilaPanel = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Novedades de seguridad social' }) });
    await pilaPanel.getByLabel('Novedad').selectOption('RET');
    await pilaPanel.getByLabel('Empleado', { exact: true }).selectOption(fixture.employeeId);
    await expect(pilaPanel.getByLabel('Fecha inicial')).toHaveValue('2026-10-20');

    const createEventResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/payroll/periods/${periodId}/pila-events` &&
        response.request().method() === 'POST',
    );
    await pilaPanel.getByRole('button', { name: 'Agregar novedad' }).click();
    const createEventResponse = await createEventResponsePromise;
    expect(createEventResponse.status()).toBe(200);
    await expect(pilaPanel.getByText('Retiro · 2026-10-20')).toBeVisible();

    await page.goto('/nomina/periodos');
    const generateResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/payroll/periods/${periodId}/generate` &&
        response.request().method() === 'POST',
    );
    await periodCard().getByRole('button', { name: 'Generar' }).click();
    const generateResponse = await generateResponsePromise;
    expect(generateResponse.status()).toBe(200);
    expect(await generateResponse.json()).toMatchObject({ created: 1 });

    const generated = await fixture.inspect(periodId);
    expect(generated.runs).toHaveLength(1);
    expect(generated.runs[0].salarioBaseSnapshot).toBe(8_000_000);
    expect(generated.runs[0].calculationTrace?.employee?.diasNomina).toBe(20);
    expect(generated.runs[0].ibc).toBe(5_333_333);
    expect(
      generated.runs[0].concepts.find((concept) => concept.codigo === 'SALARIO_BASE')?.valor,
    ).toBe(5_333_333);

    const reviewResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/payroll/periods/${periodId}/enviar-revision` &&
        response.request().method() === 'POST',
    );
    await periodCard().getByRole('button', { name: 'Enviar' }).click();
    expect((await reviewResponsePromise).status()).toBe(200);
    await page.reload();
    const approveResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/payroll/periods/${periodId}/aprobar` &&
        response.request().method() === 'POST',
    );
    await periodCard().getByRole('button', { name: 'Aprobar' }).click();
    expect((await approveResponsePromise).status()).toBe(200);

    const approved = await fixture.inspect(periodId);
    expect(approved.periodStatus).toBe('APROBADA');
    expect(approved.snapshots).toHaveLength(1);
    expect(approved.snapshots[0].pilaPayload.employee.fechaRetiro).toBe('2026-10-20');
    expect(approved.snapshots[0].pilaPayloadVersion).toBe(11);
    expect(approved.snapshots[0].pilaPayload.payroll.diasNomina).toBe(20);
    expect(approved.snapshots[0].pilaPayload.pilaEvents).toEqual([
      expect.objectContaining({ codigo: 'RET', fechaInicio: '2026-10-20' }),
    ]);
  } finally {
    await fixture.disconnect();
  }
});

test('congela la ubicación laboral registrada desde la ficha para los campos PILA 9 y 10', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const tenantId = await registerAndSignIn(page);
  const fixture = await seedPayrollCalculationFixture(tenantId, {
    fechaIngreso: '2025-01-01',
    fechaInicioContrato: '2025-01-01',
  });
  const periodName = 'Nómina PILA ubicación confirmada E2E';
  let periodId = '';

  try {
    await page.goto(`/empleados/${fixture.employeeId}`);
    await expect(
      page.getByRole('heading', { name: 'Afiliaciones de seguridad social' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Registrar afiliación' }).click();
    const affiliationForm = page.locator('form').filter({
      has: page.getByRole('heading', { name: 'Nueva afiliación' }),
    });
    await affiliationForm.getByRole('combobox', { name: 'Tipo de cotizante' }).selectOption('01');
    await affiliationForm.getByLabel('Subtipo de cotizante').fill('00');
    await affiliationForm.getByLabel('Vigente desde').fill('2026-01-01');
    await affiliationForm.getByLabel('Código EPS').fill('EPS001');
    await affiliationForm.getByLabel('Nombre EPS').fill('EPS Demo E2E');
    await affiliationForm.getByLabel('Código Fondo de pensión').fill('AFP001');
    await affiliationForm.getByLabel('Nombre Fondo de pensión').fill('Fondo Demo E2E');
    await affiliationForm.getByLabel('Transición pensional (campo 5)').selectOption('N');
    await affiliationForm.getByLabel('Tarifa de pensiones (campo 79)').selectOption('1');
    await affiliationForm.getByLabel('Código ARL').fill('ARL001');
    await affiliationForm.getByLabel('Nombre ARL').fill('ARL Demo E2E');
    await affiliationForm.getByRole('combobox', { name: 'Clase de riesgo ARL' }).selectOption('1');
    await affiliationForm.getByLabel('Código Caja de compensación').fill('CCF001');
    await affiliationForm.getByLabel('Nombre Caja de compensación').fill('Caja Demo E2E');
    await affiliationForm.getByLabel('Departamento donde está ubicada la CCF').selectOption('08');
    await affiliationForm
      .getByRole('combobox', { name: '¿Es colombiano en el exterior?' })
      .selectOption('false');
    const affiliationResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/employees/${fixture.employeeId}/afiliaciones-seguridad-social` &&
        response.request().method() === 'POST',
    );
    await affiliationForm.getByRole('button', { name: 'Guardar afiliación' }).click();
    expect((await affiliationResponsePromise).status()).toBe(200);

    const municipalities = (await page.evaluate(async () => {
      const response = await fetch('/api/dane/municipios');
      return (await response.json()) as Array<{ id: string; codigo: string }>;
    })) as Array<{ id: string; codigo: string }>;
    const barranquilla = municipalities.find(({ codigo }) => codigo === '08001');
    expect(barranquilla).toBeTruthy();
    const workLocationPanel = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Ubicación laboral PILA' }),
    });
    const workLocationForm = workLocationPanel.locator('form');
    await workLocationForm
      .getByLabel('Municipio de trabajo declarado')
      .selectOption(barranquilla!.id);
    await workLocationForm.getByLabel('Vigente desde').fill('2026-01-01');
    await workLocationForm
      .getByLabel(
        'Confirmo que este es el municipio donde el empleado ejecuta su actividad laboral para PILA.',
      )
      .check();
    const workLocationResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/employees/${fixture.employeeId}/ubicaciones-laborales-pila` &&
        response.request().method() === 'POST',
    );
    await workLocationForm.getByRole('button', { name: 'Registrar ubicación' }).click();
    expect((await workLocationResponsePromise).status()).toBe(200);
    await page.reload();
    const persistedWorkLocation = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Ubicación laboral PILA' }) })
      .getByRole('listitem')
      .filter({ hasText: 'Barranquilla' });
    await expect(persistedWorkLocation).toContainText('Sin fecha final');

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
    expect((await generateResponsePromise).status()).toBe(200);
    await page.reload();

    const reviewResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/payroll/periods/${periodId}/enviar-revision` &&
        response.request().method() === 'POST',
    );
    await periodCard().getByRole('button', { name: 'Enviar' }).click();
    expect((await reviewResponsePromise).status()).toBe(200);
    await page.reload();
    const approveResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/payroll/periods/${periodId}/aprobar` &&
        response.request().method() === 'POST',
    );
    await periodCard().getByRole('button', { name: 'Aprobar' }).click();
    expect((await approveResponsePromise).status()).toBe(200);

    const approved = await fixture.inspect(periodId);
    expect(approved.periodStatus).toBe('APROBADA');
    expect(approved.snapshots).toHaveLength(1);
    expect(approved.snapshots[0].pilaPayload.pilaWorkLocations).toEqual([
      expect.objectContaining({
        tenantId,
        municipio: expect.objectContaining({
          codigo: '08001',
          nombre: 'Barranquilla',
          departamento: 'Atlántico',
        }),
        vigenteDesde: '2026-01-01',
        vigenteHasta: null,
      }),
    ]);

    const candidate = mapPilaAt2V30DetailCandidate(
      {
        employeeId: fixture.employeeId,
        payloadVersion: approved.snapshots[0].pilaPayloadVersion,
        payload: approved.snapshots[0].pilaPayload,
      },
      {
        expectedTenantId: tenantId,
        planillaType: 'E',
        period: {
          id: periodId,
          fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
          fechaFin: new Date('2026-10-31T00:00:00.000Z'),
        },
      },
    );
    expect(candidate.values[9]).toEqual({ value: '08' });
    expect(candidate.values[10]).toEqual({ value: '001' });
    expect(
      candidate.unresolvedFields.filter(({ fieldNumber }) => [9, 10].includes(fieldNumber)),
    ).toEqual([]);
  } finally {
    await fixture.disconnect();
  }
});
