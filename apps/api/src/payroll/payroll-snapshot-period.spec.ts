import { buildPayrollPeriodSnapshot } from './payroll-snapshot-period';

describe('buildPayrollPeriodSnapshot', () => {
  it('conserva la fecha prevista de pago como fecha ISO congelada', () => {
    const result = buildPayrollPeriodSnapshot({
      payrollPeriodId: 'period-1',
      nombre: 'Octubre 2026',
      fechaInicio: '2026-10-01T00:00:00.000Z',
      fechaFin: '2026-10-31T00:00:00.000Z',
      fechaPrevistaPagoPila: new Date('2026-11-05T00:00:00.000Z'),
      status: 'APROBADA',
    });

    expect(result.fechaPrevistaPagoPila).toBe('2026-11-05T00:00:00.000Z');
  });

  it('conserva la ausencia de fecha sin inferir una fecha del período', () => {
    const result = buildPayrollPeriodSnapshot({
      payrollPeriodId: 'period-2',
      nombre: 'Octubre 2026',
      fechaInicio: '2026-10-01T00:00:00.000Z',
      fechaFin: '2026-10-31T00:00:00.000Z',
      fechaPrevistaPagoPila: null,
      status: 'APROBADA',
    });

    expect(result.fechaPrevistaPagoPila).toBeNull();
  });
});
