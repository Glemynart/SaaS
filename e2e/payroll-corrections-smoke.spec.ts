import { expect, test, type Page, type Route } from '@playwright/test';

type Correction = {
  id: string;
  payrollPeriodId: string;
  status: 'BORRADOR' | 'EN_REVISION' | 'APROBADA';
  descripcion: string;
  createdAt: string;
  intent: unknown;
  materialization: unknown;
  accountingVoucher?: {
    id: string;
    numero: number;
    fecha: string;
    concepto: string;
    estado: string;
    totalDebito: number;
    totalCredito: number;
    movimientos: Array<{
      linea: number;
      descripcion: string | null;
      debito: number;
      credito: number;
      cuentaCodigo: string;
      cuentaNombre: string;
      centroCostoCodigo: string | null;
      centroCostoNombre: string | null;
    }>;
  } | null;
};

async function json(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function registerAndSignIn(page: Page) {
  const suffix = Date.now().toString().slice(-8);
  const nit = `7${suffix}`;
  const email = `payroll-correction-${suffix}@example.test`;
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('Payroll Corrections E2E');
  await page.getByLabel('Razón social').fill('Payroll Corrections E2E S.A.S.');
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

test('permite crear, revisar, aprobar y contabilizar una corrección post-aprobación', async ({
  page,
}) => {
  await registerAndSignIn(page);

  const periodId = 'period-correction-ui';
  const snapshotId = 'snapshot-correction-ui';
  const correctionId = 'correction-ui';
  const centerId = 'cost-center-ui';
  const corrections: Correction[] = [];
  let postedCorrection = false;
  let submittedIntent: unknown;

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
          status: 'APROBADA',
          empleadosProcesados: 1,
          createdAt: '2026-03-31T00:00:00.000Z',
        },
        runs: [],
        snapshots: [
          {
            id: snapshotId,
            employeeId: 'employee-e2e',
            centroCostoId: centerId,
            employee: {
              id: 'employee-e2e',
              primerNombre: 'Ana',
              segundoNombre: null,
              primerApellido: 'Pérez',
              segundoApellido: null,
            },
            centroCosto: { id: centerId, codigo: 'CC-01', nombre: 'Sede Centro' },
          },
        ],
        totals: { totalDevengos: 2_000_000, totalDeducciones: 160_000, totalNeto: 1_840_000 },
        accountingVoucher: null,
      });
      return;
    }

    if (url.pathname === `/api/payroll/periods/${periodId}/blocks` && method === 'GET') {
      await json(route, 200, []);
      return;
    }

    if (url.pathname === `/api/payroll/periods/${periodId}/corrections`) {
      if (method === 'GET') {
        await json(
          route,
          200,
          corrections.map((correction) => ({
            ...correction,
            accountingVoucher: postedCorrection
              ? {
                  id: 'voucher-correction-ui',
                  numero: 91,
                  fecha: '2026-04-01T00:00:00.000Z',
                  concepto: 'Ajuste nómina: Diferencia salario base',
                  estado: 'CONTABILIZADO',
                  totalDebito: 500_000,
                  totalCredito: 500_000,
                  movimientos: [
                    {
                      linea: 1,
                      descripcion: 'Ajuste salario base',
                      debito: 500_000,
                      credito: 0,
                      cuentaCodigo: '510506',
                      cuentaNombre: 'Gastos de personal',
                      centroCostoCodigo: 'CC-01',
                      centroCostoNombre: 'Sede Centro',
                    },
                    {
                      linea: 2,
                      descripcion: 'Ajuste salario base',
                      debito: 0,
                      credito: 500_000,
                      cuentaCodigo: '250501',
                      cuentaNombre: 'Salarios por pagar',
                      centroCostoCodigo: 'CC-01',
                      centroCostoNombre: 'Sede Centro',
                    },
                  ],
                }
              : null,
          })),
        );
        return;
      }

      if (method === 'POST') {
        const payload = route.request().postDataJSON() as {
          descripcion: string;
          intents: unknown;
        };
        submittedIntent = payload.intents;
        corrections.push({
          id: correctionId,
          payrollPeriodId: periodId,
          status: 'BORRADOR',
          descripcion: payload.descripcion,
          createdAt: '2026-03-31T00:00:00.000Z',
          intent: {
            version: 1,
            intents: [{ id: 'intent-1', ...(payload.intents as Array<object>)[0] }],
          },
          materialization: null,
          accountingVoucher: null,
        });
        await json(route, 201, corrections[0]);
        return;
      }
    }

    const action = url.pathname.match(/^\/api\/payroll\/corrections\/([^/]+)\/([^/]+)$/);
    if (action && method === 'POST' && action[1] === correctionId) {
      if (action[2] === 'contabilizar') {
        postedCorrection = true;
        await json(route, 200, {
          status: 'AJUSTADA',
          payrollCorrectionId: correctionId,
          comprobanteId: 'voucher-correction-ui',
        });
        return;
      }

      const correction = corrections.find((item) => item.id === correctionId)!;
      if (action[2] === 'enviar-revision') correction.status = 'EN_REVISION';
      if (action[2] === 'aprobar') {
        correction.status = 'APROBADA';
        correction.materialization = {
          version: 1,
          generatedAt: '2026-04-01T00:00:00.000Z',
          snapshotIds: [snapshotId],
          approvedCorrectionIds: [],
          entries: [
            {
              snapshotId,
              employeeId: 'employee-e2e',
              centroCostoId: centerId,
              concept: { codigo: 'SALARIO_BASE', tipo: 'EARNING' },
              delta: 500_000,
            },
          ],
        };
      }
      await json(route, 200, correction);
      return;
    }

    await route.continue();
  });

  await page.route('**/api/accounting/centros-costo**', async (route) => {
    await json(route, 200, [{ id: centerId, codigo: 'CC-01', nombre: 'Sede Centro' }]);
  });

  await page.goto(`/nomina/periodos/${periodId}`);
  await expect(page.getByRole('heading', { name: 'Nómina marzo 2026' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Correcciones de nómina' })).toBeVisible();
  await page.getByRole('button', { name: 'Nueva corrección' }).click();
  await page.getByLabel('Descripción de la corrección').fill('Diferencia salario base');
  await page.getByLabel('Empleado de la nómina aprobada').selectOption(snapshotId);
  await page.getByLabel('Dato que se corrige').selectOption('SALARIO_BASE');
  await page.getByLabel('Nuevo valor en pesos').fill('2500000');
  await page.getByRole('button', { name: 'Crear corrección' }).click();

  await expect(page.getByText('Corrección creada como borrador.')).toBeVisible();
  await expect(page.getByText('Nuevo salario base')).toBeVisible();
  await expect(page.getByText(/2\.500\.000/)).toBeVisible();
  expect(submittedIntent).toEqual([
    {
      kind: 'SET_CALCULATION_INPUT',
      snapshotId,
      input: 'SALARIO_BASE',
      targetAmount: 2_500_000,
    },
  ]);

  await page.getByRole('button', { name: 'Enviar a revisión' }).click();
  await expect(page.getByText('En revisión')).toBeVisible();
  await page.getByRole('button', { name: 'Aprobar corrección' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Aprobar corrección' }).click();
  await expect(page.getByText('Aprobada', { exact: true })).toBeVisible();
  await expect(page.getByText(/^\+\s*\$\s*500\.000$/)).toBeVisible();

  await page.getByRole('button', { name: 'Contabilizar ajuste' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Contabilizar ajuste' }).click();
  await expect(page.getByText('Ajuste contabilizado · Comprobante 91')).toBeVisible();
  await expect(page.getByText(/^Débitos.*voucher-correction-ui$/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Contabilizar en Ledger' })).toBeVisible();
});
