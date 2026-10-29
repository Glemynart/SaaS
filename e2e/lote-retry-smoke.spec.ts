import { expect, test, type Page } from '@playwright/test';

type LotePayload = {
  id: string;
  estado: string;
  total: number;
  procesados: number;
  fallidos: number;
  erroresLog: Array<{ empleadoId: string; cedula: string; error: string }>;
  [key: string]: unknown;
};

async function getAuthenticatedJson<T>(page: Page, path: string): Promise<T> {
  const response = await page.evaluate(async (requestPath) => {
    const result = await fetch(requestPath);
    return { ok: result.ok, status: result.status, body: await result.text() };
  }, path);

  expect(response.ok, `${path} respondio ${response.status}: ${response.body}`).toBe(true);
  return JSON.parse(response.body) as T;
}

async function createEmployee(page: Page, cedula: string, firstName: string, lastName: string) {
  await page.goto('/empleados');
  await expect(page.getByRole('heading', { name: 'Empleados' })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo empleado', exact: true }).first().click();

  const dialog = page.getByRole('dialog', { name: 'Nuevo empleado' });
  await dialog.locator('[name="cedula"]').fill(cedula);
  await dialog.locator('[name="primerNombre"]').fill(firstName);
  await dialog.locator('[name="primerApellido"]').fill(lastName);
  await dialog.locator('[name="cargo"]').fill('Docente E4.7');
  await dialog.locator('[name="salario"]').fill('2500000');
  await dialog.getByRole('button', { name: 'Crear empleado', exact: true }).click();

  await expect(page.getByRole('row').filter({ hasText: cedula })).toContainText(
    `${firstName} ${lastName}`,
  );
}

async function createManualLote(
  page: Page,
  name: string,
  templateId: string,
  employeeCedulas: string[],
  selectAllEmployees = false,
) {
  await page.goto('/contratos/lotes');
  await expect(page.getByRole('heading', { name: 'Lotes de contratos' })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo lote', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Nuevo lote' });
  await dialog.getByLabel('Nombre del lote').fill(name);
  await dialog.locator('select').nth(1).selectOption(templateId);

  if (selectAllEmployees) {
    await dialog.getByRole('button', { name: 'Seleccionar todos', exact: true }).click();
    await expect(
      dialog.getByRole('button', { name: 'Deseleccionar todos', exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText(`Empleados (${employeeCedulas.length} seleccionados)`),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Deseleccionar todos', exact: true }).click();
    await expect(
      dialog.getByRole('button', { name: 'Seleccionar todos', exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText('Empleados (0 seleccionados)')).toBeVisible();
    await dialog.getByRole('button', { name: 'Seleccionar todos', exact: true }).click();
    await expect(
      dialog.getByText(`Empleados (${employeeCedulas.length} seleccionados)`),
    ).toBeVisible();
  } else {
    for (const cedula of employeeCedulas) {
      await dialog.locator('label').filter({ hasText: cedula }).locator('input').check();
    }
  }

  await dialog.getByRole('button', { name: 'Crear lote', exact: true }).click();
  await expect(page).toHaveURL(/\/contratos\/lotes\/[0-9a-f-]+$/);

  const id = page.url().match(/\/contratos\/lotes\/([0-9a-f-]+)$/)?.[1];
  expect(id).toBeTruthy();
  return id!;
}

test('demuestra procesamiento exitoso, parcial y reintento desde la UI', async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now().toString().slice(-7)}${testInfo.retry}`;
  const nit = `8${suffix}`;
  const email = `lote-retry-e2e-${suffix}@example.test`;
  const password = 'E2e-password-123!';
  const firstCedula = `E47A${suffix}`;
  const secondCedula = `E47B${suffix}`;

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel(/D.gito/).fill('1');
  await page.getByLabel('Nombre comercial').fill('Lotes E4.7');
  await page.getByLabel(/Raz.n social/).fill('Lotes E4.7 S.A.S.');
  await page.getByLabel('Nombre administrador').fill('Laura');
  await page.getByLabel(/Apellido/).fill('Gomez');
  await page.getByLabel('Correo administrador').fill(email);
  await page.getByRole('textbox', { name: /Contrase.a/ }).fill(password);
  await page.getByRole('button', { name: 'Crear empresa' }).click();

  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await page.getByLabel('NIT de la empresa').fill(nit);
  await page.getByLabel('Correo').fill(email);
  await page.getByRole('textbox', { name: /Contrase.a/ }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await createEmployee(page, firstCedula, 'Andrea', 'Exitoso');
  await createEmployee(page, secondCedula, 'Bruno', 'Reintento');

  await page.goto('/documentos/plantillas');
  await page.getByRole('button', { name: /Plantillas base/ }).click();
  const seedDialog = page.getByRole('alertdialog');
  await seedDialog.getByRole('button', { name: /Crear plantillas base/ }).click();
  await expect(page.getByText(/Contrato laboral/).first()).toBeVisible();

  const templatesBody = await getAuthenticatedJson<{
    data: Array<{ id: string; nombre: string; activo: boolean }>;
  }>(page, '/api/document-templates?tipo=CONTRACT&limit=100');
  const contractTemplate = templatesBody.data.find(
    (template) => /^Contrato laboral/.test(template.nombre) && template.activo,
  );
  expect(
    contractTemplate,
    `plantillas disponibles: ${templatesBody.data.map((template) => `${template.nombre} [${template.activo}]`).join(', ')}`,
  ).toBeDefined();

  const employeesBody = await getAuthenticatedJson<{
    data: Array<{ id: string; cedula: string }>;
  }>(page, '/api/employees?limit=200');
  const firstEmployee = employeesBody.data.find((employee) => employee.cedula === firstCedula);
  const secondEmployee = employeesBody.data.find((employee) => employee.cedula === secondCedula);
  expect(firstEmployee).toBeDefined();
  expect(secondEmployee).toBeDefined();

  const successfulLoteId = await createManualLote(
    page,
    `E4.7 exito ${suffix}`,
    contractTemplate!.id,
    [firstCedula, secondCedula],
    true,
  );
  await page.getByRole('button', { name: 'Procesar', exact: true }).click();
  await expect(page.getByText('Completado', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(
    page.locator('dt').filter({ hasText: 'Procesados' }).locator('xpath=following-sibling::dd[1]'),
  ).toHaveText('2');
  await expect(
    page.locator('dt').filter({ hasText: 'Fallidos' }).locator('xpath=following-sibling::dd[1]'),
  ).toHaveText('0');

  expect(successfulLoteId).toMatch(/^[0-9a-f-]+$/);

  const retryLoteId = await createManualLote(
    page,
    `E4.7 reintento ${suffix}`,
    contractTemplate!.id,
    [firstCedula, secondCedula],
  );
  const pendingLote = await getAuthenticatedJson<LotePayload>(
    page,
    `/api/contracts/lotes/${retryLoteId}`,
  );
  expect(pendingLote.estado).toBe('PENDIENTE');

  const partialLote: LotePayload = {
    ...pendingLote,
    estado: 'COMPLETADO_CON_ERRORES',
    total: 2,
    procesados: 1,
    fallidos: 1,
    erroresLog: [
      {
        empleadoId: secondEmployee!.id,
        cedula: secondCedula,
        error: 'Fallo controlado para evidencia browser',
      },
    ],
    completadoAt: new Date().toISOString(),
  };
  const completedLote: LotePayload = {
    ...partialLote,
    estado: 'COMPLETADO',
    procesados: 2,
    fallidos: 0,
    erroresLog: [],
  };
  let currentLote = pendingLote;

  await page.route(`**/api/contracts/lotes/${retryLoteId}`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentLote),
    });
  });
  await page.route(`**/api/contracts/lotes/${retryLoteId}/process`, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    currentLote = partialLote;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentLote),
    });
  });
  await page.route(`**/api/contracts/lotes/${retryLoteId}/retry`, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    currentLote = completedLote;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentLote),
    });
  });

  await page.reload();
  await expect(page.getByRole('button', { name: 'Procesar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Procesar', exact: true }).click();
  await expect(page.getByText('Completado con errores', { exact: true })).toBeVisible();
  await expect(
    page.locator('dt').filter({ hasText: 'Procesados' }).locator('xpath=following-sibling::dd[1]'),
  ).toHaveText('1');
  await expect(
    page.locator('dt').filter({ hasText: 'Fallidos' }).locator('xpath=following-sibling::dd[1]'),
  ).toHaveText('1');
  await expect(page.getByRole('heading', { name: 'Errores (1)' })).toBeVisible();
  await expect(page.getByText('Fallo controlado para evidencia browser')).toBeVisible();

  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByText('Completado', { exact: true }).first()).toBeVisible();
  await expect(
    page.locator('dt').filter({ hasText: 'Procesados' }).locator('xpath=following-sibling::dd[1]'),
  ).toHaveText('2');
  await expect(
    page.locator('dt').filter({ hasText: 'Fallidos' }).locator('xpath=following-sibling::dd[1]'),
  ).toHaveText('0');
  await expect(page.getByRole('heading', { name: /Errores \(1\)/ })).toHaveCount(0);
});
