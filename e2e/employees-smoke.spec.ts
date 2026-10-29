import { expect, test } from '@playwright/test';

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

  await page.goto('/empleados');
  await expect(page.getByRole('heading', { name: 'Empleados' })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo empleado', exact: true }).first().click();

  const createDialog = page.getByRole('dialog', { name: 'Nuevo empleado' });
  await createDialog.locator('[name="cedula"]').fill(cedula);
  await createDialog.locator('[name="primerNombre"]').fill('Andrea');
  await createDialog.locator('[name="primerApellido"]').fill('Prueba');
  await createDialog.locator('[name="cargo"]').fill('Docente E2E');
  await createDialog.locator('[name="salario"]').fill('2500000');
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
