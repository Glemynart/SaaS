import { expect, test } from '@playwright/test';

test('crea, edita, desactiva y reactiva un usuario desde la UI', async ({ page }, testInfo) => {
  const suffix = `${Date.now().toString().slice(-7)}${testInfo.retry}`;
  const nit = `5${suffix}`;
  const adminEmail = `users-admin-${suffix}@example.test`;
  const operatorEmail = `users-operator-${suffix}@example.test`;
  const adminPassword = 'E2e-password-123!';
  const operatorPassword = 'Operator-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel(/D.gito/).fill('1');
  await page.getByLabel('Nombre comercial').fill('Usuarios E2E');
  await page.getByLabel(/Raz.n social/).fill('Usuarios E2E S.A.S.');
  await page.getByLabel('Nombre administrador').fill('Laura');
  await page.getByLabel(/Apellido/).fill('Gomez');
  await page.getByLabel('Correo administrador').fill(adminEmail);
  await page.getByRole('textbox', { name: /Contrase.a/ }).fill(adminPassword);
  await page.getByRole('button', { name: 'Crear empresa' }).click();

  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await page.getByLabel('NIT de la empresa').fill(nit);
  await page.getByLabel('Correo').fill(adminEmail);
  await page.getByRole('textbox', { name: /Contrase.a/ }).fill(adminPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/usuarios');
  await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo usuario', exact: true }).first().click();

  const createDialog = page.getByRole('dialog', { name: 'Nuevo usuario' });
  await createDialog.getByLabel('Correo').fill(operatorEmail);
  await createDialog.getByLabel('Nombre').fill('Mateo');
  await createDialog.getByLabel('Apellido').fill('Operador');
  await createDialog.getByLabel('Contraseña inicial').fill(operatorPassword);
  await createDialog.getByLabel('Rol').selectOption('OPERADOR');
  await createDialog.getByRole('button', { name: 'Crear usuario', exact: true }).click();

  const userRow = () => page.getByRole('row').filter({ hasText: operatorEmail });
  await expect(userRow()).toContainText('Mateo Operador');
  await expect(userRow()).toContainText('Operador');
  await expect(userRow()).toContainText('Activo');

  await userRow().getByRole('button', { name: 'Editar', exact: true }).click();
  const editDialog = page.getByRole('dialog', { name: 'Editar usuario' });
  await editDialog.getByLabel('Nombre').fill('Mateo Editado');
  await editDialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(userRow()).toContainText('Mateo Editado');

  await userRow().getByRole('button', { name: 'Desactivar', exact: true }).click();
  const confirmDialog = page.getByRole('alertdialog', { name: 'Desactivar usuario' });
  await confirmDialog.getByRole('button', { name: 'Desactivar usuario', exact: true }).click();
  await expect(userRow()).toContainText('Inactivo');

  await userRow().getByRole('button', { name: 'Activar', exact: true }).click();
  await expect(userRow()).toContainText('Activo');

  const menuTriggers = page.getByRole('button', { name: 'Menú de usuario' });
  await menuTriggers.last().click();
  await page.getByRole('menuitem', { name: /Cerrar sesi.n/ }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('NIT de la empresa').fill(nit);
  await page.getByLabel('Correo').fill(operatorEmail);
  await page.getByRole('textbox', { name: /Contrase.a/ }).fill(operatorPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(/Hola, Mateo Editado\./)).toBeVisible();
});
