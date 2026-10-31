import {
  getPilaCcfStandardRate,
  PILA_CCF_STANDARD_RATE_FIELD_VALUE,
  PILA_CCF_STANDARD_RATE_RULE_VERSION,
} from './pila-ccf-standard-rate-catalog';

describe('PILA CCF standard rate catalog', () => {
  it('returns the versioned 4 percent decimal rate for a current period', () => {
    expect(getPilaCcfStandardRate('2026-10-01')).toEqual({
      ruleVersion: PILA_CCF_STANDARD_RATE_RULE_VERSION,
      factor: 0.04,
      fieldValue: PILA_CCF_STANDARD_RATE_FIELD_VALUE,
    });
  });

  it.each(['1982-01-21', '2026-02-30', 'not-a-date'])(
    'rejects unsupported date %s',
    (date) => {
      expect(getPilaCcfStandardRate(date)).toBeNull();
    },
  );
});
