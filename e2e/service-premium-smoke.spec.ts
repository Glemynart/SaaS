import { randomInt, randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

async function registerAndSignIn(page: Page) {
  const suffix = randomInt(10_000_000, 100_000_000).toString();
  const nit = `7${suffix}`;
  const email = `service-premium-${suffix}@example.test`;
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('Prima servicios E2E');
  await page.getByLabel('Razón social').fill('Prima servicios E2E S.A.S.');
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

async function seedServicePremiumFixture(tenantId: string, actorId: string) {
  const { PrismaClient } = require('../apps/api/node_modules/@prisma/client') as {
    PrismaClient: new () => any;
  };
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  const employeeId = randomUUID();
  const contractId = randomUUID();
  const employeeName = 'Ana Prima E2E';
  const employeeDocument = `service-premium-${suffix}`;
  const salary = 2_000_000;
  const transport = 200_000;

  try {
    await prisma.$connect();
    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;

      await tx.empleado.create({
        data: {
          id: employeeId,
          tenantId,
          cedula: employeeDocument,
          tipoDocumento: 'CC',
          primerNombre: 'Ana',
          primerApellido: 'Prima E2E',
          cargo: 'Analista',
          salario: salary,
          fechaIngreso: new Date('2026-01-01T00:00:00.000Z'),
          estado: 'ACTIVO',
        },
      });
      await tx.contrato.create({
        data: {
          id: contractId,
          tenantId,
          empleadoId: employeeId,
          tipo: 'TERMINO_FIJO',
          estado: 'VIGENTE',
          fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
          fechaFin: new Date('2026-12-31T00:00:00.000Z'),
          cargo: 'Analista',
          salario: salary,
        },
      });

      for (let month = 1; month <= 6; month += 1) {
        const periodId = randomUUID();
        const payrollRunId = randomUUID();
        const snapshotId = randomUUID();
        const monthString = String(month).padStart(2, '0');
        const start = new Date(Date.UTC(2026, month - 1, 1));
        const end = new Date(Date.UTC(2026, month, 0));
        const startIso = start.toISOString();
        const endIso = end.toISOString();

        await tx.payrollPeriod.create({
          data: {
            id: periodId,
            tenantId,
            nombre: `Prima E2E ${monthString} 2026`,
            fechaInicio: start,
            fechaFin: end,
            status: 'APROBADA',
            aprobadoPorId: actorId,
            aprobadoEn: end,
          },
        });
        await tx.payrollRun.create({
          data: {
            id: payrollRunId,
            tenantId,
            payrollPeriodId: periodId,
            employeeId,
            totalDevengos: salary,
            totalDeducciones: 0,
            netoPagar: salary,
            totalAportesPatronales: 0,
            totalProvisiones: 0,
            salarioBaseSnapshot: salary,
          },
        });
        await tx.payrollSnapshot.create({
          data: {
            id: snapshotId,
            tenantId,
            payrollRunId,
            payrollPeriodId: periodId,
            employeeId,
            contratoId: contractId,
            estadoPeriodo: 'APROBADA',
            origen: 'BROWSER_E2E',
            payloadVersion: 1,
            payload: {
              period: { fechaInicio: startIso, fechaFin: endIso },
              employee: {
                employeeId,
                salarioBaseUsado: salary,
                salarioIntegralUsado: false,
              },
              contract: {
                contratoId: contractId,
                tipo: 'TERMINO_FIJO',
                estado: 'VIGENTE',
                fechaInicio: '2026-01-01T00:00:00.000Z',
                fechaFin: '2026-12-31T00:00:00.000Z',
              },
              legalParameters: { auxilioTransporte: transport },
              novelties: [],
              concepts: [
                { codigo: 'SALARIO_BASE', tipo: 'EARNING', valor: salary },
                { codigo: 'PROV_PRIMA', tipo: 'PROVISION', valor: 183_333 },
              ],
              totals: { auxilioTransporte: transport },
            },
          },
        });
      }
    });

    return {
      employeeId,
      employeeName,
      inspectPersistedState: async () =>
        prisma.$transaction(async (tx: any) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
          const batch = await tx.servicePremiumBatch.findFirst({
            where: { tenantId, anio: 2026, semestre: 1 },
            include: { lines: true },
          });
          const line = batch?.lines[0];
          const document = line
            ? await tx.expedienteDoc.findFirst({
                where: { tenantId, servicePremiumLineId: line.id },
              })
            : null;
          return { batch, line, document };
        }),
      disconnect: () => prisma.$disconnect(),
    };
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}

test('liquida prima por lote y publica el PDF inmutable en el expediente', async ({ page }) => {
  const { tenant, user } = await registerAndSignIn(page);
  const fixture = await seedServicePremiumFixture(tenant.id, user.id);

  try {
    await page.goto('/nomina/prima');
    await page.getByLabel('Año', { exact: true }).fill('2026');

    const previewResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/payroll/service-premiums' &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Crear vista previa' }).click();
    const previewResponse = await previewResponsePromise;
    expect(previewResponse.status()).toBe(200);

    await expect(page.getByText(fixture.employeeName, { exact: true })).toBeVisible();
    await expect(page.getByText('Lista para aprobar', { exact: true })).toBeVisible();
    await expect(page.getByText('1.100.000', { exact: false }).first()).toBeVisible();

    const approveResponsePromise = page.waitForResponse(
      (response) =>
        /\/api\/payroll\/service-premiums\/[0-9a-f-]+\/approve$/.test(
          new URL(response.url()).pathname,
        ) && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Aprobar y generar 1 PDF' }).click();
    const approveResponse = await approveResponsePromise;
    expect(approveResponse.status()).toBe(200);

    await expect
      .poll(async () => (await fixture.inspectPersistedState()).line?.status, {
        timeout: 90_000,
        intervals: [2_000, 3_000, 5_000],
      })
      .toBe('DOCUMENTADA');
    await expect(page.getByRole('link', { name: /Ver PDF/ })).toBeVisible();

    const persisted = await fixture.inspectPersistedState();
    expect(persisted.batch?.status).toBe('COMPLETADO');
    expect(Number(persisted.line?.amount)).toBe(1_100_000);
    expect(persisted.line?.serviceDays360).toBe(180);
    expect(persisted.line?.documentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted.document?.categoria).toBe('PRIMA_SERVICIOS');
    if (!persisted.document) throw new Error('No se publicó el PDF en el expediente.');

    await page.getByRole('link', { name: /Ver PDF/ }).click();
    await expect(page).toHaveURL(`/empleados/${fixture.employeeId}/expediente`);
    await expect(
      page.getByText('Prima de servicios 2026 S1 v1.pdf', { exact: true }),
    ).toBeVisible();

    const download = await page.evaluate(async (documentId) => {
      const response = await fetch(`/api/expediente-docs/${documentId}/download`);
      const content = new Uint8Array(await response.arrayBuffer());
      return {
        status: response.status,
        contentType: response.headers.get('Content-Type'),
        signature: String.fromCharCode(...content.slice(0, 4)),
      };
    }, persisted.document.id);
    expect(download).toEqual({ status: 200, contentType: 'application/pdf', signature: '%PDF' });
  } finally {
    await fixture.disconnect();
  }
});
