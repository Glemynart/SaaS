import { randomInt, randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

async function registerAndSignIn(page: Page) {
  const suffix = randomInt(10_000_000, 100_000_000).toString();
  const nit = `5${suffix}`;
  const email = `payroll-approval-block-${suffix}@example.test`;
  const password = 'E2e-password-123!';

  await page.goto('/registro');
  await page.getByLabel('NIT', { exact: true }).fill(nit);
  await page.getByLabel('Dígito').fill('1');
  await page.getByLabel('Nombre comercial').fill('Payroll Approval Block E2E');
  await page.getByLabel('Razón social').fill('Payroll Approval Block E2E S.A.S.');
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
  };

  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await page.getByLabel('NIT de la empresa').fill(nit);
  await page.getByLabel('Correo').fill(email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  return registration.tenant.id;
}

async function seedApprovalBlockFixture(tenantId: string) {
  const { PrismaClient } = require('../apps/api/node_modules/@prisma/client') as {
    PrismaClient: new () => any;
  };
  const prisma = new PrismaClient();
  const employeeId = randomUUID();
  const periodId = randomUUID();
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const periodName = `Nómina bloque aprobación ${suffix}`;
  const employeeName = 'Empleado Sin Contrato';

  await prisma.$connect();
  await prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    await tx.parametroLegalNomina.create({
      data: {
        tenantId,
        vigenciaDesde: new Date('2026-01-01T00:00:00.000Z'),
        anio: 2026,
        smmlv: 1_423_500,
        auxilioTransporte: 202_897,
        uvt: 49_799,
        pctSaludEmpleado: 0.04,
        pctPensionEmpleado: 0.04,
        pctSaludEmpleador: 0.085,
        pctPensionEmpleador: 0.12,
        pctCaja: 0.04,
        pctIcbf: 0.03,
        pctSena: 0.02,
        arlClaseI: 0.00522,
        arlClaseII: 0.01044,
        arlClaseIII: 0.02436,
        arlClaseIV: 0.0435,
        arlClaseV: 0.0696,
        factorProvPrima: 0.0833,
        factorProvCesantias: 0.0833,
        factorProvIntCesantias: 0.01,
        factorProvVacaciones: 0.0417,
        fspTramos: [],
      },
    });
    await tx.empleado.create({
      data: {
        id: employeeId,
        tenantId,
        cedula: `approval-block-${suffix}`,
        primerNombre: 'Empleado',
        primerApellido: 'Sin Contrato',
        cargo: 'Auxiliar',
        salario: 1_000_000,
        fechaIngreso: new Date('2025-01-01T00:00:00.000Z'),
      },
    });
    await tx.payrollPeriod.create({
      data: {
        id: periodId,
        tenantId,
        nombre: periodName,
        fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
        fechaFin: new Date('2026-01-31T00:00:00.000Z'),
        status: 'EN_REVISION',
      },
    });
  });

  return {
    employeeId,
    employeeName,
    periodId,
    periodName,
    inspect: () =>
      prisma.$transaction(async (tx: any) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        const [period, blocks, snapshots] = await Promise.all([
          tx.payrollPeriod.findFirst({
            where: { id: periodId, tenantId },
            select: { status: true },
          }),
          tx.payrollBlock.findMany({
            where: { tenantId, payrollPeriodId: periodId },
            select: { code: true, status: true, employeeId: true },
          }),
          tx.payrollSnapshot.count({ where: { tenantId, payrollPeriodId: periodId } }),
        ]);
        return { period, blocks, snapshots };
      }),
    disconnect: async () => {
      try {
        await prisma.$transaction(async (tx: any) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
          await tx.payrollBlock.deleteMany({ where: { tenantId, payrollPeriodId: periodId } });
          await tx.payrollPeriod.deleteMany({ where: { id: periodId, tenantId } });
          await tx.empleado.deleteMany({ where: { id: employeeId, tenantId } });
          await tx.parametroLegalNomina.deleteMany({
            where: { tenantId, anio: 2026 },
          });
          await tx.tenant.deleteMany({ where: { id: tenantId } });
        });
      } finally {
        await prisma.$disconnect();
      }
    },
  };
}

test('conserva y muestra los bloqueos detectados al rechazar aprobación de nómina', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const tenantId = await registerAndSignIn(page);
  const fixture = await seedApprovalBlockFixture(tenantId);

  try {
    await page.goto('/nomina/periodos');
    const periodCard = () =>
      page.getByText(fixture.periodName, { exact: true }).locator('xpath=../..');
    await expect(periodCard()).toBeVisible();

    const approvalResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/payroll/periods/${fixture.periodId}/aprobar` &&
        response.request().method() === 'POST',
    );
    await periodCard().getByRole('button', { name: 'Aprobar' }).click();
    const approvalResponse = await approvalResponsePromise;
    expect(approvalResponse.status()).toBe(400);

    const approvalError = page.locator('p[role="alert"]');
    await expect(approvalError).toContainText('bloqueos funcionales activos');
    await approvalError.getByRole('link', { name: 'Abrir período' }).click();
    await expect(page).toHaveURL(new RegExp(`/nomina/periodos/${fixture.periodId}$`));
    await expect(page.getByText(fixture.employeeName, { exact: false })).toBeVisible();
    await expect(page.getByText(/no existe contrato para el empleado/i)).toBeVisible();

    const state = await fixture.inspect();
    expect(state.period?.status).toBe('EN_REVISION');
    expect(state.blocks).toEqual([
      expect.objectContaining({
        employeeId: fixture.employeeId,
        code: 'MISSING_ACTIVE_CONTRACT',
        status: 'ACTIVE',
      }),
    ]);
    expect(state.snapshots).toBe(0);
  } finally {
    await fixture.disconnect();
  }
});
