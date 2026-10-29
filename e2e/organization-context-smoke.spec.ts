import { expect, test } from '@playwright/test';

test('configura sedes e identidad corporativa dentro del tenant autenticado', async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now().toString().slice(-7)}${testInfo.retry}`;
  const nit = `2${suffix}`;
  const email = `organization-context-e2e-${suffix}@example.test`;
  const password = 'E2e-password-123!';
  const sedeName = `Sede E2E ${suffix}`;
  const representante = 'Laura Representante';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel(/D.gito/).fill('1');
  await page.getByLabel('Nombre comercial').fill('Organización E2E');
  await page.getByLabel(/Raz.n social/).fill('Organización E2E S.A.S.');
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

  await page.goto('/sedes');
  await expect(page.getByRole('heading', { name: 'Sedes' })).toBeVisible();
  await page.getByRole('button', { name: 'Nueva sede', exact: true }).click();

  const createSedeDialog = page.getByRole('dialog', { name: 'Nueva sede' });
  await createSedeDialog.locator('[name="nombre"]').fill(sedeName);
  const municipioSelect = createSedeDialog.locator('[name="municipioId"]');
  const municipioValue = await municipioSelect.locator('option').nth(1).getAttribute('value');
  expect(municipioValue).toBeTruthy();
  await municipioSelect.selectOption(municipioValue!);
  await createSedeDialog.locator('[name="direccion"]').fill('Carrera 10 # 20-30');
  await createSedeDialog.getByRole('button', { name: 'Crear sede', exact: true }).click();

  const sedeRow = page.getByRole('row').filter({ hasText: sedeName });
  await expect(sedeRow).toContainText(sedeName);
  await expect(sedeRow).toContainText('Carrera 10 # 20-30');

  await page.goto('/configuracion/identidad');
  await expect(
    page.getByRole('heading', { name: 'Identidad corporativa', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Organización E2E S.A.S.', { exact: true })).toBeVisible();
  await expect(page.getByText(nit, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await page.getByLabel('Nombre completo').fill(representante);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText(representante, { exact: true })).toBeVisible();

  const imageInputs = page.locator('input[type="file"]');
  await expect(imageInputs).toHaveCount(2);
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="blue"/></svg>',
  );
  await imageInputs.nth(0).setInputFiles({
    name: 'logo.svg',
    mimeType: 'image/svg+xml',
    buffer: svg,
  });
  await imageInputs.nth(1).setInputFiles({
    name: 'firma.svg',
    mimeType: 'image/svg+xml',
    buffer: svg,
  });

  await expect(page.getByAltText('Logo')).toBeVisible();
  await expect(page.getByAltText('Firma')).toBeVisible();
  await expect(page.getByText(/Identidad corporativa completa/)).toBeVisible();
});
