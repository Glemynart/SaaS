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
  const employeeCount = 100;
  const employees = Array.from({ length: employeeCount }, (_, index) => ({
    id: randomUUID(),
    contractId: randomUUID(),
    name: `Empleado Prima ${String(index + 1).padStart(3, '0')}`,
    document: `service-premium-${suffix}-${index + 1}`,
  }));
  const salary = 2_000_000;
  const transport = 200_000;

  try {
    await prisma.$connect();
    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;

      await tx.empleado.createMany({
        data: employees.map((employee) => ({
          id: employee.id,
          tenantId,
          cedula: employee.document,
          tipoDocumento: 'CC',
          primerNombre: 'Empleado',
          primerApellido: employee.name.replace('Empleado ', ''),
          cargo: 'Analista',
          salario: salary,
          fechaIngreso: new Date('2026-01-01T00:00:00.000Z'),
          estado: 'ACTIVO',
        })),
      });
      await tx.contrato.createMany({
        data: employees.map((employee) => ({
          id: employee.contractId,
          tenantId,
          empleadoId: employee.id,
          tipo: 'TERMINO_FIJO',
          estado: 'VIGENTE',
          fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
          fechaFin: new Date('2026-12-31T00:00:00.000Z'),
          cargo: 'Analista',
          salario: salary,
        })),
      });

      for (let month = 1; month <= 6; month += 1) {
        const periodId = randomUUID();
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
        const runs = employees.map((employee) => {
          const payrollRunId = randomUUID();
          return {
            employee,
            payrollRunId,
            snapshotId: randomUUID(),
            run: {
              id: payrollRunId,
              tenantId,
              payrollPeriodId: periodId,
              employeeId: employee.id,
              totalDevengos: salary,
              totalDeducciones: 0,
              netoPagar: salary,
              totalAportesPatronales: 0,
              totalProvisiones: 0,
              salarioBaseSnapshot: salary,
            },
            snapshot: {
              tenantId,
              payrollRunId,
              payrollPeriodId: periodId,
              employeeId: employee.id,
              contratoId: employee.contractId,
              estadoPeriodo: 'APROBADA',
              origen: 'BROWSER_E2E',
              payloadVersion: 1,
              payload: {
                period: { fechaInicio: startIso, fechaFin: endIso },
                employee: {
                  employeeId: employee.id,
                  salarioBaseUsado: salary,
                  salarioIntegralUsado: false,
                },
                contract: {
                  contratoId: employee.contractId,
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
          };
        });
        await tx.payrollRun.createMany({ data: runs.map(({ run }) => run) });
        await tx.payrollSnapshot.createMany({
          data: runs.map(({ snapshot, snapshotId }) => ({
            id: snapshotId,
            ...snapshot,
          })),
        });
      }
    });

    return {
      employeeCount,
      employeeIds: employees.map((employee) => employee.id),
      firstEmployeeName: employees[0].name,
      inspectPersistedState: async () =>
        prisma.$transaction(async (tx: any) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
          const batch = await tx.servicePremiumBatch.findFirst({
            where: { tenantId, anio: 2026, semestre: 1 },
            include: { lines: true },
          });
          const lineIds = batch?.lines.map((line: { id: string }) => line.id) ?? [];
          const documents = lineIds.length
            ? await tx.expedienteDoc.findMany({
                where: { tenantId, servicePremiumLineId: { in: lineIds } },
              })
            : [];
          return { batch, documents };
        }),
      disconnect: () => prisma.$disconnect(),
    };
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}

test('genera los 100 PDF del lote aunque el navegador pierda conexión', async ({ page }) => {
  test.setTimeout(8 * 60_000);
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

    await expect(page.getByText(fixture.firstEmployeeName, { exact: true })).toBeVisible();
    await expect(page.getByText('Lista para aprobar', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('1.100.000', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(fixture.employeeCount + 1);

    const approveResponsePromise = page.waitForResponse(
      (response) =>
        /\/api\/payroll\/service-premiums\/[0-9a-f-]+\/approve$/.test(
          new URL(response.url()).pathname,
        ) && response.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: `Aprobar y generar ${fixture.employeeCount} PDFs` })
      .click();
    const approveResponse = await approveResponsePromise;
    expect(approveResponse.status()).toBe(200);
    await page.context().setOffline(true);

    await expect
      .poll(
        async () => (await fixture.inspectPersistedState()).batch?.status,
        {
          timeout: 90_000,
          intervals: [250, 500, 1_000, 2_000],
        },
      )
      .toBe('PROCESANDO');

    await expect
      .poll(
        async () => {
          const persisted = await fixture.inspectPersistedState();
          return {
            batchStatus: persisted.batch?.status,
            documentedLines: persisted.batch?.lines.filter(
              (line: { status: string }) => line.status === 'DOCUMENTADA',
            ).length,
          };
        },
        {
          timeout: 5 * 60_000,
          intervals: [2_000, 3_000, 5_000],
        },
      )
      .toEqual({ batchStatus: 'COMPLETADO', documentedLines: fixture.employeeCount });
    await page.context().setOffline(false);
    await expect(page.getByRole('link', { name: /Ver PDF/ })).toHaveCount(fixture.employeeCount, {
      timeout: 30_000,
    });
    await expect(
      page.getByRole('progressbar', { name: 'PDF publicados en Expediente' }),
    ).toHaveAttribute('aria-valuenow', String(fixture.employeeCount));

    const persisted = await fixture.inspectPersistedState();
    expect(persisted.batch?.status).toBe('COMPLETADO');
    expect(persisted.batch?.lines).toHaveLength(fixture.employeeCount);
    expect(
      persisted.batch?.lines.every((line: { status: string }) => line.status === 'DOCUMENTADA'),
    ).toBe(true);
    expect(
      persisted.batch?.lines.every(
        (line: { amount: unknown; serviceDays360: number }) =>
          Number(line.amount) === 1_100_000 && line.serviceDays360 === 180,
      ),
    ).toBe(true);
    expect(
      persisted.batch?.lines.every((line: { documentSha256: string | null }) =>
        /^[a-f0-9]{64}$/.test(line.documentSha256 ?? ''),
      ),
    ).toBe(true);
    expect(persisted.documents).toHaveLength(fixture.employeeCount);
    expect(
      persisted.documents.every(
        (document: { categoria: string }) => document.categoria === 'PRIMA_SERVICIOS',
      ),
    ).toBe(true);
    const firstDocumentLink = page.getByRole('link', { name: /Ver PDF/ }).first();
    const firstDocumentHref = await firstDocumentLink.getAttribute('href');
    const employeeId = fixture.employeeIds.find(
      (id) => firstDocumentHref === `/empleados/${id}/expediente`,
    );
    expect(employeeId).toBeDefined();
    const firstLine = persisted.batch?.lines.find(
      (line: { employeeId: string }) => line.employeeId === employeeId,
    );
    const firstDocument = persisted.documents.find(
      (document: { servicePremiumLineId: string }) =>
        document.servicePremiumLineId === firstLine?.id,
    );
    if (!firstDocument) throw new Error('No se publicó el PDF en el expediente.');

    await firstDocumentLink.click();
    await expect(page).toHaveURL(`/empleados/${employeeId}/expediente`);
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
    }, firstDocument.id);
    expect(download).toEqual({ status: 200, contentType: 'application/pdf', signature: '%PDF' });
  } finally {
    await fixture.disconnect();
  }
});
