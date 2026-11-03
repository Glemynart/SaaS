import { randomInt } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

async function registerAndSignIn(page: Page) {
  const suffix = randomInt(10_000_000, 100_000_000).toString();
  const nit = `6${suffix}`;
  const email = `payroll-pila-event-${suffix}@example.test`;
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('PILA Event E2E');
  await page.getByLabel('Razón social').fill('PILA Event E2E S.A.S.');
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

async function browserJsonRequest(
  page: Page,
  path: string,
  method: 'GET' | 'POST' | 'PATCH',
  data?: Record<string, unknown>,
) {
  return page.evaluate(
    async ({ requestPath, requestMethod, requestData }) => {
      const response = await fetch(requestPath, {
        method: requestMethod,
        credentials: 'same-origin',
        ...(requestData
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestData),
            }
          : {}),
      });
      return { status: response.status, body: await response.json() };
    },
    { requestPath: path, requestMethod: method, requestData: data },
  );
}

test('configura los datos PILA y registra, conserva y elimina una novedad del período', async ({
  page,
}) => {
  await registerAndSignIn(page);

  await page.goto('/configuracion/identidad');
  const employerPanel = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Datos del aportante para PILA' }) });
  await employerPanel.getByLabel('Documento del aportante').selectOption('NI');
  await employerPanel.getByLabel('Tipo de aportante').selectOption('1');
  await employerPanel.getByLabel('Naturaleza jurídica').selectOption('2');
  await employerPanel.getByLabel('Tipo de persona').selectOption('J');
  await employerPanel.getByLabel('Forma de presentación').selectOption('U');
  const saveEmployerProfileResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/tenant-branding/pila' &&
      response.request().method() === 'PATCH',
  );
  await employerPanel.getByRole('button', { name: 'Guardar datos PILA' }).click();
  const saveEmployerProfileResponse = await saveEmployerProfileResponsePromise;
  expect(saveEmployerProfileResponse.status()).toBe(200);
  await expect(employerPanel.getByText('Datos guardados.')).toBeVisible();
  await page.reload();
  await expect(employerPanel.getByLabel('Documento del aportante')).toHaveValue('NI');

  const municipalityResponse = await browserJsonRequest(
    page,
    '/api/dane/municipios?search=Bogotá',
    'GET',
  );
  expect(municipalityResponse.status).toBe(200);
  const municipalities = municipalityResponse.body as Array<{
    id: string;
  }>;
  expect(municipalities.length).toBeGreaterThan(0);

  const suffix = randomInt(10_000_000, 100_000_000).toString();
  const siteResponse = await browserJsonRequest(page, '/api/sedes', 'POST', {
    nombre: `Sede PILA E2E ${suffix}`,
    municipioId: municipalities[0].id,
    direccion: 'Carrera 1 # 2-3',
  });
  expect(siteResponse.status).toBe(200);
  const site = siteResponse.body as { id: string };

  await page.goto('/empleados');
  await page.getByRole('button', { name: 'Nuevo empleado' }).first().click();
  const employeeDocument = `pila-event-${suffix}`;
  await page.getByLabel('Número de documento').fill(employeeDocument);
  await page.getByLabel('Primer nombre').fill('Ana');
  await page.getByLabel('Primer apellido').fill('Pérez');
  await page.getByLabel('Cargo').fill('Docente');
  await page.getByLabel('Sede').selectOption(site.id);
  await page.getByRole('spinbutton', { name: 'Salario', exact: true }).fill('2000000');
  await page.getByLabel('Fecha de ingreso').fill('2026-01-01');
  await page.getByLabel('Tipo de salario para PILA').selectOption('F');
  const createEmployeeResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/employees' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear empleado', exact: true }).click();
  const createEmployeeResponse = await createEmployeeResponsePromise;
  expect(createEmployeeResponse.status()).toBe(200);
  const employee = (await createEmployeeResponse.json()) as { id: string };

  await page.goto('/nomina/periodos');
  await page.getByRole('button', { name: 'Nuevo periodo' }).click();
  await page.getByPlaceholder('Octubre 2026').fill('Nómina PILA octubre 2026');
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill('2026-10-01');
  await dateInputs.nth(1).fill('2026-10-31');

  const createPeriodResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/payroll/periods' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  const createPeriodResponse = await createPeriodResponsePromise;
  expect(createPeriodResponse.status()).toBe(200);

  const periodLink = page.getByRole('link', {
    name: 'Nómina PILA octubre 2026',
  });
  await expect(periodLink).toBeVisible();
  const periodHref = await periodLink.getAttribute('href');
  expect(periodHref).toBeTruthy();
  const periodId = new URL(periodHref!, page.url()).pathname.split('/').pop()!;
  await periodLink.click();

  const pilaPanel = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Novedades de seguridad social' }) });
  await expect(
    pilaPanel.getByText('No hay novedades PILA registradas en este período.'),
  ).toBeVisible();
  await pilaPanel.getByLabel('Empleado', { exact: true }).selectOption(employee.id);
  await pilaPanel.getByLabel('Novedad').selectOption('IGE');
  await pilaPanel.getByLabel('Fecha inicial').fill('2026-10-12');
  await pilaPanel.getByLabel('Fecha final').fill('2026-10-14');

  const createEventResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/payroll/periods/${periodId}/pila-events` &&
      response.request().method() === 'POST',
  );
  await pilaPanel.getByRole('button', { name: 'Agregar novedad' }).click();
  const createEventResponse = await createEventResponsePromise;
  expect(createEventResponse.status()).toBe(200);
  const createdEvent = (await createEventResponse.json()) as { id: string };

  await expect(pilaPanel.getByText('Incapacidad general · 2026-10-12 — 2026-10-14')).toBeVisible();
  await page.reload();
  await expect(pilaPanel.getByText('Incapacidad general · 2026-10-12 — 2026-10-14')).toBeVisible();

  const deleteEventResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/payroll/pila-events/${createdEvent.id}` &&
      response.request().method() === 'DELETE',
  );
  await pilaPanel.getByRole('button', { name: 'Eliminar novedad de Ana Pérez' }).click();
  const deleteEventResponse = await deleteEventResponsePromise;
  expect(deleteEventResponse.status()).toBe(200);
  await expect(
    pilaPanel.getByText('No hay novedades PILA registradas en este período.'),
  ).toBeVisible();

  const retireEmployeeResponse = await browserJsonRequest(
    page,
    `/api/employees/${employee.id}`,
    'PATCH',
    { estado: 'INACTIVO', fechaRetiro: '2026-10-31' },
  );
  expect(retireEmployeeResponse.status).toBe(200);

  await page.reload();
  await pilaPanel.getByLabel('Novedad').selectOption('RET');
  await expect(
    pilaPanel.getByText(
      'Los empleados inactivos no aparecen porque la nómina aún no liquida proporcionalmente el período desde la fecha de retiro.',
    ),
  ).toBeVisible();
  await expect(
    pilaPanel.getByLabel('Empleado', { exact: true }).locator('option').filter({
      hasText: employeeDocument,
    }),
  ).toHaveCount(0);

  const inactiveRetirementResponse = await browserJsonRequest(
    page,
    `/api/payroll/periods/${periodId}/pila-events`,
    'POST',
    {
      employeeId: employee.id,
      codigo: 'RET',
      fechaInicio: '2026-10-31',
    },
  );
  expect(inactiveRetirementResponse.status).toBe(400);
  await expect(
    pilaPanel.getByText('No hay novedades PILA registradas en este período.'),
  ).toBeVisible();
});
