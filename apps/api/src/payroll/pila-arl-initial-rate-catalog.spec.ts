import {
  getPilaArlInitialRate,
  PILA_ARL_INITIAL_RATE_EFFECTIVE_FROM,
  PILA_ARL_INITIAL_RATE_RULE_VERSION,
} from './pila-arl-initial-rate-catalog';

describe('versioned PILA ARL initial-rate catalog', () => {
  it.each([
    ['1', 0.00522, '0.0052200'],
    ['2', 0.01044, '0.0104400'],
    ['3', 0.02436, '0.0243600'],
    ['4', 0.0435, '0.0435000'],
    ['5', 0.0696, '0.0696000'],
  ])(
    'returns class %s for periods under the active rule version',
    (riskClass, factor, fieldValue) => {
      expect(getPilaArlInitialRate(riskClass, '2026-10-01')).toEqual({
        factor,
        fieldValue,
      });
    },
  );

  it('exposes the legal effective date and version', () => {
    expect(PILA_ARL_INITIAL_RATE_EFFECTIVE_FROM).toBe('1994-08-05');
    expect(PILA_ARL_INITIAL_RATE_RULE_VERSION).toBe(
      'CO_ARL_INITIAL_RATE_DEC1772_ART13_V1',
    );
  });

  it('does not apply the table before its effective date or to unknown classes', () => {
    expect(getPilaArlInitialRate('1', '1994-08-04')).toBeNull();
    expect(getPilaArlInitialRate('6', '2026-10-01')).toBeNull();
    expect(getPilaArlInitialRate('1', '2026-02-30')).toBeNull();
  });
});
