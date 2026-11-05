import {
  addCalendarYears,
  getNumberingRangeStatus,
  parseDateOnly,
} from './numbering';

describe('electronic invoice numbering rules', () => {
  it('parses real calendar dates only', () => {
    expect(parseDateOnly('2026-02-28').toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
    expect(() => parseDateOnly('2026-02-29')).toThrow();
    expect(() => parseDateOnly('2026-2-01')).toThrow();
  });

  it('clamps a leap-day authorization anniversary to February 28', () => {
    expect(addCalendarYears(parseDateOnly('2024-02-29'), 2).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });

  type TestRange = {
    estado: 'ACTIVO' | 'INACTIVO';
    ultimoNumeroAsignado: number;
    numeroHasta: number;
    vigenciaDesde: Date;
    vigenciaHasta: Date;
  };
  const base: TestRange = {
    estado: 'ACTIVO',
    ultimoNumeroAsignado: 0,
    numeroHasta: 10,
    vigenciaDesde: parseDateOnly('2026-11-05'),
    vigenciaHasta: parseDateOnly('2026-11-05'),
  };
  const cases: Array<[string, Partial<TestRange>, string]> = [
    ['inactive', { estado: 'INACTIVO' }, 'INACTIVO'],
    ['exhausted', { ultimoNumeroAsignado: 10 }, 'AGOTADO'],
    ['future', { vigenciaDesde: parseDateOnly('2026-11-06') }, 'FUTURO'],
    ['expired', { vigenciaHasta: parseDateOnly('2026-11-04') }, 'VENCIDO'],
    ['current', {}, 'VIGENTE'],
  ];

  it.each(cases)(
    'derives %s without altering stored range status',
    (_name, change, expected) => {
      expect(
        getNumberingRangeStatus(
          { ...base, ...change },
          parseDateOnly('2026-11-05'),
        ),
      ).toBe(expected);
    },
  );
});
