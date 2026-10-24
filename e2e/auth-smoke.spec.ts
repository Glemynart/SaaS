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

test('sends fragment reset tokens only in the POST body, not in request URLs', async ({ page }) => {
  const token = 'RESET_TOKEN_FRAGMENT_SENTINEL+/?=';
  const requestUrls: string[] = [];
  let submittedToken: string | undefined;
  let submittedReferer: string | undefined;

  page.on('request', (request) => requestUrls.push(request.url()));
  await page.route('**/api/auth/reset-password', async (route) => {
    submittedToken = route.request().postDataJSON().token;
    submittedReferer = route.request().headers().referer;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Contraseña actualizada exitosamente.' }),
    });
  });

  const response = await page.goto(`/restablecer#token=${encodeURIComponent(token)}`);
  expect(response?.headers()['referrer-policy']).toBe('no-referrer');
  expect(await response?.text()).not.toContain(token);
  await expect(page.getByLabel('Contraseña nueva')).toBeVisible();
  expect(requestUrls.some((url) => url.includes('token='))).toBe(false);

  await page.getByLabel('Contraseña nueva').fill('Replacement-password-123!');
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();

  await expect(page).toHaveURL(/\/login\?reset=1$/);
  expect(submittedToken).toBe(token);
  expect(submittedReferer).toBeUndefined();
  expect(requestUrls.some((url) => url.includes(token))).toBe(false);
});

test('keeps existing reset query links usable by converting them to a fragment', async ({
  page,
}) => {
  const token = 'RESET_TOKEN_LEGACY+/?=';
  let submittedToken: string | undefined;
  await page.route('**/api/auth/reset-password', async (route) => {
    submittedToken = route.request().postDataJSON().token;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Contraseña actualizada exitosamente.' }),
    });
  });

  const response = await page.goto(`/reset-password?token=${token}`);
  expect(response?.status()).toBe(200);
  expect(response?.headers()['referrer-policy']).toBe('no-referrer');
  expect(await response?.text()).not.toContain(token);

  await expect(page.getByLabel('Contraseña nueva')).toBeVisible();
  await expect.poll(() => new URL(page.url()).search).toBe('');
  expect(new URL(page.url()).hash).toBe(`#${new URLSearchParams({ token }).toString()}`);

  await page.getByLabel('Contraseña nueva').fill('Replacement-password-123!');
  await page.getByRole('button', { name: 'Guardar y continuar' }).click();

  await expect(page).toHaveURL(/\/login\?reset=1$/);
  expect(submittedToken).toBe(token);
});
