import { expect, test } from '@playwright/test';

test('registers an organization and reaches the authenticated dashboard', async ({ page }) => {
  const health = await page.request.get('http://127.0.0.1:4000/health');
  expect(health.ok()).toBe(true);
  expect(health.headers()['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

  const suffix = Date.now().toString().slice(-8);
  const nit = `9${suffix}`;
  const email = `e2e-${suffix}@example.test`;
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await expect(page.getByRole('heading', { name: 'Registra tu empresa' })).toBeVisible();

  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('Oficina E2E');
  await page.getByLabel('Razón social').fill('Oficina E2E S.A.S.');
  await page.getByLabel('Nombre administrador').fill('Laura');
  await page.getByLabel('Apellido').fill('Gómez');
  await page.getByLabel('Correo administrador').fill(email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);
  await page.getByRole('button', { name: 'Crear empresa' }).click();

  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await expect(page.getByRole('status')).toContainText('Tu empresa quedó registrada');

  await page.getByLabel('NIT de la empresa').fill(nit);
  await page.getByLabel('Correo').fill(email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(/Hola, Laura\./)).toBeVisible();
});
