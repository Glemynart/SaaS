import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createSede } from './helpers/create-sede';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const xlsx = createRequire(join(process.cwd(), 'apps/api/package.json'))('xlsx');

test('registra, busca, edita, desactiva e importa empleados desde la UI', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const suffix = `${Date.now().toString().slice(-7)}${testInfo.retry}`;
  const nit = `8${suffix}`;
  const email = `employees-e2e-${suffix}@example.test`;
  const password = 'E2e-password-123!';
  const cedula = `E2E${suffix}`;

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('Empleados E2E');
  await page.getByLabel('Razón social').fill('Empleados E2E S.A.S.');
  await page.getByLabel('Nombre administrador').fill('Laura');
  await page.getByLabel('Apellido').fill('Gómez');
  await page.getByLabel('Correo administrador').fill(email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);
  await page.getByRole('button', { name: 'Crear empresa' }).click();

  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await page.getByLabel('NIT de la empresa').fill(nit);
  await page.getByLabel('Correo').fill(email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await createSede(page, 'Sede Principal');
  await page.goto('/empleados');
  await expect(page.getByRole('heading', { name: 'Empleados' })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo empleado', exact: true }).first().click();

  const createDialog = page.getByRole('dialog', { name: 'Nuevo empleado' });
  await createDialog.locator('[name="cedula"]').fill(cedula);
  await createDialog.locator('[name="primerNombre"]').fill('Andrea');
  await createDialog.locator('[name="primerApellido"]').fill('Prueba');
  await createDialog.locator('[name="cargo"]').fill('Docente E2E');
  await createDialog.locator('[name="salario"]').fill('2500000');
  await createDialog.locator('[name="sedeId"]').selectOption({ label: 'Sede Principal' });
  await createDialog.getByLabel('Registrar afiliación PILA inicial').check();
  await createDialog.locator('[name="afiliacionPilaInicial.epsCodigo"]').fill('EPS001');
  await createDialog.locator('[name="afiliacionPilaInicial.epsNombre"]').fill('EPS Demo');
  await createDialog.locator('[name="afiliacionPilaInicial.fondoPensionCodigo"]').fill('AFP001');
  await createDialog
    .locator('[name="afiliacionPilaInicial.fondoPensionNombre"]')
    .fill('Fondo Demo');
  await createDialog
    .locator('[name="afiliacionPilaInicial.estadoAfiliacionPensional"]')
    .selectOption('S');
  await createDialog.locator('[name="afiliacionPilaInicial.arlCodigo"]').fill('ARL001');
  await createDialog.locator('[name="afiliacionPilaInicial.arlNombre"]').fill('ARL Demo');
  await createDialog.locator('[name="afiliacionPilaInicial.arlClaseRiesgo"]').selectOption('1');
  await createDialog
    .locator('[name="afiliacionPilaInicial.cajaCompensacionCodigo"]')
    .fill('CCF001');
  await createDialog
    .locator('[name="afiliacionPilaInicial.cajaCompensacionNombre"]')
    .fill('Caja Demo');
  await createDialog
    .locator('[name="afiliacionPilaInicial.cajaCompensacionDepartamentoCodigo"]')
    .selectOption('08');
  await createDialog
    .locator('[name="afiliacionPilaInicial.colombianoEnElExterior"]')
    .selectOption('NO');
  await createDialog.locator('[name="afiliacionPilaInicial.vigenteDesde"]').fill('2026-01-01');
  await createDialog.getByRole('button', { name: 'Crear empleado', exact: true }).click();

  const search = page.locator('input[aria-label="Buscar empleados"]');
  let employeeDocument = cedula;
  const employeeRow = () => page.getByRole('row').filter({ hasText: employeeDocument });
  await expect(employeeRow()).toContainText('Andrea Prueba');

  await search.fill(cedula);
  await expect(employeeRow()).toBeVisible();

  await employeeRow().getByRole('button', { name: 'Editar', exact: true }).click();
  const editDialog = page.getByRole('dialog', { name: 'Editar empleado' });
  await editDialog.locator('[name="cargo"]').fill('Coordinadora E2E');
  await editDialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(employeeRow()).toContainText('Coordinadora E2E');

  const employeeDetailLink = employeeRow().getByRole('link', {
    name: 'Ver detalle de Andrea Prueba',
  });
  const employeeDetailPath = await employeeDetailLink.getAttribute('href');
  expect(employeeDetailPath).toBeTruthy();
  const employeeId = employeeDetailPath!.split('/').pop()!;
  await employeeDetailLink.click();
  await expect(page).toHaveURL(new RegExp(`/empleados/.+`));
  await expect(
    page.getByRole('heading', { name: 'Afiliaciones de seguridad social' }),
  ).toBeVisible();
  await expect(page.getByText('EPS Demo')).toBeVisible();
  await expect(page.getByText('Estado en afiliación a pensiones (campo 5)')).toBeVisible();
  const initialAffiliationCard = page.getByRole('listitem').filter({ hasText: 'EPS Demo' });
  await expect(initialAffiliationCard).toContainText('Sí (S)');
  await page.getByRole('button', { name: 'Registrar afiliación' }).click();
  const replacementForm = page.locator('form').filter({
    has: page.getByRole('heading', { name: 'Nueva afiliación' }),
  });
  await replacementForm.getByRole('combobox', { name: 'Tipo de cotizante' }).selectOption('01');
  await replacementForm.getByLabel('Subtipo de cotizante').fill('00');
  await replacementForm.getByLabel('Vigente desde').fill('2026-04-01');
  await replacementForm.getByLabel('Código EPS').fill('EPS002');
  await replacementForm.getByLabel('Nombre EPS').fill('EPS Nueva');
  await replacementForm.getByLabel('Código Fondo de pensión').fill('AFP001');
  await replacementForm.getByLabel('Nombre Fondo de pensión').fill('Fondo Demo');
  await replacementForm.getByLabel('Estado de afiliación a pensiones (campo 5)').selectOption('N');
  await replacementForm.getByLabel('Código ARL').fill('ARL001');
  await replacementForm.getByLabel('Nombre ARL').fill('ARL Demo');
  await replacementForm.getByRole('combobox', { name: 'Clase de riesgo ARL' }).selectOption('1');
  await replacementForm.getByLabel('Código Caja de compensación').fill('CCF001');
  await replacementForm.getByLabel('Nombre Caja de compensación').fill('Caja Demo');
  await replacementForm.getByLabel('Departamento donde está ubicada la CCF').selectOption('08');
  await replacementForm
    .getByRole('combobox', { name: '¿Es colombiano en el exterior?' })
    .selectOption('false');
  await replacementForm.getByRole('button', { name: 'Guardar afiliación' }).click();

  await expect(page.getByText('EPS Nueva')).toBeVisible();
  const previousAffiliation = page.getByRole('listitem').filter({ hasText: 'EPS Demo' });
  await expect(previousAffiliation).toContainText('Sí (S)');
  await expect(previousAffiliation).toHaveCount(1);
  await expect(previousAffiliation).not.toContainText('Sin fecha final');
  const currentAffiliation = page.getByRole('listitem').filter({ hasText: 'EPS Nueva' });
  await expect(currentAffiliation).toContainText('No (N)');
  await expect(currentAffiliation).toContainText('Sin fecha final');
  await page.getByRole('button', { name: 'Finalizar vigencia' }).click();
  await page.getByLabel('Válida hasta').fill('2026-06-30');
  await page.getByRole('button', { name: 'Guardar fecha' }).click();
  await expect(currentAffiliation).not.toContainText('Sin fecha final');
  await expect(page.getByRole('button', { name: 'Finalizar vigencia' })).toHaveCount(0);

  const pilaWorkPanel = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Centro de trabajo y actividad PILA' }),
  });
  await expect(pilaWorkPanel).toBeVisible();
  await pilaWorkPanel.getByRole('button', { name: 'Crear centro ARL' }).click();
  const centerForm = pilaWorkPanel.locator('form').filter({
    has: page.getByRole('heading', { name: 'Nuevo centro declarado a la ARL' }),
  });
  await centerForm.getByLabel('Código ARL').fill('ARL001');
  await centerForm.getByLabel('Código del centro').fill('E2E-001');
  await centerForm.getByLabel('Nombre del centro').fill('Centro ARL E2E');
  await centerForm.getByLabel('Sede relacionada (opcional)').selectOption({
    label: 'Sede Principal',
  });
  const createCenterResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/pila-centros-trabajo' &&
      response.request().method() === 'POST',
  );
  await centerForm.getByRole('button', { name: 'Guardar centro' }).click();
  const createCenterResponse = await createCenterResponsePromise;
  expect(createCenterResponse.status()).toBe(200);
  const workCenter = (await createCenterResponse.json()) as { id: string };

  await pilaWorkPanel.getByLabel('Centro de trabajo ARL').selectOption(workCenter.id);
  await pilaWorkPanel.getByLabel('Actividad económica de riesgos').fill('1131202');
  await pilaWorkPanel.getByRole('textbox', { name: 'Vigente desde' }).fill('2026-01-01');
  const createAssignmentResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/employees/${employeeId}/asignaciones-centro-pila` &&
      response.request().method() === 'POST',
  );
  await pilaWorkPanel.getByRole('button', { name: 'Guardar asignación' }).click();
  const createAssignmentResponse = await createAssignmentResponsePromise;
  expect(createAssignmentResponse.status()).toBe(200);
  const assignment = (await createAssignmentResponse.json()) as { id: string };
  const workAssignment = pilaWorkPanel.getByRole('listitem').filter({ hasText: 'Centro ARL E2E' });
  await expect(workAssignment).toContainText('1131202');
  await expect(workAssignment).toContainText('Sede Principal');

  await page.reload();
  const persistedWorkAssignment = page
    .locator('section')
    .filter({
      has: page.getByRole('heading', { name: 'Centro de trabajo y actividad PILA' }),
    })
    .getByRole('listitem')
    .filter({ hasText: 'Centro ARL E2E' });
  await expect(persistedWorkAssignment).toContainText('1131202');
  await expect(persistedWorkAssignment).toContainText('Sin fecha final');
  const closeWorkAssignmentResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/employees/${employeeId}/asignaciones-centro-pila/${assignment.id}` &&
      response.request().method() === 'PATCH',
  );
  const persistedPilaWorkPanel = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Centro de trabajo y actividad PILA' }),
  });
  await persistedPilaWorkPanel.getByRole('button', { name: 'Finalizar vigencia' }).click();
  await persistedPilaWorkPanel.getByLabel('Válida hasta').fill('2026-12-31');
  await persistedPilaWorkPanel.getByRole('button', { name: 'Guardar fecha' }).click();
  const closeWorkAssignmentResponse = await closeWorkAssignmentResponsePromise;
  expect(closeWorkAssignmentResponse.status()).toBe(200);
  await expect(persistedWorkAssignment).not.toContainText('Sin fecha final');

  const municipalities = (await page.evaluate(async () => {
    const response = await fetch('/api/dane/municipios');
    return (await response.json()) as Array<{ id: string; codigo: string }>;
  })) as Array<{ id: string; codigo: string }>;
  const workMunicipality = municipalities.find(({ codigo }) => codigo === '08001');
  expect(workMunicipality).toBeTruthy();
  const workLocationPanel = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Ubicación laboral PILA' }),
  });
  const workLocationForm = workLocationPanel.locator('form');
  await workLocationForm
    .getByLabel('Municipio de trabajo declarado')
    .selectOption(workMunicipality!.id);
  await workLocationForm.getByLabel('Vigente desde').fill('2026-01-01');
  await workLocationForm
    .getByLabel(
      'Confirmo que este es el municipio donde el empleado ejecuta su actividad laboral para PILA.',
    )
    .check();
  const createWorkLocationResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/employees/${employeeId}/ubicaciones-laborales-pila` &&
      response.request().method() === 'POST',
  );
  await workLocationForm.getByRole('button', { name: 'Registrar ubicación' }).click();
  const createWorkLocationResponse = await createWorkLocationResponsePromise;
  expect(createWorkLocationResponse.status()).toBe(200);
  const createdWorkLocation = (await createWorkLocationResponse.json()) as { id: string };
  const savedWorkLocation = workLocationPanel
    .getByRole('listitem')
    .filter({ hasText: 'Barranquilla' });
  await expect(savedWorkLocation).toContainText('Sin fecha final');
  await page.reload();
  const persistedWorkLocation = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Ubicación laboral PILA' }) })
    .getByRole('listitem')
    .filter({ hasText: 'Barranquilla' });
  await expect(persistedWorkLocation).toContainText('Sin fecha final');

  const closeWorkLocationResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/employees/${employeeId}/ubicaciones-laborales-pila/${createdWorkLocation.id}` &&
      response.request().method() === 'PATCH',
  );
  await persistedWorkLocation.getByRole('button', { name: 'Cerrar vigencia' }).click();
  await persistedWorkLocation.getByLabel('Vigente hasta').fill('2026-12-31');
  await persistedWorkLocation.getByRole('button', { name: 'Guardar' }).click();
  const closeWorkLocationResponse = await closeWorkLocationResponsePromise;
  expect(closeWorkLocationResponse.status()).toBe(200);
  await expect(persistedWorkLocation).not.toContainText('Sin fecha final');

  await page.goto('/empleados');
  await search.fill(cedula);
  await expect(employeeRow()).toContainText('Coordinadora E2E');

  await employeeRow().getByRole('button', { name: 'Editar', exact: true }).click();
  const pepTutorDialog = page.getByRole('dialog', { name: 'Editar empleado' });
  await expect(pepTutorDialog.locator('[name="sedeId"]')).toHaveValue(/.+/);
  await pepTutorDialog.locator('[name="tipoDocumento"]').selectOption('PC');
  await pepTutorDialog.locator('[name="cedula"]').fill('7654321');
  const updatePepTutorResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/employees/${employeeId}` &&
      response.request().method() === 'PATCH',
  );
  await pepTutorDialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  const updatePepTutorResponse = await updatePepTutorResponsePromise;
  expect(updatePepTutorResponse.status()).toBe(200);

  employeeDocument = '7654321';
  await search.fill(employeeDocument);
  await expect(employeeRow()).toContainText('PC 7654321');
  await page.reload();
  await search.fill(employeeDocument);
  await expect(employeeRow()).toContainText('PC 7654321');

  await employeeRow().getByRole('button', { name: 'Desactivar', exact: true }).click();
  const deleteDialog = page.getByRole('alertdialog');
  await deleteDialog.getByRole('button', { name: 'Desactivar empleado', exact: true }).click();
  await expect(employeeRow()).toHaveCount(0);

  const templateResponse = await page.evaluate(async () => {
    const response = await fetch('/api/employees/import/template');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type'),
      base64: btoa(binary),
    };
  });
  expect(templateResponse.ok, `template request failed: ${templateResponse.status}`).toBe(true);
  expect(templateResponse.contentType).toContain(XLSX_MIME);
  const templateBuffer = Buffer.from(templateResponse.base64, 'base64');
  const templateWorkbook = xlsx.read(templateBuffer, { type: 'buffer' });
  const templateSheetName = templateWorkbook.SheetNames[0] as string;
  const templateRows = xlsx.utils.sheet_to_json(templateWorkbook.Sheets[templateSheetName], {
    header: 1,
    defval: '',
  }) as unknown[][];
  const templateHeaders = templateRows[0] as string[];
  const sampleEmployee = templateRows[2] as unknown[];
  const initialAffiliation: Record<string, string> = {
    tipoCotizanteCodigo: '01',
    subtipoCotizanteCodigo: '00',
    epsCodigo: 'EPS001',
    epsNombre: 'EPS Demo E2E',
    fondoPensionCodigo: 'AFP001',
    fondoPensionNombre: 'Fondo Demo E2E',
    estadoAfiliacionPensional: 'S',
    arlCodigo: 'ARL001',
    arlNombre: 'ARL Demo E2E',
    arlClaseRiesgo: '1',
    cajaCompensacionCodigo: 'CCF001',
    cajaCompensacionNombre: 'Caja Demo E2E',
    cajaCompensacionDepartamentoCodigo: '08',
    colombianoEnElExterior: 'NO',
    afiliacionVigenteDesde: '2026-01-01',
  };
  for (const [header, value] of Object.entries(initialAffiliation)) {
    const column = templateHeaders.indexOf(header);
    expect(column, `missing template column ${header}`).toBeGreaterThanOrEqual(0);
    sampleEmployee[column] = value;
  }
  templateRows[2] = sampleEmployee;
  templateWorkbook.Sheets[templateSheetName] = xlsx.utils.aoa_to_sheet(templateRows);
  const affiliationTemplateBuffer = Buffer.from(
    xlsx.write(templateWorkbook, { type: 'buffer', bookType: 'xlsx' }),
  );

  await search.fill('');
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  const importDialog = page.getByRole('dialog', { name: 'Importar empleados' });
  await importDialog.locator('input[type="file"]').setInputFiles({
    name: 'plantilla_empleados.xlsx',
    mimeType: XLSX_MIME,
    buffer: affiliationTemplateBuffer,
  });
  await importDialog.getByRole('button', { name: 'Importar', exact: true }).click();

  await expect(importDialog.getByRole('status')).toContainText('1 empleado');
  await expect(importDialog.getByRole('status')).toContainText(
    '1 afiliación PILA inicial capturada',
  );
  await importDialog.getByRole('button', { name: 'Cerrar' }).last().click();
  await expect(page.getByText('12345678', { exact: true })).toBeVisible();

  const importedEmployeeRow = page.getByRole('row').filter({ hasText: '12345678' });
  await importedEmployeeRow.getByRole('link', { name: /Ver detalle de/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Afiliaciones de seguridad social' }),
  ).toBeVisible();
  await expect(page.getByText('EPS Demo E2E')).toBeVisible();

  const pilaAffiliationTemplateResponse = await page.evaluate(async () => {
    const response = await fetch('/api/employees/import/pila-affiliations/template');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type'),
      base64: btoa(binary),
    };
  });
  expect(
    pilaAffiliationTemplateResponse.ok,
    `PILA affiliation template request failed: ${pilaAffiliationTemplateResponse.status}`,
  ).toBe(true);
  expect(pilaAffiliationTemplateResponse.contentType).toContain(XLSX_MIME);
  const pilaAffiliationWorkbook = xlsx.read(
    Buffer.from(pilaAffiliationTemplateResponse.base64, 'base64'),
    { type: 'buffer' },
  );
  const pilaAffiliationSheetName = pilaAffiliationWorkbook.SheetNames[0] as string;
  const pilaAffiliationHeaders = xlsx.utils.sheet_to_json(
    pilaAffiliationWorkbook.Sheets[pilaAffiliationSheetName],
    { header: 1, defval: '' },
  )[0] as string[];
  const updatedAffiliation: Record<string, string> = {
    cedula: '12345678',
    tipoDocumento: 'CC',
    tipoCotizanteCodigo: '01',
    subtipoCotizanteCodigo: '00',
    epsCodigo: 'EPS002',
    epsNombre: 'EPS Nueva E2E',
    fondoPensionCodigo: 'AFP001',
    fondoPensionNombre: 'Fondo Demo E2E',
    estadoAfiliacionPensional: 'N',
    arlCodigo: 'ARL001',
    arlNombre: 'ARL Demo E2E',
    arlClaseRiesgo: '1',
    cajaCompensacionCodigo: 'CCF001',
    cajaCompensacionNombre: 'Caja Demo E2E',
    cajaCompensacionDepartamentoCodigo: '08',
    colombianoEnElExterior: 'NO',
    afiliacionVigenteDesde: '2026-04-01',
  };
  const pilaAffiliationRow = pilaAffiliationHeaders.map(
    (header) => updatedAffiliation[header] ?? '',
  );
  pilaAffiliationWorkbook.Sheets[pilaAffiliationSheetName] = xlsx.utils.aoa_to_sheet([
    pilaAffiliationHeaders,
    pilaAffiliationRow,
  ]);
  const pilaAffiliationBuffer = Buffer.from(
    xlsx.write(pilaAffiliationWorkbook, { type: 'buffer', bookType: 'xlsx' }),
  );

  await page.goto('/empleados');
  await page.getByRole('button', { name: 'Importar afiliaciones PILA' }).click();
  const pilaImportDialog = page.getByRole('dialog', { name: 'Importar afiliaciones PILA' });
  const uploadPilaAffiliation = async () => {
    await pilaImportDialog.locator('input[type="file"]').setInputFiles({
      name: 'plantilla_afiliaciones_pila.xlsx',
      mimeType: XLSX_MIME,
      buffer: pilaAffiliationBuffer,
    });
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/employees/import/pila-affiliations' &&
        response.request().method() === 'POST',
    );
    await pilaImportDialog.getByRole('button', { name: 'Importar afiliaciones' }).click();
    return responsePromise;
  };
  const firstPilaImportResponse = await uploadPilaAffiliation();
  expect(firstPilaImportResponse.status()).toBe(200);
  await expect(
    pilaImportDialog.getByRole('status').filter({ hasText: '1 afiliación nueva registrada' }),
  ).toBeVisible();
  await pilaImportDialog.getByRole('button', { name: 'Cerrar' }).last().click();

  await search.fill('12345678');
  const bulkUpdatedEmployeeRow = page.getByRole('row').filter({ hasText: '12345678' });
  await bulkUpdatedEmployeeRow.getByRole('link', { name: /Ver detalle de/ }).click();
  const pilaAffiliationPanel = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Afiliaciones de seguridad social' }),
  });
  const bulkPriorAffiliation = pilaAffiliationPanel.getByRole('listitem').filter({
    hasText: 'EPS Demo E2E',
  });
  const bulkCurrentAffiliation = pilaAffiliationPanel.getByRole('listitem').filter({
    hasText: 'EPS Nueva E2E',
  });
  await expect(bulkPriorAffiliation).toBeVisible();
  await expect(bulkPriorAffiliation).not.toContainText('Sin fecha final');
  await expect(bulkCurrentAffiliation).toContainText('Sin fecha final');

  await page.goto('/empleados');
  await page.getByRole('button', { name: 'Importar afiliaciones PILA' }).click();
  const retryImportDialog = page.getByRole('dialog', { name: 'Importar afiliaciones PILA' });
  await retryImportDialog.locator('input[type="file"]').setInputFiles({
    name: 'plantilla_afiliaciones_pila.xlsx',
    mimeType: XLSX_MIME,
    buffer: pilaAffiliationBuffer,
  });
  const retryResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/employees/import/pila-affiliations' &&
      response.request().method() === 'POST',
  );
  await retryImportDialog.getByRole('button', { name: 'Importar afiliaciones' }).click();
  const retryResponse = await retryResponsePromise;
  expect(retryResponse.status()).toBe(200);
  await expect(
    retryImportDialog
      .getByRole('status')
      .filter({ hasText: '0 afiliaciones nuevas registradas; 1 fila sin cambios.' }),
  ).toBeVisible();
  await retryImportDialog.getByRole('button', { name: 'Cerrar' }).last().click();

  const workLocationTemplateResponse = await page.evaluate(async () => {
    const response = await fetch('/api/employees/import/pila-work-locations/template');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type'),
      base64: btoa(binary),
    };
  });
  expect(
    workLocationTemplateResponse.ok,
    `PILA location template request failed: ${workLocationTemplateResponse.status}`,
  ).toBe(true);
  expect(workLocationTemplateResponse.contentType).toContain(XLSX_MIME);
  const workLocationWorkbook = xlsx.read(
    Buffer.from(workLocationTemplateResponse.base64, 'base64'),
    { type: 'buffer' },
  );
  const workLocationSheetName = workLocationWorkbook.SheetNames[0] as string;
  const workLocationRows = xlsx.utils.sheet_to_json(
    workLocationWorkbook.Sheets[workLocationSheetName],
    { header: 1, defval: '' },
  ) as unknown[][];
  const workLocationHeaders = workLocationRows[0] as string[];
  const workLocation = {
    cedula: '12345678',
    tipoDocumento: 'CC',
    municipioCodigo: '08001',
    vigenteDesde: '2026-01-01',
    vigenteHasta: '',
  };
  workLocationWorkbook.Sheets[workLocationSheetName] = xlsx.utils.aoa_to_sheet([
    workLocationHeaders,
    workLocationHeaders.map((header) => workLocation[header as keyof typeof workLocation] ?? ''),
  ]);
  const workLocationBuffer = Buffer.from(
    xlsx.write(workLocationWorkbook, { type: 'buffer', bookType: 'xlsx' }),
  );

  await page.goto('/empleados');
  await page.getByRole('button', { name: 'Importar ubicaciones PILA' }).click();
  const workLocationImportDialog = page.getByRole('dialog', {
    name: 'Importar ubicaciones laborales PILA',
  });
  const uploadPilaWorkLocation = async () => {
    await workLocationImportDialog.locator('input[type="file"]').setInputFiles({
      name: 'plantilla_ubicaciones_laborales_pila.xlsx',
      mimeType: XLSX_MIME,
      buffer: workLocationBuffer,
    });
    await workLocationImportDialog.getByLabel(/Confirmo que cada municipio indicado/).check();
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/employees/import/pila-work-locations' &&
        response.request().method() === 'POST',
    );
    await workLocationImportDialog.getByRole('button', { name: 'Importar ubicaciones' }).click();
    return responsePromise;
  };
  const firstWorkLocationImportResponse = await uploadPilaWorkLocation();
  expect(firstWorkLocationImportResponse.status()).toBe(200);
  await expect(
    workLocationImportDialog
      .getByRole('status')
      .filter({ hasText: '1 ubicación laboral PILA nueva registrada' }),
  ).toBeVisible();
  await workLocationImportDialog.getByRole('button', { name: 'Cerrar' }).last().click();

  await search.fill('12345678');
  const bulkLocationEmployeeRow = page.getByRole('row').filter({ hasText: '12345678' });
  await bulkLocationEmployeeRow.getByRole('link', { name: /Ver detalle de/ }).click();
  const importedLocation = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Ubicación laboral PILA' }) })
    .getByRole('listitem')
    .filter({ hasText: 'Barranquilla' });
  await expect(importedLocation).toContainText('Sin fecha final');
  await page.reload();
  await expect(
    page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Ubicación laboral PILA' }) })
      .getByRole('listitem')
      .filter({ hasText: 'Barranquilla' }),
  ).toContainText('Sin fecha final');

  await page.goto('/empleados');
  await page.getByRole('button', { name: 'Importar ubicaciones PILA' }).click();
  const retryWorkLocationImportDialog = page.getByRole('dialog', {
    name: 'Importar ubicaciones laborales PILA',
  });
  await retryWorkLocationImportDialog.locator('input[type="file"]').setInputFiles({
    name: 'plantilla_ubicaciones_laborales_pila.xlsx',
    mimeType: XLSX_MIME,
    buffer: workLocationBuffer,
  });
  await retryWorkLocationImportDialog.getByLabel(/Confirmo que cada municipio indicado/).check();
  const retryWorkLocationResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/employees/import/pila-work-locations' &&
      response.request().method() === 'POST',
  );
  await retryWorkLocationImportDialog.getByRole('button', { name: 'Importar ubicaciones' }).click();
  const retryWorkLocationResponse = await retryWorkLocationResponsePromise;
  expect(retryWorkLocationResponse.status()).toBe(200);
  await expect(
    retryWorkLocationImportDialog
      .getByRole('status')
      .filter({ hasText: '0 ubicaciones laborales PILA nuevas registradas; 1 fila sin cambios.' }),
  ).toBeVisible();

  const workAssignmentTemplateResponse = await page.evaluate(async () => {
    const response = await fetch('/api/employees/import/pila-work-assignments/template');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type'),
      base64: btoa(binary),
    };
  });
  expect(
    workAssignmentTemplateResponse.ok,
    `PILA assignment template request failed: ${workAssignmentTemplateResponse.status}`,
  ).toBe(true);
  expect(workAssignmentTemplateResponse.contentType).toContain(XLSX_MIME);
  const workAssignmentWorkbook = xlsx.read(
    Buffer.from(workAssignmentTemplateResponse.base64, 'base64'),
    { type: 'buffer' },
  );
  const workAssignmentSheetName = workAssignmentWorkbook.SheetNames[0] as string;
  const workAssignmentRows = xlsx.utils.sheet_to_json(
    workAssignmentWorkbook.Sheets[workAssignmentSheetName],
    { header: 1, defval: '' },
  ) as unknown[][];
  const workAssignmentHeaders = workAssignmentRows[0] as string[];
  const workAssignmentInput = {
    cedula: '12345678',
    tipoDocumento: 'CC',
    arlCodigo: 'ARL001',
    codigoCentro: 'E2E-001',
    codigoActividadEconomica: '1131202',
    vigenteDesde: '2026-01-01',
    vigenteHasta: '',
  };
  workAssignmentWorkbook.Sheets[workAssignmentSheetName] = xlsx.utils.aoa_to_sheet([
    workAssignmentHeaders,
    workAssignmentHeaders.map(
      (header) => workAssignmentInput[header as keyof typeof workAssignmentInput] ?? '',
    ),
  ]);
  const workAssignmentBuffer = Buffer.from(
    xlsx.write(workAssignmentWorkbook, { type: 'buffer', bookType: 'xlsx' }),
  );

  await page.goto('/empleados');
  await page.getByRole('button', { name: 'Importar centros ARL' }).click();
  const workAssignmentImportDialog = page.getByRole('dialog', {
    name: 'Importar centros y actividad PILA',
  });
  const uploadWorkAssignment = async () => {
    await workAssignmentImportDialog.locator('input[type="file"]').setInputFiles({
      name: 'plantilla_centros_actividad_arl_pila.xlsx',
      mimeType: XLSX_MIME,
      buffer: workAssignmentBuffer,
    });
    await workAssignmentImportDialog
      .getByLabel(/Confirmo que los centros y las actividades reportados/)
      .check();
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/employees/import/pila-work-assignments' &&
        response.request().method() === 'POST',
    );
    await workAssignmentImportDialog.getByRole('button', { name: 'Importar asignaciones' }).click();
    return responsePromise;
  };
  const firstWorkAssignmentImportResponse = await uploadWorkAssignment();
  expect(firstWorkAssignmentImportResponse.status()).toBe(200);
  await expect(
    workAssignmentImportDialog
      .getByRole('status')
      .filter({ hasText: '1 asignación de centro y actividad PILA nueva registrada' }),
  ).toBeVisible();
  await workAssignmentImportDialog.getByRole('button', { name: 'Cerrar' }).last().click();

  await search.fill('12345678');
  await page
    .getByRole('row')
    .filter({ hasText: '12345678' })
    .getByRole('link', { name: /Ver detalle de/ })
    .click();
  const importedWorkAssignmentPanel = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Centro de trabajo y actividad PILA' }),
  });
  const importedWorkAssignment = importedWorkAssignmentPanel
    .getByRole('listitem')
    .filter({ hasText: 'Centro ARL E2E' });
  await expect(importedWorkAssignment).toContainText('1131202');
  await expect(importedWorkAssignment).toContainText('Sin fecha final');
  await page.reload();
  await expect(
    page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Centro de trabajo y actividad PILA' }) })
      .getByRole('listitem')
      .filter({ hasText: 'Centro ARL E2E' }),
  ).toContainText('1131202');

  await page.goto('/empleados');
  await page.getByRole('button', { name: 'Importar centros ARL' }).click();
  const retryWorkAssignmentDialog = page.getByRole('dialog', {
    name: 'Importar centros y actividad PILA',
  });
  await retryWorkAssignmentDialog.locator('input[type="file"]').setInputFiles({
    name: 'plantilla_centros_actividad_arl_pila.xlsx',
    mimeType: XLSX_MIME,
    buffer: workAssignmentBuffer,
  });
  await retryWorkAssignmentDialog
    .getByLabel(/Confirmo que los centros y las actividades reportados/)
    .check();
  const retryWorkAssignmentResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/employees/import/pila-work-assignments' &&
      response.request().method() === 'POST',
  );
  await retryWorkAssignmentDialog.getByRole('button', { name: 'Importar asignaciones' }).click();
  const retryWorkAssignmentResponse = await retryWorkAssignmentResponsePromise;
  expect(retryWorkAssignmentResponse.status()).toBe(200);
  await expect(
    retryWorkAssignmentDialog.getByRole('status').filter({
      hasText: '0 asignaciones de centro y actividad PILA nuevas registradas; 1 fila sin cambios.',
    }),
  ).toBeVisible();
});
