import { expect, type Page } from '@playwright/test';

export async function prepareInvoiceAccounting(page: Page, tenantId: string) {
  const { apiUrl, headers } = await authenticatedApi(page);

  const provisionResponse = await page.request.post(
    `${apiUrl}/accounting/provisioning/${tenantId}`,
    { headers },
  );
  expect(provisionResponse.status()).toBe(201);

  const currentDate = new Date();
  const bogotaYear = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      year: 'numeric',
    }).format(currentDate),
  );
  for (const year of new Set([currentDate.getUTCFullYear(), bogotaYear])) {
    const periodsResponse = await page.request.post(
      `${apiUrl}/accounting/periodos-contables/generar-anio`,
      { headers, data: { anio: year } },
    );
    expect(periodsResponse.status()).toBe(201);
  }
}

export async function linkCustomerToThirdParty(
  page: Page,
  input: { customerId: string; customerNit: string; customerName: string },
) {
  const { apiUrl, headers } = await authenticatedApi(page);
  const createResponse = await page.request.post(`${apiUrl}/accounting/terceros`, {
    headers,
    data: {
      tipoDocumento: 'NIT',
      numeroDocumento: input.customerNit,
      tipoPersona: 'JURIDICA',
      razonSocial: input.customerName,
      esCliente: true,
      activo: true,
    },
  });
  expect(createResponse.status()).toBe(201);
  const thirdParty = (await createResponse.json()) as { id: string };

  const linkResponse = await page.request.patch(`${apiUrl}/billing/customers/${input.customerId}`, {
    headers,
    data: { terceroId: thirdParty.id },
  });
  expect(linkResponse.status()).toBe(200);

  return thirdParty;
}

export async function createCustomerThirdParty(
  page: Page,
  input: { customerNit: string; customerName: string },
) {
  const { apiUrl, headers } = await authenticatedApi(page);
  const response = await page.request.post(`${apiUrl}/accounting/terceros`, {
    headers,
    data: {
      tipoDocumento: 'NIT',
      numeroDocumento: input.customerNit,
      tipoPersona: 'JURIDICA',
      razonSocial: input.customerName,
      esCliente: true,
      activo: true,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string };
}

async function authenticatedApi(page: Page) {
  const accessToken = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'saas_access_token',
  )?.value;
  expect(accessToken).toBeTruthy();
  const apiPort = process.env.PLAYWRIGHT_API_PORT ?? '4000';
  return {
    apiUrl: `http://127.0.0.1:${apiPort}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  };
}
