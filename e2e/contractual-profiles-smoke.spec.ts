import { expect, test } from '@playwright/test';

test('crea un perfil contractual y lo vincula a un empleado desde la UI', async ({ page }) => {
  const suffix = Date.now().toString().slice(-8);
  const nit = `7${suffix}`;
  const email = `contractual-profiles-e2e-${suffix}@example.test`;
  const password = 'E2e-password-123!';
  const cedula = `E3E2${suffix}`;
  const profileCode = `E3E2_${suffix}`;
  const profileName = 'Docente E2E';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel(/D.gito/).fill('1');
  await page.getByLabel('Nombre comercial').fill('Perfiles E2E');
  await page.getByLabel(/Raz.n social/).fill('Perfiles E2E S.A.S.');
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

  await page.goto('/documentos/configuracion');
  await expect(page.getByRole('heading', { name: /Configuraci.n documental/ })).toBeVisible();
  await expect(
    page.getByText(/Para crear una regla necesitas al menos un perfil contractual activo/),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Crear perfil contractual' })).toHaveAttribute(
    'href',
    '/perfiles-contractuales',
  );
  await expect(page.getByRole('link', { name: 'Crear plantilla' })).toHaveAttribute(
    'href',
    '/documentos/plantillas',
  );

  await page.goto('/perfiles-contractuales');
  await expect(page.getByRole('heading', { name: 'Perfiles contractuales' })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo perfil contractual', exact: true }).click();

  const profileDialog = page.getByRole('dialog', { name: 'Nuevo perfil contractual' });
  await profileDialog.locator('[name="codigo"]').fill(profileCode);
  await profileDialog.locator('[name="nombre"]').fill(profileName);
  await profileDialog.locator('[name="descripcion"]').fill('Perfil creado durante E3.2.');
  await profileDialog.getByRole('button', { name: 'Crear perfil', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: profileCode })).toContainText(profileName);

  await page.goto('/empleados');
  await page.getByRole('button', { name: 'Nuevo empleado', exact: true }).click();

  const employeeDialog = page.getByRole('dialog', { name: 'Nuevo empleado' });
  await employeeDialog.locator('[name="cedula"]').fill(cedula);
  await employeeDialog.locator('[name="primerNombre"]').fill('Andrea');
  await employeeDialog.locator('[name="primerApellido"]').fill('E3E2');
  await employeeDialog.locator('[name="cargo"]').fill('Docente E2E');
  await employeeDialog.locator('[name="salario"]').fill('2500000');
  await employeeDialog.getByRole('button', { name: 'Crear empleado', exact: true }).click();

  const employeeRow = page.getByRole('row').filter({ hasText: cedula });
  await expect(employeeRow).toContainText('Andrea E3E2');
  await employeeRow.getByRole('link', { name: /Ver detalle/ }).click();

  await expect(page.getByRole('heading', { name: 'Vínculo laboral' })).toBeVisible();
  await page
    .getByLabel('Perfil contractual')
    .selectOption({ label: `${profileName} (${profileCode})` });
  await page.getByRole('button', { name: 'Guardar vínculo', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Actualizar vínculo', exact: true })).toBeVisible();
  await expect(page.getByLabel('Perfil contractual')).toContainText(profileName);

  await page.goto('/documentos/plantillas');
  await page.getByRole('button', { name: /Plantillas base/ }).click();
  const seedDialog = page.getByRole('alertdialog');
  await seedDialog.getByRole('button', { name: /Crear plantillas base/ }).click();
  await expect(page.getByText(/Contrato laboral/).first()).toBeVisible();

  await page.goto('/documentos/configuracion');
  await expect(page.getByRole('heading', { name: /Configuraci.n documental/ })).toBeVisible();
  await page
    .getByRole('button', { name: /Nueva configuraci.n/ })
    .first()
    .click();

  const configurationDialog = page.getByRole('dialog', { name: /Nueva configuraci.n documental/ });
  await configurationDialog
    .getByLabel('Perfil contractual')
    .selectOption({ label: `${profileName} (${profileCode})` });
  const templateSelect = configurationDialog.getByLabel('Plantilla');
  const templateValue = await templateSelect
    .locator('option')
    .filter({ hasText: /Contrato laboral/ })
    .first()
    .getAttribute('value');
  expect(templateValue).toBeTruthy();
  await templateSelect.selectOption(templateValue!);
  await configurationDialog.getByRole('button', { name: /Crear configuraci.n/ }).click();

  const initialConfigurationRow = page.getByRole('row').filter({ hasText: profileName });
  await expect(initialConfigurationRow).toContainText(/Contrato laboral/);
  await expect(initialConfigurationRow).toContainText('Activa');

  await page.goto('/contratos/lotes');
  await page.getByRole('button', { name: 'Nuevo lote', exact: true }).click();

  const loteDialog = page.getByRole('dialog', { name: 'Nuevo lote' });
  await loteDialog.getByLabel('Tipo de operación').selectOption({ label: 'Campaña inteligente' });
  await loteDialog.getByLabel('Nombre del lote').fill('Campaña inteligente E4.1');
  await loteDialog.locator('input[type="checkbox"]').first().check();
  await loteDialog.getByRole('button', { name: 'Crear campaña', exact: true }).click();

  await expect(page).toHaveURL(/\/contratos\/lotes\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: 'Resolución de campaña' })).toBeVisible();
  await page.getByRole('button', { name: 'Previsualizar resolución', exact: true }).click();
  await expect(page.getByText('1 resueltos', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar resolución', exact: true }).click();
  await expect(page.getByText(/Confirmación total guardada/)).toBeVisible();
  await page.getByRole('button', { name: 'Procesar', exact: true }).click();
  await expect(page.getByText('Completado', { exact: true })).toBeVisible();
  await expect(
    page.locator('dt').filter({ hasText: 'Procesados' }).locator('xpath=following-sibling::dd[1]'),
  ).toHaveText('1');

  await page.goto('/documentos/configuracion');
  await expect(page.getByRole('heading', { name: /Configuraci.n documental/ })).toBeVisible();
  const configurationRow = page.getByRole('row').filter({ hasText: profileName });
  await expect(configurationRow).toContainText('Activa');
  await configurationRow.getByRole('button', { name: 'Editar', exact: true }).click();
  const editDialog = page.getByRole('dialog', { name: /Editar configuraci.n documental/ });
  await editDialog.locator('input[type="checkbox"]').uncheck();
  await editDialog.getByRole('button', { name: /Guardar configuraci.n/ }).click();
  await expect(configurationRow).toContainText('Inactiva');
});
