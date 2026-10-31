import {
  getPilaContributionFactorRatio,
  getPilaContributionRoundingRuleVersion,
  isPilaContributionAmountRoundedUpToHundred,
  PILA_CONTRIBUTION_ROUNDING_EFFECTIVE_FROM,
  PILA_CONTRIBUTION_ROUNDING_RULE_VERSION,
} from './pila-contribution-rounding';

describe('versioned PILA contribution rounding', () => {
  const factorNumerator = 104_400;
  const factorDenominator = 10_000_000;

  it('parses decimal Payroll factors into exact integer ratios', () => {
    expect(getPilaContributionFactorRatio(0.04)).toEqual({
      numerator: 1,
      denominator: 25,
    });
    expect(getPilaContributionFactorRatio(0.01044)).toEqual({
      numerator: 261,
      denominator: 25_000,
    });
    expect(getPilaContributionFactorRatio(1e-7)).toBeNull();
  });

  it('accepts the frozen amount when it is rounded up to the next hundred', () => {
    expect(
      isPilaContributionAmountRoundedUpToHundred(
        '2026-10-01',
        2_000_000,
        factorNumerator,
        factorDenominator,
        20_900,
      ),
    ).toBe(true);
  });

  it('accepts an amount already on a hundred boundary', () => {
    expect(
      isPilaContributionAmountRoundedUpToHundred(
        '2026-10-01',
        2_000_000,
        100_000,
        factorDenominator,
        20_000,
      ),
    ).toBe(true);
  });

  it('rejects a payroll amount that has not been rounded for PILA', () => {
    expect(
      isPilaContributionAmountRoundedUpToHundred(
        '2026-10-01',
        2_000_000,
        factorNumerator,
        factorDenominator,
        20_880,
      ),
    ).toBe(false);
  });

  it('rejects values before the rounding rule or invalid inputs', () => {
    expect(
      isPilaContributionAmountRoundedUpToHundred(
        '2016-12-01',
        2_000_000,
        factorNumerator,
        factorDenominator,
        20_900,
      ),
    ).toBe(false);
    expect(
      isPilaContributionAmountRoundedUpToHundred(
        '2026-02-30',
        2_000_000,
        factorNumerator,
        factorDenominator,
        20_900,
      ),
    ).toBe(false);
  });

  it('exposes the explicit rounding rule version and effective date', () => {
    expect(PILA_CONTRIBUTION_ROUNDING_RULE_VERSION).toBe(
      'CO_PILA_CONTRIBUTION_ROUND_UP_100_DEC1990_ART3_2_1_5_V1',
    );
    expect(PILA_CONTRIBUTION_ROUNDING_EFFECTIVE_FROM).toBe('2016-12-06');
    expect(getPilaContributionRoundingRuleVersion('2026-10-01')).toBe(
      PILA_CONTRIBUTION_ROUNDING_RULE_VERSION,
    );
    expect(getPilaContributionRoundingRuleVersion('2016-12-01')).toBeNull();
  });
});
