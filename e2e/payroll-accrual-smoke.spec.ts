import { expect, test, type Page, type Route } from '@playwright/test';

async function json(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function registerAndSignIn(page: Page) {
  const suffix = Date.now().toString().slice(-8);
  const nit = `6${suffix}`;
  const email = `payroll-accrual-${suffix}@example.test`;
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('Payroll Accrual E2E');
  await page.getByLabel('Razón social').fill('Payroll Accrual E2E S.A.S.');
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
}

test('contabiliza una nómina aprobada y muestra el comprobante', async ({ page }) => {
  await registerAndSignIn(page);

  const periodId = 'period-accrual-ui';
  let posted = false;
  let postingRequests = 0;
  const voucher = {
    id: 'voucher-accrual-ui',
    numero: 14,
    fecha: '2026-03-31T00:00:00.000Z',
    concepto: 'Causación nómina marzo 2026',
    estado: 'CONTABILIZADO',
    totalDebito: 1_000_000,
    totalCredito: 1_000_000,
    movimientos: [
      {
        linea: 1,
        descripcion: 'Causación de salarios',
        debito: 1_000_000,
        credito: 0,
        cuentaCodigo: '510506',
        cuentaNombre: 'Gasto de sueldos',
        centroCostoCodigo: 'CC-01',
        centroCostoNombre: 'Sede Centro',
      },
      {
        linea: 2,
        descripcion: 'Salarios netos por pagar',
        debito: 0,
        credito: 920_000,
        cuentaCodigo: '250505',
        cuentaNombre: 'Salarios por pagar',
        centroCostoCodigo: 'CC-01',
        centroCostoNombre: 'Sede Centro',
      },
      {
        linea: 3,
        descripcion: 'Aportes de salud por pagar',
        debito: 0,
        credito: 40_000,
        cuentaCodigo: '237005',
        cuentaNombre: 'Aportes salud por pagar',
        centroCostoCodigo: 'CC-01',
        centroCostoNombre: 'Sede Centro',
      },
      {
        linea: 4,
        descripcion: 'Aportes de nómina por pagar',
        debito: 0,
        credito: 40_000,
        cuentaCodigo: '237010',
        cuentaNombre: 'Aportes pensión por pagar',
        centroCostoCodigo: 'CC-01',
        centroCostoNombre: 'Sede Centro',
      },
    ],
  };

  await page.route('**/api/payroll/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (url.pathname === `/api/payroll/periods/${periodId}` && method === 'GET') {
      await json(route, 200, {
        period: {
          id: periodId,
          tenantId: 'tenant-e2e',
          nombre: 'Nómina marzo 2026',
          fechaInicio: '2026-03-01T00:00:00.000Z',
          fechaFin: '2026-03-31T00:00:00.000Z',
          status: posted ? 'CAUSADA' : 'APROBADA',
          empleadosProcesados: 1,
          createdAt: '2026-03-31T00:00:00.000Z',
        },
        runs: [
          {
            id: 'run-accrual-ui',
            employee: {
              id: 'employee-accrual-ui',
              primerNombre: 'Ana',
              segundoNombre: null,
              primerApellido: 'Pérez',
              segundoApellido: null,
              cargo: 'Docente',
            },
            totalDevengos: 1_000_000,
            totalDeducciones: 80_000,
            netoPagar: 920_000,
            concepts: [
              { id: 'concept-salary', tipo: 'EARNING', nombre: 'Salario base', valor: 1_000_000 },
              { id: 'concept-health', tipo: 'DEDUCTION', nombre: 'Salud empleado', valor: 40_000 },
              {
                id: 'concept-pension',
                tipo: 'DEDUCTION',
                nombre: 'Pensión empleado',
                valor: 40_000,
              },
            ],
          },
        ],
        totals: { totalDevengos: 1_000_000, totalDeducciones: 80_000, totalNeto: 920_000 },
        accountingVoucher: posted ? voucher : null,
      });
      return;
    }

    if (url.pathname === `/api/payroll/periods/${periodId}/blocks` && method === 'GET') {
      await json(route, 200, []);
      return;
    }

    if (url.pathname === `/api/payroll/periods/${periodId}/contabilizar` && method === 'POST') {
      postingRequests += 1;
      posted = true;
      await json(route, 200, {
        status: 'CAUSADA',
        payrollPeriodId: periodId,
        comprobanteId: voucher.id,
      });
      return;
    }

    await route.continue();
  });

  await page.goto(`/nomina/periodos/${periodId}`);
  await expect(page.getByRole('heading', { name: 'Nómina marzo 2026' })).toBeVisible();
  await expect(page.getByText('Contabilizar en Ledger')).toBeVisible();
  await page.getByRole('button', { name: 'Contabilizar en Ledger' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Contabilizar nómina' }).click();

  await expect(page.getByText('Nómina contabilizada en el Ledger.')).toBeVisible();
  await expect(page.getByText('Comprobante 14')).toBeVisible();
  await expect(page.getByText(/ID de comprobante: voucher-accrual-ui/)).toBeVisible();
  await expect(page.getByText(/Gasto de sueldos/)).toBeVisible();
  expect(postingRequests).toBe(1);
});
