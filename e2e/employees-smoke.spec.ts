import { expect, test } from '@playwright/test';
import { createSede } from './helpers/create-sede';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

test('registra, busca, edita, desactiva e importa empleados desde la UI', async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now().toString().slice(-7)}${testInfo.retry}`;
  const nit = `8${suffix}`;
  const email = `employees-e2e-${suffix}@example.test`;
  const password = 'E2e-password-123!';
  const cedula = `E2E${suffix}`;

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('Empleados E2E');
  await page.getByLabel('Razón social').fill('Empleados E2E S.A.S.');
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

  await createSede(page, 'Sede Principal');
  await page.goto('/empleados');
  await expect(page.getByRole('heading', { name: 'Empleados' })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo empleado', exact: true }).first().click();

  const createDialog = page.getByRole('dialog', { name: 'Nuevo empleado' });
  await createDialog.locator('[name="cedula"]').fill(cedula);
  await createDialog.locator('[name="primerNombre"]').fill('Andrea');
  await createDialog.locator('[name="primerApellido"]').fill('Prueba');
  await createDialog.locator('[name="cargo"]').fill('Docente E2E');
  await createDialog.locator('[name="salario"]').fill('2500000');
  await createDialog.locator('[name="sedeId"]').selectOption({ label: 'Sede Principal' });
  await createDialog.getByRole('button', { name: 'Crear empleado', exact: true }).click();

  const search = page.locator('input[aria-label="Buscar empleados"]');
  const employeeRow = () => page.getByRole('row').filter({ hasText: cedula });
  await expect(employeeRow()).toContainText('Andrea Prueba');

  await search.fill(cedula);
  await expect(employeeRow()).toBeVisible();

  await employeeRow().getByRole('button', { name: 'Editar', exact: true }).click();
  const editDialog = page.getByRole('dialog', { name: 'Editar empleado' });
  await editDialog.locator('[name="cargo"]').fill('Coordinadora E2E');
  await editDialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(employeeRow()).toContainText('Coordinadora E2E');

  const employeeDetailLink = employeeRow().getByRole('link', {
    name: 'Ver detalle de Andrea Prueba',
  });
  const employeeDetailPath = await employeeDetailLink.getAttribute('href');
  expect(employeeDetailPath).toBeTruthy();
  const employeeId = employeeDetailPath!.split('/').pop()!;
  await employeeDetailLink.click();
  await expect(page).toHaveURL(new RegExp(`/empleados/.+`));
  await expect(
    page.getByRole('heading', { name: 'Afiliaciones de seguridad social' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Registrar afiliación' }).click();

  const affiliationForm = page.locator('form').filter({
    has: page.getByRole('heading', { name: 'Nueva afiliación' }),
  });
  await affiliationForm.getByRole('combobox', { name: /^Tipo de cotizante/ }).selectOption('01');
  await expect(affiliationForm.getByLabel('Subtipo de cotizante')).toBeRequired();
  await affiliationForm.getByLabel('Subtipo de cotizante').fill('00');
  await affiliationForm.getByLabel('Vigente desde').fill('2026-01-01');
  await affiliationForm.getByLabel('Código EPS').fill('EPS001');
  await affiliationForm.getByLabel('Nombre EPS').fill('EPS Demo');
  await affiliationForm.getByLabel('Código Fondo de pensión').fill('AFP001');
  await affiliationForm.getByLabel('Nombre Fondo de pensión').fill('Fondo Demo');
  await affiliationForm.getByLabel('Código ARL').fill('ARL001');
  await affiliationForm.getByLabel('Nombre ARL').fill('ARL Demo');
  await affiliationForm.getByLabel('Clase de riesgo ARL').selectOption('1');
  await affiliationForm.getByLabel('Código Caja de compensación').fill('CCF001');
  await affiliationForm.getByLabel('Nombre Caja de compensación').fill('Caja Demo');
  await affiliationForm.getByRole('button', { name: 'Guardar afiliación' }).click();

  await expect(page.getByText('EPS Demo')).toBeVisible();

  await page.getByRole('button', { name: 'Registrar afiliación' }).click();
  const replacementForm = page.locator('form').filter({
    has: page.getByRole('heading', { name: 'Nueva afiliación' }),
  });
  await replacementForm.getByRole('combobox', { name: 'Tipo de cotizante' }).selectOption('01');
  await replacementForm.getByLabel('Subtipo de cotizante').fill('00');
  await replacementForm.getByLabel('Vigente desde').fill('2026-04-01');
  await replacementForm.getByLabel('Código EPS').fill('EPS002');
  await replacementForm.getByLabel('Nombre EPS').fill('EPS Nueva');
  await replacementForm.getByLabel('Código Fondo de pensión').fill('AFP001');
  await replacementForm.getByLabel('Nombre Fondo de pensión').fill('Fondo Demo');
  await replacementForm.getByLabel('Código ARL').fill('ARL001');
  await replacementForm.getByLabel('Nombre ARL').fill('ARL Demo');
  await replacementForm.getByRole('combobox', { name: 'Clase de riesgo ARL' }).selectOption('1');
  await replacementForm.getByLabel('Código Caja de compensación').fill('CCF001');
  await replacementForm.getByLabel('Nombre Caja de compensación').fill('Caja Demo');
  await replacementForm.getByRole('button', { name: 'Guardar afiliación' }).click();

  await expect(page.getByText('EPS Nueva')).toBeVisible();
  const previousAffiliation = page.getByRole('listitem').filter({ hasText: 'EPS Demo' });
  await expect(previousAffiliation).toHaveCount(1);
  await expect(previousAffiliation).not.toContainText('Sin fecha final');
  const currentAffiliation = page.getByRole('listitem').filter({ hasText: 'EPS Nueva' });
  await expect(currentAffiliation).toContainText('Sin fecha final');
  await page.getByRole('button', { name: 'Finalizar vigencia' }).click();
  await page.getByLabel('Válida hasta').fill('2026-06-30');
  await page.getByRole('button', { name: 'Guardar fecha' }).click();
  await expect(currentAffiliation).not.toContainText('Sin fecha final');
  await expect(page.getByRole('button', { name: 'Finalizar vigencia' })).toHaveCount(0);

  const pilaWorkPanel = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Centro de trabajo y actividad PILA' }),
  });
  await expect(pilaWorkPanel).toBeVisible();
  await pilaWorkPanel.getByRole('button', { name: 'Crear centro ARL' }).click();
  const centerForm = pilaWorkPanel.locator('form').filter({
    has: page.getByRole('heading', { name: 'Nuevo centro declarado a la ARL' }),
  });
  await centerForm.getByLabel('Código ARL').fill('ARL001');
  await centerForm.getByLabel('Código del centro').fill('E2E-001');
  await centerForm.getByLabel('Nombre del centro').fill('Centro ARL E2E');
  await centerForm.getByLabel('Sede relacionada (opcional)').selectOption({
    label: 'Sede Principal',
  });
  const createCenterResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/pila-centros-trabajo' &&
      response.request().method() === 'POST',
  );
  await centerForm.getByRole('button', { name: 'Guardar centro' }).click();
  const createCenterResponse = await createCenterResponsePromise;
  expect(createCenterResponse.status()).toBe(200);
  const workCenter = (await createCenterResponse.json()) as { id: string };

  await pilaWorkPanel.getByLabel('Centro de trabajo ARL').selectOption(workCenter.id);
  await pilaWorkPanel.getByLabel('Actividad económica de riesgos').fill('1131202');
  await pilaWorkPanel.getByRole('textbox', { name: 'Vigente desde' }).fill('2026-01-01');
  const createAssignmentResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/employees/${employeeId}/asignaciones-centro-pila` &&
      response.request().method() === 'POST',
  );
  await pilaWorkPanel.getByRole('button', { name: 'Guardar asignación' }).click();
  const createAssignmentResponse = await createAssignmentResponsePromise;
  expect(createAssignmentResponse.status()).toBe(200);
  const assignment = (await createAssignmentResponse.json()) as { id: string };
  const workAssignment = pilaWorkPanel.getByRole('listitem').filter({ hasText: 'Centro ARL E2E' });
  await expect(workAssignment).toContainText('1131202');
  await expect(workAssignment).toContainText('Sede Principal');

  await page.reload();
  const persistedWorkAssignment = page
    .locator('section')
    .filter({
      has: page.getByRole('heading', { name: 'Centro de trabajo y actividad PILA' }),
    })
    .getByRole('listitem')
    .filter({ hasText: 'Centro ARL E2E' });
  await expect(persistedWorkAssignment).toContainText('1131202');
  await expect(persistedWorkAssignment).toContainText('Sin fecha final');
  const closeWorkAssignmentResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/employees/${employeeId}/asignaciones-centro-pila/${assignment.id}` &&
      response.request().method() === 'PATCH',
  );
  const persistedPilaWorkPanel = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Centro de trabajo y actividad PILA' }),
  });
  await persistedPilaWorkPanel.getByRole('button', { name: 'Finalizar vigencia' }).click();
  await persistedPilaWorkPanel.getByLabel('Válida hasta').fill('2026-12-31');
  await persistedPilaWorkPanel.getByRole('button', { name: 'Guardar fecha' }).click();
  const closeWorkAssignmentResponse = await closeWorkAssignmentResponsePromise;
  expect(closeWorkAssignmentResponse.status()).toBe(200);
  await expect(persistedWorkAssignment).not.toContainText('Sin fecha final');

  await page.goto('/empleados');
  await search.fill(cedula);
  await expect(employeeRow()).toContainText('Coordinadora E2E');

  await employeeRow().getByRole('button', { name: 'Desactivar', exact: true }).click();
  const deleteDialog = page.getByRole('alertdialog');
  await deleteDialog.getByRole('button', { name: 'Desactivar empleado', exact: true }).click();
  await expect(employeeRow()).toHaveCount(0);

  const templateResponse = await page.evaluate(async () => {
    const response = await fetch('/api/employees/import/template');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type'),
      base64: btoa(binary),
    };
  });
  expect(templateResponse.ok, `template request failed: ${templateResponse.status}`).toBe(true);
  expect(templateResponse.contentType).toContain(XLSX_MIME);
  const templateBuffer = Buffer.from(templateResponse.base64, 'base64');

  await search.fill('');
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  const importDialog = page.getByRole('dialog', { name: 'Importar empleados' });
  await importDialog.locator('input[type="file"]').setInputFiles({
    name: 'plantilla_empleados.xlsx',
    mimeType: XLSX_MIME,
    buffer: templateBuffer,
  });
  await importDialog.getByRole('button', { name: 'Importar', exact: true }).click();

  await expect(importDialog.getByRole('status')).toContainText('1 empleado');
  await expect(page.getByText('12345678', { exact: true })).toBeVisible();
});
