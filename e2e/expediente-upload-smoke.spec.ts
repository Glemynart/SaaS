import { expect, test } from '@playwright/test';
import { createSede } from './helpers/create-sede';

test('sube un documento manual al expediente de un empleado desde la UI', async ({ page }) => {
  const suffix = Date.now().toString().slice(-8);
  const nit = `6${suffix}`;
  const email = `expediente-e2e-${suffix}@example.test`;
  const password = 'E2e-password-123!';
  const cedula = `E5E1${suffix}`;

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel(/D.gito/).fill('1');
  await page.getByLabel('Nombre comercial').fill('Expedientes E2E');
  await page.getByLabel(/Raz.n social/).fill('Expedientes E2E S.A.S.');
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

  const sedeName = `Sede expedientes ${suffix}`;
  await createSede(page, sedeName);
  await page.goto('/empleados');
  await page.getByRole('button', { name: 'Nuevo empleado', exact: true }).first().click();
  const employeeDialog = page.getByRole('dialog', { name: 'Nuevo empleado' });
  await employeeDialog.locator('[name="cedula"]').fill(cedula);
  await employeeDialog.locator('[name="primerNombre"]').fill('Andrea');
  await employeeDialog.locator('[name="primerApellido"]').fill('Expediente');
  await employeeDialog.locator('[name="cargo"]').fill('Docente E2E');
  await employeeDialog.locator('[name="salario"]').fill('2500000');
  await employeeDialog.locator('[name="sedeId"]').selectOption({ label: sedeName });
  await employeeDialog.getByRole('button', { name: 'Crear empleado', exact: true }).click();

  const employeeRow = page.getByRole('row').filter({ hasText: cedula });
  await expect(employeeRow).toContainText('Andrea Expediente');
  await employeeRow.getByRole('link', { name: /Ver detalle/ }).click();
  await page.getByRole('link', { name: 'Expediente', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Expediente digital' })).toBeVisible();
  await page.getByRole('button', { name: 'Subir documento', exact: true }).first().click();
  const uploadDialog = page.getByRole('dialog', { name: 'Subir documento' });
  await uploadDialog.locator('input[type="file"]').setInputFiles({
    name: 'cedula.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nexpediente e2e'),
  });
  await uploadDialog.locator('#expediente-category').selectOption('DOCUMENTO_PERSONAL');
  await uploadDialog.getByLabel('Categoría').selectOption('DOCUMENTO_PERSONAL');
  await uploadDialog.getByRole('button', { name: 'Subir documento', exact: true }).click();

  await expect(page.getByRole('row').filter({ hasText: 'cedula.pdf' })).toContainText(
    'Documento personal',
  );

  const firstRevisionRow = page.getByRole('row').filter({ hasText: 'cedula.pdf' });
  await expect(firstRevisionRow).toContainText('v1');

  await firstRevisionRow.getByRole('button').nth(2).click();
  const revisionDialog = page.getByRole('dialog').filter({ has: page.locator('#expediente-file') });
  await expect(revisionDialog).toBeVisible();
  await revisionDialog.locator('input[type="file"]').setInputFiles({
    name: 'cedula-actualizada.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nexpediente e2e revision 2'),
  });
  await revisionDialog.locator('button').last().click();

  const currentRevisionRow = page.getByRole('row').filter({ hasText: 'cedula-actualizada.pdf' });
  await expect(currentRevisionRow).toContainText('v2');

  await currentRevisionRow.getByRole('button').first().click();
  const historyDialog = page.getByRole('dialog', { name: 'Historial documental' });
  await expect(historyDialog).toContainText('v2');
  await expect(historyDialog).toContainText('v1');

  await historyDialog.getByRole('button', { name: 'Cerrar' }).click();
  const downloadPromise = page.waitForEvent('download');
  await currentRevisionRow.getByRole('button').nth(1).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('cedula-actualizada.pdf');
});
