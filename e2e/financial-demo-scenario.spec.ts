import { randomInt, randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { seedPayrollAccrualFixture } from './helpers/payroll-accounting-fixture';
import { seedBillingLedgerFixture } from './helpers/billing-ledger-fixture';

function dateInDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function registerAndSignIn(page: Page, suffix: string) {
  const nit = `5${suffix}`;
  const email = `financial-demo-${suffix}@example.test`;
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('Demo Financiera E2E');
  await page.getByLabel('Razón social').fill('Demo Financiera E2E S.A.S.');
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

test('muestra facturación, nómina y el detalle del Ledger en el mismo tenant', async ({ page }) => {
  const suffix = randomInt(10_000_000, 100_000_000).toString();
  const customerName = `Cliente Demo Financiero ${suffix}`;
  const customerNit = `9${suffix}`;
  const productName = `Servicio Demo Financiero ${suffix}`;
  const invoiceNumber = `DEMO-FIN-${suffix}`;
  const fechaVencimiento = dateInDays(30);
  const { tenant, user } = await registerAndSignIn(page, suffix);
  const billingFixture = await seedBillingLedgerFixture(tenant.id, customerNit, customerName);

  await page.goto('/facturacion/clientes');
  await page.getByRole('button', { name: 'Nuevo' }).click();
  const customerInputs = page.locator('input');
  await customerInputs.nth(0).fill(customerName);
  await customerInputs.nth(1).fill(customerNit);
  await customerInputs.nth(2).fill(`cliente-${suffix}@example.test`);
  await page.locator('select').selectOption({
    label: `${customerName} — NIT ${customerNit}`,
  });
  const createCustomerResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/billing/customers' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  expect((await createCustomerResponsePromise).status()).toBe(200);
  await expect(page.getByText(customerName, { exact: true })).toBeVisible();

  await page.goto('/facturacion/productos');
  await page.getByRole('button', { name: 'Nuevo' }).click();
  const productInputs = page.locator('input');
  await productInputs.nth(0).fill(productName);
  await productInputs.nth(1).fill('120000');
  await page.locator('select').selectOption('19');
  const createProductResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/billing/products' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  expect((await createProductResponsePromise).status()).toBe(200);
  await expect(page.getByText(productName, { exact: true })).toBeVisible();

  await page.goto('/facturacion/facturas');
  await page.getByRole('button', { name: 'Nueva' }).click();
  await page.locator('select').nth(0).selectOption({ label: customerName });
  await page.getByPlaceholder('FAC-001').fill(invoiceNumber);
  await page.getByLabel('Fecha de vencimiento').fill(fechaVencimiento);
  await page.locator('select').nth(1).selectOption({ label: productName });
  await page.getByPlaceholder('Cant').fill('1');
  // Re-enter the selected price to exercise the editable line-value field.
  await page.getByPlaceholder('V. Unit').fill('120000');

  const createInvoiceResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/billing/invoices' &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear factura' }).click();
  const createInvoiceResponse = await createInvoiceResponsePromise;
  const invoiceBody = await createInvoiceResponse.text();
  expect(createInvoiceResponse.status(), invoiceBody).toBe(200);
  const invoice = JSON.parse(invoiceBody) as {
    id: string;
    customerId: string;
    subtotal: number | string;
    impuestos: number | string;
    total: number | string;
  };
  expect(Number(invoice.subtotal)).toBe(120_000);
  expect(Number(invoice.impuestos)).toBe(22_800);
  expect(Number(invoice.total)).toBe(142_800);

  const invoiceRow = page.getByRole('link', { name: invoiceNumber }).locator('xpath=..');
  const issueResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/billing/invoices/${invoice.id}/status` &&
      response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Emitir' }).click();
  expect((await issueResponsePromise).status()).toBe(200);
  await expect(invoiceRow.getByText('Emitida', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: invoiceNumber }).click();
  await expect(page.getByText(productName, { exact: true })).toBeVisible();

  const receiptsPanel = page.getByRole('region', { name: 'Cartera y recaudos' });
  await expect(receiptsPanel.getByText('142.800')).toBeVisible();
  await page.getByLabel('Valor recibido (COP)').fill('40000');
  await page.getByLabel('Referencia (opcional)').fill(`TRX-${suffix}`);
  const receiptResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/billing/receipts' &&
      response.request().method() === 'POST',
  );
  await receiptsPanel.getByRole('button', { name: 'Registrar recaudo' }).click();
  const receiptResponse = await receiptResponsePromise;
  const receiptBody = await receiptResponse.text();
  expect(receiptResponse.status(), receiptBody).toBe(200);
  const receipt = JSON.parse(receiptBody) as {
    id: string;
    monto: number | string;
    comprobanteContable: {
      tipoComprobante: { codigo: string };
      totalDebito: number | string;
      totalCredito: number | string;
      movimientos: Array<{ debito: number | string; credito: number | string }>;
    };
  };
  expect(Number(receipt.monto)).toBe(40_000);
  expect(receipt.comprobanteContable.tipoComprobante.codigo).toBe('CI');
  expect(Number(receipt.comprobanteContable.totalDebito)).toBe(40_000);
  expect(Number(receipt.comprobanteContable.totalCredito)).toBe(40_000);
  expect(
    receipt.comprobanteContable.movimientos.reduce((sum, line) => sum + Number(line.debito), 0),
  ).toBe(40_000);

  const receiptRequestBody = receiptResponse.request().postDataJSON();
  const replayResponse = await page.evaluate(async (body) => {
    const response = await fetch('/api/billing/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }, receiptRequestBody);
  expect(replayResponse.status).toBe(200);
  expect((replayResponse.body as { id: string }).id).toBe(receipt.id);
  const applicationsResponse = await page.evaluate(async (invoiceId) => {
    const response = await fetch(`/api/billing/invoices/${invoiceId}/receipts`);
    return { status: response.status, body: await response.json() };
  }, invoice.id);
  expect(applicationsResponse.status).toBe(200);
  expect(applicationsResponse.body).toHaveLength(1);
  await expect(receiptsPanel.locator('strong').nth(0)).toContainText('40.000');
  await expect(receiptsPanel.locator('strong').nth(1)).toContainText('102.800');

  const cancelResponse = await page.evaluate(async (invoiceId) => {
    const response = await fetch(`/api/billing/invoices/${invoiceId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'CANCELLED',
        motivo: 'Prueba de protección de cartera',
      }),
    });
    return { status: response.status, body: await response.json() };
  }, invoice.id);
  expect(cancelResponse.status).toBe(409);

  page.once('dialog', (dialog) => dialog.accept('Reversión para verificar el flujo de demo'));
  const reversalResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/billing/receipts/${receipt.id}/reversal` &&
      response.request().method() === 'POST',
  );
  await receiptsPanel.getByRole('button', { name: 'Reversar' }).click();
  const reversalResponse = await reversalResponsePromise;
  const reversalBody = await reversalResponse.text();
  expect(reversalResponse.status(), reversalBody).toBe(200);
  const reversal = JSON.parse(reversalBody) as {
    reason: string;
    comprobanteContable: {
      id: string;
      totalDebito: number | string;
      totalCredito: number | string;
    };
  };
  expect(reversal.reason).toBe('Reversión para verificar el flujo de demo');
  expect(Number(reversal.comprobanteContable.totalDebito)).toBe(40_000);
  expect(Number(reversal.comprobanteContable.totalCredito)).toBe(40_000);
  await expect(receiptsPanel.locator('strong').nth(0)).toContainText('0');
  await expect(receiptsPanel.locator('strong').nth(1)).toContainText('142.800');
  await expect(receiptsPanel.getByText('Reversado')).toBeVisible();

  const concurrentReceipts = await page.evaluate(
    async ({ customerId, invoiceId, fechaRecibo, keys }) => {
      const submit = (idempotencyKey: string) =>
        fetch('/api/billing/receipts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId,
            fechaRecibo,
            medio: 'TRANSFERENCIA',
            monto: 100_000,
            idempotencyKey,
            aplicaciones: [{ invoiceId, amount: 100_000 }],
          }),
        });
      const responses = await Promise.all(keys.map(submit));
      return Promise.all(
        responses.map(async (response) => ({
          status: response.status,
          body: await response.json(),
        })),
      );
    },
    {
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      fechaRecibo: dateInDays(0),
      keys: [randomUUID(), randomUUID()],
    },
  );
  expect(concurrentReceipts.map(({ status }) => status).sort()).toEqual([200, 409]);
  await page.reload();
  await expect(receiptsPanel.locator('strong').nth(0)).toContainText('100.000');
  await expect(receiptsPanel.locator('strong').nth(1)).toContainText('42.800');

  await page.goto('/contabilidad/comprobantes');
  await expect(page.getByRole('heading', { name: 'Comprobantes contabilizados' })).toBeVisible();
  const invoiceVoucher = page
    .getByRole('row')
    .filter({ hasText: `Factura interna ${invoiceNumber}` });
  await expect(invoiceVoucher).toBeVisible();
  await invoiceVoucher.getByRole('button', { name: /Ver movimientos del comprobante/ }).click();
  const invoiceVoucherDetails = page.getByRole('dialog');
  await expect(invoiceVoucherDetails).toContainText(`Cuenta por cobrar factura ${invoiceNumber}`);
  await expect(invoiceVoucherDetails).toContainText(`Ingreso factura ${invoiceNumber}`);
  await expect(invoiceVoucherDetails).toContainText(`IVA generado factura ${invoiceNumber}`);
  await expect(invoiceVoucherDetails).toContainText('Clientes nacionales E2E');
  await expect(invoiceVoucherDetails).toContainText('Ingresos operacionales E2E');
  await expect(invoiceVoucherDetails).toContainText('IVA generado E2E');
  await expect(invoiceVoucherDetails.getByText(/Total débito:/).locator('..')).toContainText(
    '142.800',
  );
  await expect(invoiceVoucherDetails.getByText(/Total crédito:/).locator('..')).toContainText(
    '142.800',
  );

  const payroll = await seedPayrollAccrualFixture(tenant.id, user.id);
  try {
    await page.goto(`/nomina/periodos/${payroll.periodId}`);
    await expect(page.getByRole('heading', { name: 'Nómina marzo 2026' })).toBeVisible();
    await expect(page.getByText('Ana Pérez')).toBeVisible();

    const postingResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/payroll/periods/${payroll.periodId}/contabilizar` &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Contabilizar en Ledger' }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Contabilizar nómina' })
      .click();

    const postingResponse = await postingResponsePromise;
    expect(postingResponse.status()).toBe(200);
    const posting = (await postingResponse.json()) as {
      status: string;
      comprobanteId: string;
    };
    expect(posting.status).toBe('CAUSADA');
    await expect(page.getByText('Nómina contabilizada en el Ledger.')).toBeVisible();
    await expect(page.getByText(`ID de comprobante: ${posting.comprobanteId}`)).toBeVisible();

    await page.reload();
    await expect(page.getByText(`ID de comprobante: ${posting.comprobanteId}`)).toBeVisible();

    const pilaPreparationPanel = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Preparación de datos PILA' }) });
    await expect(pilaPreparationPanel).toBeVisible();

    const preparationResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `/api/payroll/periods/${payroll.periodId}/pila-preparation` &&
        response.request().method() === 'GET',
    );
    await pilaPreparationPanel.getByRole('button', { name: 'Revisar datos' }).click();
    const preparationResponse = await preparationResponsePromise;
    expect(preparationResponse.status()).toBe(200);
    const preparation = (await preparationResponse.json()) as {
      formatVersion: string | null;
      normativeSourceStatus: string;
      exportReadiness: {
        recordLayoutVersion: string;
        fileGenerationStatus: string;
        localValidationStatus: string;
        operatorAcceptanceStatus: string;
        blockers: Array<{ code: string }>;
      };
      snapshotsRevisados: number;
      empleadosConDatosPendientes: number;
      archivoGenerable: boolean;
      estadoArchivo: string;
      employerCandidate: {
        values: Partial<
          Record<number, { value: string | number | null; emptyAs?: 'spaces' | 'zeros' }>
        >;
      };
      issues: Array<{ code: string; affectedCount: number }>;
    };
    expect(preparation.formatVersion).toBeNull();
    expect(preparation.normativeSourceStatus).toBe('RECONCILIATION_PENDING');
    expect(preparation.exportReadiness).toMatchObject({
      recordLayoutVersion: 'AT2_V30',
      fileGenerationStatus: 'NOT_IMPLEMENTED',
      localValidationStatus: 'PRELIMINARY',
      operatorAcceptanceStatus: 'NOT_VERIFIED',
    });
    expect(preparation.exportReadiness.blockers.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'AT2_FILE_MAPPING_NOT_IMPLEMENTED',
        'PILA_PAYMENT_DATE_REQUIRED',
        'OPERATOR_UPLOAD_NOT_VERIFIED',
      ]),
    );
    expect(preparation.snapshotsRevisados).toBe(1);
    expect(preparation.empleadosConDatosPendientes).toBe(1);
    expect(preparation.archivoGenerable).toBe(false);
    expect(preparation.estadoArchivo).toBe('NO_IMPLEMENTADO');
    expect(preparation.employerCandidate.values[16]).toEqual({
      value: null,
      emptyAs: 'zeros',
    });
    expect(preparation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CAMPO_33_EXONERACION_SIN_CONFIRMAR',
          affectedCount: 1,
        }),
      ]),
    );
    await expect(pilaPreparationPanel.getByText('Snapshots revisados: 1')).toBeVisible();
    await expect(
      pilaPreparationPanel.getByText(
        /Falta confirmar si aplica la exoneración de salud, SENA e ICBF/,
      ),
    ).toBeVisible();
    await expect(
      pilaPreparationPanel.getByText(/no genera archivos ni confirma aceptación de un operador/i),
    ).toBeVisible();
    await expect(
      pilaPreparationPanel.getByRole('heading', {
        name: 'Estado de exportación PILA',
      }),
    ).toBeVisible();
    await expect(pilaPreparationPanel.getByText('No implementadas')).toBeVisible();
    await expect(
      pilaPreparationPanel.getByText('Preliminar; no cubre el archivo completo'),
    ).toBeVisible();
    await expect(pilaPreparationPanel.getByText('No verificada')).toBeVisible();
    await expect(
      pilaPreparationPanel.getByText(/No se ha probado un archivo candidato/),
    ).toBeVisible();

    const persisted = await payroll.inspectPersistedState();
    expect(persisted.periodStatus).toBe('CAUSADA');
    expect(persisted.vouchers).toEqual([{ id: posting.comprobanteId, estado: 'CONTABILIZADO' }]);
    expect(persisted.snapshotPayload).toEqual(payroll.snapshotPayload);
    expect(persisted.snapshotStatus).toBe('APROBADA');
    expect(persisted.pilaSnapshotPayload).toEqual(payroll.pilaSnapshotPayload);

    await pilaPreparationPanel.getByRole('button', { name: 'Actualizar revisión' }).click();
    await expect(
      pilaPreparationPanel.getByText('Campo 50 · Total de aportes a pensión (campos 47–49)', {
        exact: true,
      }),
    ).toBeVisible();
    const upcFieldStatus = pilaPreparationPanel
      .getByText('Campo 56 · Valor de UPC adicional (solo cotizante 40)', { exact: true })
      .locator('xpath=..');
    await expect(upcFieldStatus).toContainText('Con candidato: 1; pendientes: 0.');
    await expect(
      page.getByRole('heading', {
        name: 'Archivo tipo 1 · aportante · candidatos por campo',
      }),
    ).toBeVisible();
    await page.getByText('Ver estado de los 34 campos del aportante').click();
    const employerCandidateRegion = page.getByRole('region', {
      name: 'Archivo tipo 1 · aportante · candidatos por campo',
    });
    await expect(
      employerCandidateRegion.getByText('Demo Financiera E2E S.A.S.', { exact: true }),
    ).toBeVisible();
    const employerFaxField = employerCandidateRegion
      .getByText('Campo 16 · Fax', { exact: true })
      .locator('xpath=..');
    await expect(employerFaxField).toContainText('Ceros según regla candidata');
    const employerOperatorCodeField = page
      .getByText('Campo 28 · Código del operador', { exact: true })
      .locator('xpath=..');
    await expect(employerOperatorCodeField).toContainText('En blanco según regla candidata');
    await expect(
      page.getByRole('heading', { name: 'Encabezado tipo 2 · candidatos por campo' }),
    ).toBeVisible();
    await page.getByText('Ver estado de los 22 campos del encabezado').click();
    const headerOperatorModeField = page
      .getByText('Campo 2 · Modalidad de planilla', { exact: true })
      .locator('xpath=..');
    await expect(headerOperatorModeField).toContainText('En blanco según regla candidata');
    await expect(page.getByText('Campo 20 · Total IBC de caja de compensación')).toBeVisible();
    await expect(page.getByText('1.000.000', { exact: true })).toBeVisible();
    await expect(page.getByText('No implementadas', { exact: true })).toBeVisible();

    await page.goto('/contabilidad/comprobantes');
    await expect(page.getByRole('heading', { name: 'Comprobantes contabilizados' })).toBeVisible();
    const payrollVoucher = page
      .getByRole('row')
      .filter({ hasText: 'Causación nómina Nómina marzo 2026' });
    await expect(payrollVoucher).toBeVisible();
    await payrollVoucher.getByRole('button', { name: /Ver movimientos del comprobante/ }).click();

    const voucherDetails = page.getByRole('dialog');
    await expect(voucherDetails).toContainText('Gasto de sueldos');
    await expect(voucherDetails).toContainText('Salarios netos por pagar');
    await expect(voucherDetails).toContainText('Total débito');
    await expect(voucherDetails).toContainText('Total crédito');
  } finally {
    await payroll.disconnect();
    await billingFixture.disconnect();
  }
});
