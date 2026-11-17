import { MAX_EMPLOYEE_DISBURSEMENT_SUPPORT_BYTES, payrollApi } from './payroll-api';

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

  it('sends declared prior IBC and vacation remuneration sources for enjoyed vacation', async () => {
    const payload = {
      employeeId: 'employee-1',
      codigo: 'VAC_LR' as const,
      subtipo: 'VACACIONES_DISFRUTADAS' as const,
      fechaInicio: '2026-10-10',
      fechaFin: '2026-10-12',
      ultimoIbcReportado: '2450000.50',
      periodoIbcReportado: '2026-09',
      operadorFuenteIbc: 'SOI',
      referenciaFuenteIbc: 'Planilla septiembre 2026, línea 8',
      confirmoFuenteIbc: true,
      remuneracionVacacionesReportada: '350000.50',
      periodoPagoVacaciones: '2026-10',
      referenciaFuenteRemuneracion: 'Nómina octubre 2026, concepto vacaciones',
      confirmoFuenteRemuneracion: true,
    };
    const created = { id: 'event-1', ...payload };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => created,
    });
    global.fetch = fetchMock;

    await expect(payrollApi.createPilaEvent('period-1', payload)).resolves.toEqual(created);

    expect(fetchMock).toHaveBeenCalledWith('/api/payroll/periods/period-1/pila-events', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
  });
});

describe('payrollApi employee disbursements', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('carga obligaciones y resúmenes por el tenant activo en la API', async () => {
    const page = { data: [], meta: { total: 0, page: 1, limit: 25, totalPages: 0 } };
    const summary = { sourceType: 'PAYROLL_RUN', sourceId: 'run-1', payments: [] };
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => page })
      .mockResolvedValueOnce({ ok: true, json: async () => summary });
    global.fetch = fetchMock;

    await expect(payrollApi.getDisbursementObligations('PAYROLL_RUN')).resolves.toEqual(page);
    await expect(payrollApi.getDisbursementSummary('PAYROLL_RUN', 'run-1')).resolves.toEqual(
      summary,
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/payroll/disbursements/obligations?sourceType=PAYROLL_RUN&page=1&limit=25',
      { headers: { 'Content-Type': 'application/json' } },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/payroll/disbursements?sourceType=PAYROLL_RUN&sourceId=run-1',
      { headers: { 'Content-Type': 'application/json' } },
    );
  });

  it('sube soporte privado como multipart sin forzar Content-Type JSON', async () => {
    const payment = { id: 'payment-1', status: 'SUPPORTED' };
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => payment });
    global.fetch = fetchMock;
    const file = new File(['private receipt'], 'receipt.pdf', { type: 'application/pdf' });

    await expect(payrollApi.attachDisbursementSupport('payment-1', file)).resolves.toEqual(payment);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/payroll/disbursements/payment-1/support');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
    expect(init.headers).toBeUndefined();
  });

  it('rechaza soportes que exceden el límite seguro de Vercel antes de hacer fetch', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const file = new File(
      [new ArrayBuffer(MAX_EMPLOYEE_DISBURSEMENT_SUPPORT_BYTES + 1)],
      'oversized.pdf',
      { type: 'application/pdf' },
    );

    await expect(payrollApi.attachDisbursementSupport('payment-1', file)).rejects.toThrow(
      'El soporte no puede superar 4 MiB.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envía reversos idempotentes y expone el diagnóstico de solo lectura', async () => {
    const reversal = { id: 'reversal-1', disbursementId: 'payment-1' };
    const report = { findings: [], auditRecorded: true };
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => reversal })
      .mockResolvedValueOnce({ ok: true, json: async () => report });
    global.fetch = fetchMock;
    const payload = { amount: '10000', reason: 'Reintegro', idempotencyKey: 'reverse-key-001' };

    await expect(payrollApi.reverseDisbursement('payment-1', payload)).resolves.toEqual(reversal);
    await expect(payrollApi.reconcileDisbursementSupports()).resolves.toEqual(report);

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/payroll/disbursements/payment-1/reversals', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/payroll/disbursements/reconciliation/supports',
      { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } },
    );
  });
});
