import {
  getPilaIcbfStandardRate,
  getPilaSenaStandardRate,
  PILA_ICBF_STANDARD_RATE_EFFECTIVE_FROM,
  PILA_ICBF_STANDARD_RATE_RULE_VERSION,
  PILA_SENA_STANDARD_RATE_EFFECTIVE_FROM,
  PILA_SENA_STANDARD_RATE_RULE_VERSION,
} from './pila-parafiscal-rate-catalog';

describe('versioned PILA standard parafiscal rate catalog', () => {
  it('returns the standard SENA and ICBF rates for applicable periods', () => {
    expect(getPilaSenaStandardRate('2026-10-01')).toEqual({
      ruleVersion: PILA_SENA_STANDARD_RATE_RULE_VERSION,
      factor: 0.02,
      fieldValue: '0.02000',
    });
    expect(getPilaIcbfStandardRate('2026-10-01')).toEqual({
      ruleVersion: PILA_ICBF_STANDARD_RATE_RULE_VERSION,
      factor: 0.03,
      fieldValue: '0.03000',
    });
  });

  it('exposes the legal effective dates and rule versions', () => {
    expect(PILA_SENA_STANDARD_RATE_EFFECTIVE_FROM).toBe('1982-01-22');
    expect(PILA_ICBF_STANDARD_RATE_EFFECTIVE_FROM).toBe('1989-01-01');
    expect(PILA_SENA_STANDARD_RATE_RULE_VERSION).toBe(
      'CO_SENA_STANDARD_RATE_L21_ART12_V1',
    );
    expect(PILA_ICBF_STANDARD_RATE_RULE_VERSION).toBe(
      'CO_ICBF_STANDARD_RATE_L89_ART1_V1',
    );
  });

  it('rejects periods before each rule and malformed calendar dates', () => {
    expect(getPilaSenaStandardRate('1982-01-21')).toBeNull();
    expect(getPilaIcbfStandardRate('1988-12-31')).toBeNull();
    expect(getPilaSenaStandardRate('2026-02-30')).toBeNull();
    expect(getPilaIcbfStandardRate('2026-1-01')).toBeNull();
  });
});
