/**
 * Ley 21 de 1982, arts. 11 and 12: standard employer contribution to CCF is
 * 4%. This candidate applies only to the explicitly supported standard
 * employer path; AT2 class C/D discounts and Law 1429 eligibility stay gated.
 */
export const PILA_CCF_STANDARD_RATE_RULE_VERSION =
  'CO_CCF_STANDARD_RATE_L21_ART11_12_V1' as const;

export const PILA_CCF_STANDARD_RATE_EFFECTIVE_FROM = '1982-01-22' as const;

export const PILA_CCF_STANDARD_RATE_FACTOR = 0.04 as const;

/** Historical PILA decimal-fraction convention: 4.0% is `0.04000`. */
export const PILA_CCF_STANDARD_RATE_FIELD_VALUE = '0.04000' as const;

export interface PilaCcfStandardRate {
  ruleVersion: typeof PILA_CCF_STANDARD_RATE_RULE_VERSION;
  factor: typeof PILA_CCF_STANDARD_RATE_FACTOR;
  fieldValue: typeof PILA_CCF_STANDARD_RATE_FIELD_VALUE;
}

export function getPilaCcfStandardRate(
  contributionPeriodStart: string,
): PilaCcfStandardRate | null {
  if (
    !isCalendarDate(contributionPeriodStart) ||
    contributionPeriodStart < PILA_CCF_STANDARD_RATE_EFFECTIVE_FROM
  ) {
    return null;
  }

  return {
    ruleVersion: PILA_CCF_STANDARD_RATE_RULE_VERSION,
    factor: PILA_CCF_STANDARD_RATE_FACTOR,
    fieldValue: PILA_CCF_STANDARD_RATE_FIELD_VALUE,
  };
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
