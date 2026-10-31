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

describe('payrollApi PILA events', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lists period events through the BFF', async () => {
    const events = [{ id: 'event-1', codigo: 'IGE' }];
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => events,
    });
    global.fetch = fetchMock;

    await expect(payrollApi.getPilaEvents('period-1')).resolves.toEqual(events);

    expect(fetchMock).toHaveBeenCalledWith('/api/payroll/periods/period-1/pila-events', {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('creates and deletes events through the BFF routes', async () => {
    const payload = {
      employeeId: 'employee-1',
      codigo: 'IRL' as const,
      fechaInicio: '2026-10-10',
      fechaFin: '2026-10-10',
      dias: 1,
    };
    const created = { id: 'event-1', ...payload };
    const deleted = { deleted: true };
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => created })
      .mockResolvedValueOnce({ ok: true, json: async () => deleted });
    global.fetch = fetchMock;

    await expect(payrollApi.createPilaEvent('period-1', payload)).resolves.toEqual(created);
    await expect(payrollApi.deletePilaEvent('event-1')).resolves.toEqual(deleted);

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/payroll/periods/period-1/pila-events', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/payroll/pila-events/event-1', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  });
});
