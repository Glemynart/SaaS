import { createHash, randomInt } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { seedPilaExportFixture } from './helpers/pila-export-fixture';

async function registerAndSignIn(page: Page) {
  const suffix = randomInt(10_000_000, 100_000_000).toString();
  const nit = '4' + suffix;
  const email = 'pila-export-' + suffix + '@example.test';
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('PILA export E2E');
  await page.getByLabel('Razón social').fill('PILA export E2E S.A.S.');
  await page.getByLabel('Nombre administrador').fill('Laura');
  await page.getByLabel('Apellido').fill('Gómez');
  await page.getByLabel('Correo administrador').fill(email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);

  const registrationResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/auth/register' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear empresa' }).click();
  const registrationResponse = await registrationResponsePromise;
  expect(registrationResponse.status()).toBe(201);
  const registration = (await registrationResponse.json()) as {
    tenant: { id: string };
    user: { id: string };
  };

  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await page.getByLabel('NIT de la empresa').fill(nit);
  await page.getByLabel('Correo').fill(email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  return registration;
}

test('genera, conserva y descarga archivos PILA del período desde la interfaz', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { tenant, user } = await registerAndSignIn(page);
  const fixture = await seedPilaExportFixture(tenant.id, user.id);

  try {
    await page.goto('/nomina/periodos/' + fixture.periodId);
    const panel = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Preparación de datos PILA' }) });
    await expect(panel).toBeVisible();

    const preparationResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          '/api/payroll/periods/' + fixture.periodId + '/pila-preparation' &&
        response.request().method() === 'GET',
    );
    await panel.getByRole('button', { name: 'Revisar datos' }).click();
    const preparationResponse = await preparationResponsePromise;
    expect(preparationResponse.status()).toBe(200);
    const preparation = (await preparationResponse.json()) as {
      archivoGenerable: boolean;
      estadoArchivo: string;
      exportReadiness: {
        operatorAcceptanceStatus: string;
        blockers: Array<{ scope: string }>;
      };
    };
    expect(preparation.archivoGenerable).toBe(true);
    expect(preparation.estadoArchivo).not.toBe('BLOQUEADO');
    expect(preparation.exportReadiness.operatorAcceptanceStatus).toBe('NOT_VERIFIED');
    expect(
      preparation.exportReadiness.blockers.some((blocker) => blocker.scope === 'FILE_GENERATION'),
    ).toBe(false);
    await expect(panel.getByRole('button', { name: 'Generar y guardar archivos' })).toBeEnabled();

    const createResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          '/api/payroll/periods/' + fixture.periodId + '/pila-exports' &&
        response.request().method() === 'POST',
    );
    await panel.getByRole('button', { name: 'Generar y guardar archivos' }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const created = (await createResponse.json()) as {
      id: string;
      status: string;
      normativeVersion: string;
      fileFormatVersion: string;
      sourceSnapshotCount: number;
      operatorCompatibilityStatus: string;
      type1: { sha256: string; sizeBytes: number; recordCount: number };
      type2: { sha256: string; sizeBytes: number; recordCount: number; detailRecordCount: number };
    };
    expect(created).toMatchObject({
      status: 'LOCAL_VALIDATED',
      normativeVersion: 'AT2_V30',
      sourceSnapshotCount: 1,
      operatorCompatibilityStatus: 'NOT_VERIFIED',
      type1: { sizeBytes: 567, recordCount: 1 },
      type2: { sizeBytes: 1054, recordCount: 2, detailRecordCount: 1 },
    });
    expect(created.fileFormatVersion).toContain('AT2_V30');

    const stateAfterCreate = await fixture.inspectPersistedState();
    expect(stateAfterCreate).toMatchObject({
      periodStatus: 'APROBADA',
      snapshotCount: 1,
    });
    expect(stateAfterCreate.exports).toHaveLength(1);
    expect(stateAfterCreate.exports[0]).toMatchObject({
      id: created.id,
      status: 'LOCAL_VALIDATED',
      sourceSnapshotIds: expect.arrayContaining([expect.any(String)]),
      type1Sha256: created.type1.sha256,
      type1SizeBytes: 567,
      type2Sha256: created.type2.sha256,
      type2SizeBytes: 1054,
      type1RecordCount: 1,
      type2RecordCount: 2,
      detailRecordCount: 1,
    });

    await expect(panel.getByText('Generado y validado localmente')).toBeVisible();
    await expect(panel.getByText('Compatibilidad con operadores no verificada')).toBeVisible();
    const type1Link = panel.getByRole('link', { name: /Descargar tipo 1/ });
    const type2Link = panel.getByRole('link', { name: /Descargar tipo 2/ });
    await expect(type1Link).toBeVisible();
    await expect(type2Link).toBeVisible();

    const type1Path = await type1Link.getAttribute('href');
    const type2Path = await type2Link.getAttribute('href');
    if (!type1Path || !type2Path) throw new Error('Faltan los enlaces de descarga PILA.');
    const type1Response = await page
      .context()
      .request.get(new URL(type1Path, page.url()).toString());
    const type2Response = await page
      .context()
      .request.get(new URL(type2Path, page.url()).toString());
    expect(type1Response.status()).toBe(200);
    expect(type2Response.status()).toBe(200);
    expect(type1Response.headers()['content-type']).toContain('windows-1252');
    expect(type2Response.headers()['content-type']).toContain('windows-1252');
    expect(type1Response.headers()['content-disposition']).toContain(
      'pila-2026-10-01-2026-10-31-type-1.txt',
    );
    expect(type2Response.headers()['content-disposition']).toContain(
      'pila-2026-10-01-2026-10-31-type-2.txt',
    );

    const type1Bytes = Buffer.from(await type1Response.body());
    const type2Bytes = Buffer.from(await type2Response.body());
    expect(type1Bytes.byteLength).toBe(created.type1.sizeBytes);
    expect(type2Bytes.byteLength).toBe(created.type2.sizeBytes);
    expect(createHash('sha256').update(type1Bytes).digest('hex')).toBe(created.type1.sha256);
    expect(createHash('sha256').update(type2Bytes).digest('hex')).toBe(created.type2.sha256);
    expect(type1Bytes.subarray(0, 10).toString('ascii')).toBe('Empresa De');
    expect(type2Bytes.subarray(0, 2).toString('ascii')).toBe('01');
    expect(type2Bytes.subarray(361, 363).toString('ascii')).toBe('02');
    expect(type2Bytes.subarray(-2).toString('ascii')).not.toBe('\r\n');

    const retryResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          '/api/payroll/periods/' + fixture.periodId + '/pila-exports' &&
        response.request().method() === 'POST',
    );
    await panel.getByRole('button', { name: 'Generar y guardar archivos' }).click();
    const retryResponse = await retryResponsePromise;
    expect(retryResponse.status()).toBe(201);
    const retried = (await retryResponse.json()) as { id: string };
    expect(retried.id).toBe(created.id);
    expect((await fixture.inspectPersistedState()).exports).toHaveLength(1);
  } finally {
    await fixture.disconnect();
  }
});
