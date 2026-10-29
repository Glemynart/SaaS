import { expect, test, type Page } from '@playwright/test';

type GeneratedDocumentType = 'LETTER' | 'MEMO';

async function expectGeneratedPdfDownloadFromExpediente(
  page: Page,
  employeeId: string,
  type: GeneratedDocumentType,
  expectedName: string,
) {
  await page.goto(`/empleados/${employeeId}`);

  const expedienteResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith(`/api/employees/${employeeId}/expediente`),
  );
  await page.getByRole('link', { name: 'Expediente', exact: true }).click();
  const expedienteResponse = await expedienteResponsePromise;
  expect(expedienteResponse.ok()).toBeTruthy();

  const expediente = (await expedienteResponse.json()) as {
    docs: Array<{
      nombre: string;
      tamanoBytes: number;
      generatedDocument: { tipo: string } | null;
    }>;
  };
  const indexedDocuments = expediente.docs.filter(
    (document) => document.nombre === expectedName && document.generatedDocument?.tipo === type,
  );
  expect(indexedDocuments).toHaveLength(1);
  const indexedDocument = indexedDocuments[0];
  if (!indexedDocument) {
    throw new Error(`El documento ${type} no apareció en el expediente del empleado.`);
  }
  expect(indexedDocument.tamanoBytes).toBeGreaterThan(0);

  const documentRow = page.getByRole('row').filter({ hasText: expectedName });
  await expect(documentRow).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await documentRow.getByRole('button', { name: `Descargar ${expectedName}` }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`${expectedName}.pdf`);

  const downloadStream = await download.createReadStream();
  if (!downloadStream) {
    throw new Error('No se pudo leer el PDF descargado desde el expediente.');
  }

  const downloadedChunks: Buffer[] = [];
  for await (const chunk of downloadStream) {
    downloadedChunks.push(Buffer.from(chunk));
  }
  const downloadedPdf = Buffer.concat(downloadedChunks);
  expect(downloadedPdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  expect(downloadedPdf.length).toBe(indexedDocument.tamanoBytes);
}

test('genera LETTER y MEMO y los descarga desde el expediente del empleado', async ({ page }) => {
  const suffix = Date.now().toString().slice(-8);
  const nit = `5${suffix}`;
  const email = `generated-documents-e2e-${suffix}@example.test`;
  const password = 'E2e-password-123!';
  const cedula = `E5E2${suffix}`;

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel(/D.gito/).fill('1');
  await page.getByLabel('Nombre comercial').fill('Documentos generados E2E');
  await page.getByLabel(/Raz.n social/).fill('Documentos generados E2E S.A.S.');
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

  await page.goto('/empleados');
  await page.getByRole('button', { name: 'Nuevo empleado', exact: true }).first().click();
  const employeeDialog = page.getByRole('dialog', { name: 'Nuevo empleado' });
  await employeeDialog.locator('[name="cedula"]').fill(cedula);
  await employeeDialog.locator('[name="primerNombre"]').fill('Andrea');
  await employeeDialog.locator('[name="primerApellido"]').fill('Documentos');
  await employeeDialog.locator('[name="cargo"]').fill('Docente E2E');
  await employeeDialog.locator('[name="salario"]').fill('2500000');
  await employeeDialog.getByRole('button', { name: 'Crear empleado', exact: true }).click();

  const employeeRow = page.getByRole('row').filter({ hasText: cedula });
  await expect(employeeRow).toContainText('Andrea Documentos');
  const employeeHref = await employeeRow
    .getByRole('link', { name: /Ver detalle/ })
    .getAttribute('href');
  const employeeId = employeeHref?.match(/\/empleados\/([^/]+)$/)?.[1];
  if (!employeeId) {
    throw new Error('No se pudo identificar el empleado de la prueba.');
  }

  await page.goto('/documentos/plantillas');
  await page.getByRole('button', { name: /Plantillas base/ }).click();
  const seedDialog = page.getByRole('alertdialog');
  await seedDialog.getByRole('button', { name: /Crear plantillas base/ }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Carta formal' })).toContainText(
    'Carta formal',
  );
  await expect(page.getByRole('row').filter({ hasText: 'Memorando interno' })).toContainText(
    'Memorando interno',
  );

  const generatedDocuments = [
    { type: 'LETTER', template: 'Carta formal', name: `Carta E2E ${suffix}` },
    { type: 'MEMO', template: 'Memorando interno', name: `Memo E2E ${suffix}` },
  ] as const;

  for (const document of generatedDocuments) {
    await page.goto(`/empleados/${employeeId}`);
    await page.getByRole('button', { name: 'Generar documento', exact: true }).click();
    const generateDialog = page.getByRole('dialog', { name: 'Generar documento' });
    await generateDialog.getByRole('radio', { name: new RegExp(document.template) }).click();
    await generateDialog.getByLabel('Nombre del documento').fill(document.name);

    const generateResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/api/generated-documents/generate'),
    );
    await generateDialog.getByRole('button', { name: 'Generar documento', exact: true }).click();
    const generateResponse = await generateResponsePromise;
    expect(generateResponse.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/documentos\/generados\/[0-9a-f-]+$/);

    const generatedDocumentId = new URL(page.url()).pathname.match(
      /\/documentos\/generados\/([^/]+)$/,
    )?.[1];
    if (!generatedDocumentId) {
      throw new Error(`No se pudo identificar el documento ${document.type}.`);
    }

    const pdfGenerationResults = await page.evaluate(async (path) => {
      return Promise.all(
        [0, 1].map(async () => {
          const response = await fetch(path, { method: 'POST' });
          const responseBody = await response.text();
          let id: string | undefined;
          try {
            id = (JSON.parse(responseBody) as { id?: string }).id;
          } catch {
            // The assertion below includes the response body on failures.
          }
          return { status: response.status, id, responseBody };
        }),
      );
    }, `/api/generated-documents/${generatedDocumentId}/generate-pdf`);
    expect(pdfGenerationResults).toHaveLength(2);
    for (const result of pdfGenerationResults) {
      expect(result.status, result.responseBody).toBeGreaterThanOrEqual(200);
      expect(result.status, result.responseBody).toBeLessThan(300);
      expect(result.id).toBe(generatedDocumentId);
    }

    await page.reload();
    await expect(page.getByRole('button', { name: 'Descargar PDF', exact: true })).toBeVisible();

    await expectGeneratedPdfDownloadFromExpediente(page, employeeId, document.type, document.name);
  }
});
