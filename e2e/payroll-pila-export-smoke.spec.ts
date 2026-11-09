import { createHash, randomInt } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { PILA_AT2_V30_RECORD_LAYOUTS } from '../apps/api/src/payroll/pila-at2-v30-record-serializer';
import { seedPilaExportFixture } from './helpers/pila-export-fixture';

function detailFieldValue(record: string, fieldNumber: number): string {
  const fields = PILA_AT2_V30_RECORD_LAYOUTS.contributorDetailType2.fields;
  const field = fields.find((candidate) => candidate.fieldNumber === fieldNumber);
  if (!field) throw new Error(`No existe el campo PILA ${fieldNumber}.`);
  const offset = fields
    .filter((candidate) => candidate.fieldNumber < fieldNumber)
    .reduce((total, candidate) => total + candidate.length, 0);
  return record.slice(offset, offset + field.length).trim();
}

function headerFieldValue(record: string, fieldNumber: number): string {
  const fields = PILA_AT2_V30_RECORD_LAYOUTS.payrollHeaderType2.fields;
  const field = fields.find((candidate) => candidate.fieldNumber === fieldNumber);
  if (!field) throw new Error(`No existe el campo PILA ${fieldNumber}.`);
  const offset = fields
    .filter((candidate) => candidate.fieldNumber < fieldNumber)
    .reduce((total, candidate) => total + candidate.length, 0);
  return record.slice(offset, offset + field.length).trim();
}

async function downloadFromLink(page: Page, link: Locator) {
  const href = await link.getAttribute('href');
  if (!href) throw new Error('Falta el enlace de descarga PILA.');
  const expectedPath = new URL(href, page.url()).pathname;
  const responsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === expectedPath,
  );
  const downloadPromise = page.waitForEvent('download');
  await link.click();
  const [response, download] = await Promise.all([responsePromise, downloadPromise]);
  const stream = await download.createReadStream();
  if (!stream) throw new Error('No se pudo leer el archivo PILA descargado.');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return {
    response,
    filename: download.suggestedFilename(),
    bytes: Buffer.concat(chunks),
  };
}

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

test('genera, conserva y descarga archivos PILA para 100 empleados desde la interfaz', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { tenant, user } = await registerAndSignIn(page);
  const ownerTenantId = tenant.id;
  const fixture = await seedPilaExportFixture(tenant.id, user.id, 100);
  let foreignDownloadPath = '';
  let foreignType1Sha256 = '';

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
      sourceSnapshotCount: fixture.employeeCount,
      operatorCompatibilityStatus: 'NOT_VERIFIED',
      type1: { sizeBytes: 567, recordCount: 1 },
      type2: { sizeBytes: expect.any(Number), recordCount: 101, detailRecordCount: 100 },
    });
    expect(created.fileFormatVersion).toContain('AT2_V30');

    const stateAfterCreate = await fixture.inspectPersistedState();
    expect(stateAfterCreate).toMatchObject({
      periodStatus: 'APROBADA',
      snapshotCount: fixture.employeeCount,
    });
    expect(stateAfterCreate.exports).toHaveLength(1);
    expect(stateAfterCreate.exports[0]).toMatchObject({
      id: created.id,
      status: 'LOCAL_VALIDATED',
      sourceSnapshotIds: expect.any(Array),
      type1Sha256: created.type1.sha256,
      type1SizeBytes: 567,
      type2Sha256: created.type2.sha256,
      type2SizeBytes: created.type2.sizeBytes,
      type1RecordCount: 1,
      type2RecordCount: 101,
      detailRecordCount: fixture.employeeCount,
    });
    expect(stateAfterCreate.exports[0].sourceSnapshotIds).toHaveLength(fixture.employeeCount);
    expect(new Set(stateAfterCreate.exports[0].sourceSnapshotIds).size).toBe(fixture.employeeCount);

    await expect(panel.getByText('Generado y validado localmente')).toBeVisible();
    await expect(panel.getByText('Compatibilidad con operadores no verificada')).toBeVisible();
    await expect(panel.getByText(/100 snapshots · AT2/)).toBeVisible();
    const type1Link = panel.getByRole('link', { name: /Descargar tipo 1/ });
    const type2Link = panel.getByRole('link', { name: /Descargar tipo 2/ });
    await expect(type1Link).toBeVisible();
    await expect(type2Link).toBeVisible();
    const type1Href = await type1Link.getAttribute('href');
    if (!type1Href) throw new Error('Falta el enlace de descarga tipo 1.');
    foreignDownloadPath = type1Href;
    foreignType1Sha256 = created.type1.sha256;

    const type1Download = await downloadFromLink(page, type1Link);
    const type2Download = await downloadFromLink(page, type2Link);
    expect(type1Download.response.status()).toBe(200);
    expect(type2Download.response.status()).toBe(200);
    expect(type1Download.filename).toBe('pila-2026-10-01-2026-10-31-type-1.txt');
    expect(type2Download.filename).toBe('pila-2026-10-01-2026-10-31-type-2.txt');
    expect(type1Download.response.headers()['content-type']).toContain('windows-1252');
    expect(type2Download.response.headers()['content-type']).toContain('windows-1252');
    expect(type1Download.response.headers()['content-disposition']).toContain(
      'pila-2026-10-01-2026-10-31-type-1.txt',
    );
    expect(type2Download.response.headers()['content-disposition']).toContain(
      'pila-2026-10-01-2026-10-31-type-2.txt',
    );

    const type1Bytes = type1Download.bytes;
    const type2Bytes = type2Download.bytes;
    expect(type1Bytes.byteLength).toBe(created.type1.sizeBytes);
    expect(type2Bytes.byteLength).toBe(created.type2.sizeBytes);
    expect(createHash('sha256').update(type1Bytes).digest('hex')).toBe(created.type1.sha256);
    expect(createHash('sha256').update(type2Bytes).digest('hex')).toBe(created.type2.sha256);
    expect(type1Bytes.subarray(0, 10).toString('ascii')).toBe('Empresa De');
    const type2Records = type2Bytes.toString('latin1').split('\r\n');
    expect(type2Records).toHaveLength(fixture.employeeCount + 1);
    expect(type2Records[0].slice(0, 2)).toBe('01');
    expect(type2Records.slice(1).map((record) => record.slice(0, 7))).toEqual(
      Array.from(
        { length: fixture.employeeCount },
        (_, index) => `02${String(index + 1).padStart(5, '0')}`,
      ),
    );
    expect(type2Records.map((record) => Buffer.byteLength(record, 'latin1'))).toEqual([
      359,
      ...Array.from({ length: fixture.employeeCount }, () => 693),
    ]);
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

  await page.context().clearCookies();
  const secondTenant = await registerAndSignIn(page);
  expect(secondTenant.tenant.id).not.toBe(ownerTenantId);

  const foreignDownloadResponse = await page.goto(foreignDownloadPath);
  expect(foreignDownloadResponse?.status()).toBe(404);
  const deniedDownload = await foreignDownloadResponse?.json();
  expect(deniedDownload).toMatchObject({ message: 'Exportación PILA no encontrada.' });
  expect(JSON.stringify(deniedDownload)).not.toContain(foreignType1Sha256);
});

test('genera y descarga el candidato PILA local para un único ingreso a mitad de mes', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { tenant, user } = await registerAndSignIn(page);
  const fixture = await seedPilaExportFixture(tenant.id, user.id, 1, 'SINGLE_INGRESS');

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
      exportReadiness: {
        operatorAcceptanceStatus: string;
        blockers: Array<{ scope: string }>;
      };
    };
    expect(preparation.archivoGenerable).toBe(true);
    expect(preparation.exportReadiness.operatorAcceptanceStatus).toBe('NOT_VERIFIED');
    expect(
      preparation.exportReadiness.blockers.some((blocker) => blocker.scope === 'FILE_GENERATION'),
    ).toBe(false);

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
      sourceSnapshotCount: number;
      operatorCompatibilityStatus: string;
      type1: { recordCount: number; sizeBytes: number; sha256: string };
      type2: { recordCount: number; detailRecordCount: number; sizeBytes: number; sha256: string };
    };
    expect(created).toMatchObject({
      status: 'LOCAL_VALIDATED',
      sourceSnapshotCount: 1,
      operatorCompatibilityStatus: 'NOT_VERIFIED',
      type1: { recordCount: 1 },
      type2: { recordCount: 2, detailRecordCount: 1 },
    });

    const persisted = await fixture.inspectPersistedState();
    expect(persisted).toMatchObject({
      periodStatus: 'APROBADA',
      snapshotCount: 1,
      exports: [
        {
          id: created.id,
          status: 'LOCAL_VALIDATED',
          sourceSnapshotIds: expect.any(Array),
          type1Sha256: created.type1.sha256,
          type2Sha256: created.type2.sha256,
          detailRecordCount: 1,
        },
      ],
    });
    expect(persisted.exports[0].sourceSnapshotIds).toHaveLength(1);
    await expect(panel.getByText('Compatibilidad con operadores no verificada')).toBeVisible();

    const type1Link = panel.getByRole('link', { name: /Descargar tipo 1/ });
    const type2Link = panel.getByRole('link', { name: /Descargar tipo 2/ });
    const type1Download = await downloadFromLink(page, type1Link);
    const type2Download = await downloadFromLink(page, type2Link);
    expect(type1Download.response.status()).toBe(200);
    expect(type2Download.response.status()).toBe(200);
    expect(type1Download.bytes.byteLength).toBe(created.type1.sizeBytes);
    expect(type2Download.bytes.byteLength).toBe(created.type2.sizeBytes);
    expect(createHash('sha256').update(type1Download.bytes).digest('hex')).toBe(
      created.type1.sha256,
    );
    expect(createHash('sha256').update(type2Download.bytes).digest('hex')).toBe(
      created.type2.sha256,
    );

    const records = type2Download.bytes.toString('latin1').split('\r\n');
    expect(records).toHaveLength(2);
    expect(records[0].slice(0, 2)).toBe('01');
    expect(headerFieldValue(records[0], 19)).toBe('00001');
    expect(headerFieldValue(records[0], 20)).toBe('000005600000');
    expect(records[1].slice(0, 7)).toBe('0200001');
    expect(records[1]).toHaveLength(693);
    expect(detailFieldValue(records[1], 15)).toBe('X');
    for (const fieldNumber of [36, 37, 38, 39]) {
      expect(detailFieldValue(records[1], fieldNumber)).toBe('21');
    }
    expect(Number(detailFieldValue(records[1], 40))).toBe(5_600_000);
    expect(detailFieldValue(records[1], 80)).toBe('2026-10-10');
    expect(Number(detailFieldValue(records[1], 63))).toBe(29_300);
    expect(Number(detailFieldValue(records[1], 95))).toBe(5_600_000);
  } finally {
    await fixture.disconnect();
  }
});

test('muestra candidatos parciales VAC-LR y mantiene bloqueada la exportación', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { tenant, user } = await registerAndSignIn(page);
  const fixture = await seedPilaExportFixture(tenant.id, user.id, 1, 'SINGLE_VAC_LR');

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
      detailAbsentEventCandidates: Array<{
        fieldNumber: number;
        candidateEmployees: number;
        pendingEmployees: number;
        candidateValues?: Array<{ value: string | number | null; ruleVersion?: string }>;
      }>;
      issues: Array<{ fieldNumber: number | null; code: string }>;
    };
    expect(preparation.archivoGenerable).toBe(false);
    for (const [fieldNumber, expectedValue] of [
      [27, 'X'],
      [30, 0],
      [89, '2026-10-12'],
      [90, '2026-10-16'],
    ] as const) {
      expect(
        preparation.detailAbsentEventCandidates.find(
          (candidate) => candidate.fieldNumber === fieldNumber,
        ),
      ).toMatchObject({
        candidateEmployees: 1,
        pendingEmployees: 0,
        candidateValues: [
          {
            value: expectedValue,
            ruleVersion: 'AT2_V30_TYPED_VAC_LR_EVENT_FIELDS_V1',
          },
        ],
      });
    }
    expect(preparation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldNumber: 27,
          code: 'EVENTO_PILA_VAC_LR_SIN_SEGMENTACION_APROBADA',
        }),
      ]),
    );
    await expect(panel.getByRole('button', { name: 'Generar y guardar archivos' })).toBeDisabled();

    const eventSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Eventos y particularidades de planilla' }),
    });
    await expect(eventSection.getByText(/candidatos parciales/)).toBeVisible();
    await eventSection.getByText(/Ver estado de \d+ campos/).click();
    await expect(
      eventSection.getByText('Campo 27 · Vacaciones o licencia remunerada (VAC-LR)'),
    ).toBeVisible();
    await eventSection.getByText('Ver valores de 1 empleado').click();
    await expect(eventSection.getByText('X', { exact: true })).toBeVisible();
    await expect(eventSection.getByText('AT2_V30_TYPED_VAC_LR_EVENT_FIELDS_V1')).toBeVisible();
  } finally {
    await fixture.disconnect();
  }
});

test('genera y descarga el candidato PILA local para un único retiro durante el mes', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { tenant, user } = await registerAndSignIn(page);
  const fixture = await seedPilaExportFixture(tenant.id, user.id, 1, 'SINGLE_RETIREMENT');

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
      exportReadiness: {
        operatorAcceptanceStatus: string;
        blockers: Array<{ scope: string }>;
      };
    };
    expect(preparation.archivoGenerable).toBe(true);
    expect(preparation.exportReadiness.operatorAcceptanceStatus).toBe('NOT_VERIFIED');
    expect(
      preparation.exportReadiness.blockers.some((blocker) => blocker.scope === 'FILE_GENERATION'),
    ).toBe(false);

    const createResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          '/api/payroll/periods/' + fixture.periodId + '/pila-exports' &&
        response.request().method() === 'POST',
    );
    await panel.getByRole('button', { name: 'Generar y guardar archivos' }).click();
    const createResponse = await createResponsePromise;
    const createdPayload = await createResponse.json();
    expect(createResponse.status(), JSON.stringify(createdPayload)).toBe(201);
    const created = createdPayload as {
      id: string;
      status: string;
      sourceSnapshotCount: number;
      operatorCompatibilityStatus: string;
      type1: { recordCount: number; sizeBytes: number; sha256: string };
      type2: { recordCount: number; detailRecordCount: number; sizeBytes: number; sha256: string };
    };
    expect(created).toMatchObject({
      status: 'LOCAL_VALIDATED',
      sourceSnapshotCount: 1,
      operatorCompatibilityStatus: 'NOT_VERIFIED',
      type1: { recordCount: 1 },
      type2: { recordCount: 2, detailRecordCount: 1 },
    });

    const persisted = await fixture.inspectPersistedState();
    expect(persisted).toMatchObject({
      periodStatus: 'APROBADA',
      snapshotCount: 1,
      exports: [
        {
          id: created.id,
          status: 'LOCAL_VALIDATED',
          sourceSnapshotIds: expect.any(Array),
          type1Sha256: created.type1.sha256,
          type2Sha256: created.type2.sha256,
          detailRecordCount: 1,
        },
      ],
    });
    expect(persisted.exports[0].sourceSnapshotIds).toHaveLength(1);
    await expect(panel.getByText('Compatibilidad con operadores no verificada')).toBeVisible();

    const type1Link = panel.getByRole('link', { name: /Descargar tipo 1/ });
    const type2Link = panel.getByRole('link', { name: /Descargar tipo 2/ });
    const type1Download = await downloadFromLink(page, type1Link);
    const type2Download = await downloadFromLink(page, type2Link);
    expect(type1Download.response.status()).toBe(200);
    expect(type2Download.response.status()).toBe(200);
    expect(type1Download.bytes.byteLength).toBe(created.type1.sizeBytes);
    expect(type2Download.bytes.byteLength).toBe(created.type2.sizeBytes);
    expect(createHash('sha256').update(type1Download.bytes).digest('hex')).toBe(
      created.type1.sha256,
    );
    expect(createHash('sha256').update(type2Download.bytes).digest('hex')).toBe(
      created.type2.sha256,
    );

    const records = type2Download.bytes.toString('latin1').split('\r\n');
    expect(records).toHaveLength(2);
    expect(records[0].slice(0, 2)).toBe('01');
    expect(headerFieldValue(records[0], 19)).toBe('00001');
    expect(headerFieldValue(records[0], 20)).toBe('000005400000');
    expect(records[1].slice(0, 7)).toBe('0200001');
    expect(records[1]).toHaveLength(693);
    expect(detailFieldValue(records[1], 15)).toBe('');
    expect(detailFieldValue(records[1], 16)).toBe('X');
    for (const fieldNumber of [36, 37, 38, 39]) {
      expect(detailFieldValue(records[1], fieldNumber)).toBe('20');
    }
    expect(Number(detailFieldValue(records[1], 40))).toBe(5_400_000);
    expect(detailFieldValue(records[1], 80)).toBe('');
    expect(detailFieldValue(records[1], 81)).toBe('2026-10-20');
    expect(Number(detailFieldValue(records[1], 95))).toBe(5_400_000);
  } finally {
    await fixture.disconnect();
  }
});

test('genera ING y RET en una sola línea tipo 2 cuando ocurren en el mismo mes', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { tenant, user } = await registerAndSignIn(page);
  const fixture = await seedPilaExportFixture(tenant.id, user.id, 1, 'SINGLE_INGRESS_RETIREMENT');

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
      exportReadiness: {
        operatorAcceptanceStatus: string;
        blockers: Array<{ scope: string }>;
      };
    };
    expect(preparation.archivoGenerable).toBe(true);
    expect(preparation.exportReadiness.operatorAcceptanceStatus).toBe('NOT_VERIFIED');
    expect(
      preparation.exportReadiness.blockers.some((blocker) => blocker.scope === 'FILE_GENERATION'),
    ).toBe(false);

    const createResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          '/api/payroll/periods/' + fixture.periodId + '/pila-exports' &&
        response.request().method() === 'POST',
    );
    await panel.getByRole('button', { name: 'Generar y guardar archivos' }).click();
    const createResponse = await createResponsePromise;
    const createdPayload = await createResponse.json();
    expect(createResponse.status(), JSON.stringify(createdPayload)).toBe(201);
    const created = createdPayload as {
      id: string;
      type2: { detailRecordCount: number; sizeBytes: number; sha256: string };
    };
    expect(created.type2.detailRecordCount).toBe(1);

    const type2Link = panel.getByRole('link', { name: /Descargar tipo 2/ });
    const type2Download = await downloadFromLink(page, type2Link);
    expect(type2Download.response.status()).toBe(200);
    expect(type2Download.bytes.byteLength).toBe(created.type2.sizeBytes);
    expect(createHash('sha256').update(type2Download.bytes).digest('hex')).toBe(
      created.type2.sha256,
    );

    const records = type2Download.bytes.toString('latin1').split('\r\n');
    expect(records).toHaveLength(2);
    expect(headerFieldValue(records[0], 19)).toBe('00001');
    expect(headerFieldValue(records[0], 20)).toBe('000002200000');
    expect(records[1].slice(0, 7)).toBe('0200001');
    expect(detailFieldValue(records[1], 15)).toBe('X');
    expect(detailFieldValue(records[1], 16)).toBe('X');
    for (const fieldNumber of [36, 37, 38, 39]) {
      expect(detailFieldValue(records[1], fieldNumber)).toBe('11');
    }
    expect(Number(detailFieldValue(records[1], 40))).toBe(2_200_000);
    expect(Number(detailFieldValue(records[1], 55))).toBe(275_000);
    expect(detailFieldValue(records[1], 80)).toBe('2026-10-10');
    expect(detailFieldValue(records[1], 81)).toBe('2026-10-20');
    expect(Number(detailFieldValue(records[1], 95))).toBe(2_200_000);
  } finally {
    await fixture.disconnect();
  }
});

test('genera y descarga el candidato PILA local para un VSP al inicio de mes', async ({ page }) => {
  test.setTimeout(120_000);
  const { tenant, user } = await registerAndSignIn(page);
  const fixture = await seedPilaExportFixture(tenant.id, user.id, 1, 'SINGLE_VSP');

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
      exportReadiness: {
        operatorAcceptanceStatus: string;
        blockers: Array<{ scope: string }>;
      };
    };
    expect(preparation.archivoGenerable).toBe(true);
    expect(preparation.exportReadiness.operatorAcceptanceStatus).toBe('NOT_VERIFIED');
    expect(
      preparation.exportReadiness.blockers.some((blocker) => blocker.scope === 'FILE_GENERATION'),
    ).toBe(false);

    const createResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          '/api/payroll/periods/' + fixture.periodId + '/pila-exports' &&
        response.request().method() === 'POST',
    );
    await panel.getByRole('button', { name: 'Generar y guardar archivos' }).click();
    const createResponse = await createResponsePromise;
    const createdPayload = await createResponse.json();
    expect(createResponse.status(), JSON.stringify(createdPayload)).toBe(201);
    const created = createdPayload as {
      id: string;
      status: string;
      sourceSnapshotCount: number;
      operatorCompatibilityStatus: string;
      type1: { recordCount: number; sizeBytes: number; sha256: string };
      type2: { recordCount: number; detailRecordCount: number; sizeBytes: number; sha256: string };
    };
    expect(created).toMatchObject({
      status: 'LOCAL_VALIDATED',
      sourceSnapshotCount: 1,
      operatorCompatibilityStatus: 'NOT_VERIFIED',
      type1: { recordCount: 1 },
      type2: { recordCount: 2, detailRecordCount: 1 },
    });

    const persisted = await fixture.inspectPersistedState();
    expect(persisted).toMatchObject({
      periodStatus: 'APROBADA',
      snapshotCount: 1,
      exports: [
        {
          id: created.id,
          status: 'LOCAL_VALIDATED',
          sourceSnapshotIds: expect.any(Array),
          type1Sha256: created.type1.sha256,
          type2Sha256: created.type2.sha256,
          detailRecordCount: 1,
        },
      ],
    });
    await expect(panel.getByText('Compatibilidad con operadores no verificada')).toBeVisible();

    const type1Link = panel.getByRole('link', { name: /Descargar tipo 1/ });
    const type2Link = panel.getByRole('link', { name: /Descargar tipo 2/ });
    const type1Download = await downloadFromLink(page, type1Link);
    const type2Download = await downloadFromLink(page, type2Link);
    expect(type1Download.response.status()).toBe(200);
    expect(type2Download.response.status()).toBe(200);
    expect(type1Download.bytes.byteLength).toBe(created.type1.sizeBytes);
    expect(type2Download.bytes.byteLength).toBe(created.type2.sizeBytes);
    expect(createHash('sha256').update(type1Download.bytes).digest('hex')).toBe(
      created.type1.sha256,
    );
    expect(createHash('sha256').update(type2Download.bytes).digest('hex')).toBe(
      created.type2.sha256,
    );

    const records = type2Download.bytes.toString('latin1').split('\r\n');
    expect(records).toHaveLength(2);
    expect(records[1]).toHaveLength(693);
    expect(detailFieldValue(records[1], 15)).toBe('');
    expect(detailFieldValue(records[1], 16)).toBe('');
    expect(detailFieldValue(records[1], 21)).toBe('X');
    expect(detailFieldValue(records[1], 30)).toBe('00');
    for (const fieldNumber of [36, 37, 38, 39]) {
      expect(detailFieldValue(records[1], fieldNumber)).toBe('30');
    }
    expect(Number(detailFieldValue(records[1], 40))).toBe(3_000_000);
    expect(detailFieldValue(records[1], 80)).toBe('');
    expect(detailFieldValue(records[1], 81)).toBe('');
    expect(detailFieldValue(records[1], 82)).toBe('2026-10-01');
    expect(Number(detailFieldValue(records[1], 95))).toBe(3_000_000);
  } finally {
    await fixture.disconnect();
  }
});
