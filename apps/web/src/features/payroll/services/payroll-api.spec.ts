import { payrollApi } from './payroll-api';

describe('payrollApi.contabilizar', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('envía una solicitud POST al endpoint BFF del período', async () => {
    const payload = {
      status: 'CAUSADA',
      payrollPeriodId: 'period-1',
      comprobanteId: 'voucher-1',
    } as const;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    global.fetch = fetchMock;

    await expect(payrollApi.contabilizar('period-1')).resolves.toEqual(payload);

    expect(fetchMock).toHaveBeenCalledWith('/api/payroll/periods/period-1/contabilizar', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
  });
});
