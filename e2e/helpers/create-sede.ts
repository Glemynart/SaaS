import { expect, type Page } from '@playwright/test';

export async function createSede(page: Page, nombre: string) {
  await page.goto('/sedes');
  await expect(page.getByRole('heading', { name: 'Sedes' })).toBeVisible();
  await page.getByRole('button', { name: 'Nueva sede', exact: true }).first().click();

  const dialog = page.getByRole('dialog', { name: 'Nueva sede' });
  await dialog.locator('[name="nombre"]').fill(nombre);
  const municipioSelect = dialog.locator('[name="municipioId"]');
  const municipioValue = await municipioSelect.locator('option').nth(1).getAttribute('value');
  expect(municipioValue).toBeTruthy();
  await municipioSelect.selectOption(municipioValue!);
  await dialog.getByRole('button', { name: 'Crear sede', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: nombre })).toContainText(nombre);
}
