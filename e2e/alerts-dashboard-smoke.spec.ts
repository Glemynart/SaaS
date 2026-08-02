import { expect, test } from '@playwright/test';

test('muestra y resuelve una alerta desde la bandeja del dashboard', async ({ page }, testInfo) => {
  const suffix = `${Date.now().toString().slice(-7)}${testInfo.retry}`;
  const nit = `4${suffix}`;
  const email = `alerts-dashboard-e2e-${suffix}@example.test`;
  const password = 'E2e-password-123!';
  const cedula = `ALERTA${suffix}`;

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel(/gito/).fill('1');
  await page.getByLabel('Nombre comercial').fill('Alertas E2E');
  await page.getByLabel(/Raz.*n social/).fill('Alertas E2E S.A.S.');
  await page.getByLabel('Nombre administrador').fill('Laura');
  await page.getByLabel('Apellido').fill('Gomez');
  await page.getByLabel('Correo administrador').fill(email);
  await page.getByRole('textbox', { name: /Contrase.*a/ }).fill(password);
  await page.getByRole('button', { name: 'Crear empresa' }).click();

  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await page.getByLabel('NIT de la empresa').fill(nit);
  await page.getByLabel('Correo').fill(email);
  await page.getByRole('textbox', { name: /Contrase.*a/ }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/empleados');
  await page.getByRole('button', { name: 'Nuevo empleado', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo empleado' });
  await dialog.locator('[name="cedula"]').fill(cedula);
  await dialog.locator('[name="primerNombre"]').fill('Andrea');
  await dialog.locator('[name="primerApellido"]').fill('Alerta');
  await dialog.locator('[name="cargo"]').fill('Docente E2E');
  await dialog.locator('[name="salario"]').fill('2500000');
  await dialog.getByRole('button', { name: 'Crear empleado', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: cedula })).toContainText('Andrea Alerta');

  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  const resolveButton = page.getByRole('button', {
    name: 'Resolver alerta de Andrea Alerta',
  });
  await expect(resolveButton).toBeVisible();
  await resolveButton.click();
  await expect(resolveButton).toHaveCount(0);

  await page.goto('/alertas');
  await page.locator('select').first().selectOption('RESOLVED');
  await expect(page.getByText('Resuelta', { exact: true })).toBeVisible();
  await expect(page.getByText(/Resuelta el/)).toBeVisible();
});
