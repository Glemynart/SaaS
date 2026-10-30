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

describe('payrollApi.corrections', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('crea correcciones sobre el período mediante el BFF', async () => {
    const payload = {
      descripcion: 'Ajuste de salario base',
      intents: [
        {
          kind: 'SET_CALCULATION_INPUT',
          snapshotId: 'snapshot-1',
          input: 'SALARIO_BASE',
          targetAmount: 3_000_000,
        },
      ],
    } as const;
    const correction = { id: 'correction-1', ...payload };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => correction,
    });
    global.fetch = fetchMock;

    await expect(payrollApi.createCorrection('period-1', payload)).resolves.toEqual(correction);

    expect(fetchMock).toHaveBeenCalledWith('/api/payroll/periods/period-1/corrections', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('envía acciones permitidas de corrección por el BFF', async () => {
    const correction = { id: 'correction-1', status: 'EN_REVISION' };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => correction,
    });
    global.fetch = fetchMock;

    await expect(payrollApi.transitionCorrection('correction-1', 'aprobar')).resolves.toEqual(
      correction,
    );

    expect(fetchMock).toHaveBeenCalledWith('/api/payroll/corrections/correction-1/aprobar', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
  });
});
