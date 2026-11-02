import {
  getPilaPensionStandardRate,
  PILA_PENSION_STANDARD_RATE_FIELD_VALUE,
  PILA_PENSION_STANDARD_RATE_RULE_VERSION,
} from './pila-pension-standard-rate-catalog';

describe('getPilaPensionStandardRate', () => {
  it('returns the versioned standard rate only before the new-system cutoff', () => {
    expect(getPilaPensionStandardRate('2026-10-01', '2026-11-06')).toEqual({
      ruleVersion: PILA_PENSION_STANDARD_RATE_RULE_VERSION,
      factor: 0.16,
      employeeFactor: 0.04,
      employerFactor: 0.12,
      fieldValue: PILA_PENSION_STANDARD_RATE_FIELD_VALUE,
    });
  });

  it.each([
    ['before the standard rate', '2007-12-01', '2008-01-05'],
    ['period at the cutover', '2027-04-01', '2027-05-06'],
    ['payment at the cutover', '2027-03-01', '2027-04-01'],
    ['missing payment date', '2026-10-01', null],
    ['invalid calendar date', '2026-02-30', '2026-03-06'],
  ] as const)(
    'does not return a rate for %s',
    (_description, periodStart, paymentDate) => {
      expect(getPilaPensionStandardRate(periodStart, paymentDate)).toBeNull();
    },
  );
});
