/**
 * Standard employer parafiscal contribution rates for the supported, explicitly
 * non-exempt dependent-worker path. Special benefits and exemption eligibility
 * remain outside this candidate catalog.
 *
 * Sources: Ley 21 de 1982, art. 12 (SENA 2 %); Ley 89 de 1988, art. 1
 * (ICBF 3 %); AT2 v30, p. 162. The seven-position decimal examples come from
 * Resolución 1747 de 2008, art. 19, repealed by Resolución 2388 de 2016, so
 * field encodings remain candidates pending validation against each operator.
 */
export const PILA_SENA_STANDARD_RATE_RULE_VERSION =
  'CO_SENA_STANDARD_RATE_L21_ART12_V1' as const;
export const PILA_SENA_STANDARD_RATE_EFFECTIVE_FROM = '1982-01-22' as const;
export const PILA_SENA_STANDARD_RATE_FACTOR = 0.02 as const;
export const PILA_SENA_STANDARD_RATE_FIELD_VALUE = '0.02000' as const;

export const PILA_ICBF_STANDARD_RATE_RULE_VERSION =
  'CO_ICBF_STANDARD_RATE_L89_ART1_V1' as const;
export const PILA_ICBF_STANDARD_RATE_EFFECTIVE_FROM = '1989-01-01' as const;
export const PILA_ICBF_STANDARD_RATE_FACTOR = 0.03 as const;
export const PILA_ICBF_STANDARD_RATE_FIELD_VALUE = '0.03000' as const;

export interface PilaSenaStandardRate {
  ruleVersion: typeof PILA_SENA_STANDARD_RATE_RULE_VERSION;
  factor: typeof PILA_SENA_STANDARD_RATE_FACTOR;
  fieldValue: typeof PILA_SENA_STANDARD_RATE_FIELD_VALUE;
}

export interface PilaIcbfStandardRate {
  ruleVersion: typeof PILA_ICBF_STANDARD_RATE_RULE_VERSION;
  factor: typeof PILA_ICBF_STANDARD_RATE_FACTOR;
  fieldValue: typeof PILA_ICBF_STANDARD_RATE_FIELD_VALUE;
}

export function getPilaSenaStandardRate(
  contributionPeriodStart: string,
): PilaSenaStandardRate | null {
  if (
    !isApplicablePeriod(
      contributionPeriodStart,
      PILA_SENA_STANDARD_RATE_EFFECTIVE_FROM,
    )
  ) {
    return null;
  }

  return {
    ruleVersion: PILA_SENA_STANDARD_RATE_RULE_VERSION,
    factor: PILA_SENA_STANDARD_RATE_FACTOR,
    fieldValue: PILA_SENA_STANDARD_RATE_FIELD_VALUE,
  };
}

export function getPilaIcbfStandardRate(
  contributionPeriodStart: string,
): PilaIcbfStandardRate | null {
  if (
    !isApplicablePeriod(
      contributionPeriodStart,
      PILA_ICBF_STANDARD_RATE_EFFECTIVE_FROM,
    )
  ) {
    return null;
  }

  return {
    ruleVersion: PILA_ICBF_STANDARD_RATE_RULE_VERSION,
    factor: PILA_ICBF_STANDARD_RATE_FACTOR,
    fieldValue: PILA_ICBF_STANDARD_RATE_FIELD_VALUE,
  };
}

function isApplicablePeriod(
  periodStart: string,
  effectiveFrom: string,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart)) return false;
  const date = new Date(`${periodStart}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === periodStart &&
    periodStart >= effectiveFrom
  );
}
