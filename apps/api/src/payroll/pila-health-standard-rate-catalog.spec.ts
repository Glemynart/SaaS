import {
  getPilaHealthStandardRate,
  PILA_HEALTH_STANDARD_RATE_FIELD_VALUE,
  PILA_HEALTH_STANDARD_RATE_RULE_VERSION,
} from './pila-health-standard-rate-catalog';

describe('getPilaHealthStandardRate', () => {
  it('returns the versioned rate for the standard private contribution', () => {
    expect(getPilaHealthStandardRate('2026-10-01')).toEqual({
      ruleVersion: PILA_HEALTH_STANDARD_RATE_RULE_VERSION,
      factor: 0.125,
      employeeFactor: 0.04,
      employerFactor: 0.085,
      fieldValue: PILA_HEALTH_STANDARD_RATE_FIELD_VALUE,
    });
  });

  it.each(['2006-12-01', '2026-02-30', '20261001'])(
    'returns no rate for %s',
    (date) => {
      expect(getPilaHealthStandardRate(date)).toBeNull();
    },
  );
});
