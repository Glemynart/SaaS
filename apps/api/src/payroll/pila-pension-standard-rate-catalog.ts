/**
 * Standard mandatory pension contribution for private dependent workers under
 * the pre-reform system. The candidate only applies before the effective date
 * of the new pension system and when both the contribution period and frozen
 * expected PILA payment date precede that cutoff.
 *
 * Sources: Decreto 1833 de 2016, art. 2.2.3.1.13 (16%),
 * https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=85319;
 * Ley 797 de 2003, art. 7 (75% employer / 25% employee),
 * https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=7223;
 * Sentencia C-264 de 2026 (new system effective 2027-04-01),
 * https://www.corteconstitucional.gov.co/relatoria/2026/C-264-26.htm. The
 * decimal field representation remains a candidate pending an accepted upload
 * by each supported operator.
 */
export const PILA_PENSION_STANDARD_RATE_RULE_VERSION =
  'CO_PENSION_STANDARD_RATE_L797_ART7_DEC1833_2_2_3_1_13_V1' as const;

export const PILA_PENSION_STANDARD_RATE_EFFECTIVE_FROM = '2008-01-01' as const;
export const PILA_NEW_PENSION_SYSTEM_EFFECTIVE_FROM = '2027-04-01' as const;

export const PILA_PENSION_STANDARD_RATE_FACTOR = 0.16 as const;
export const PILA_PENSION_EMPLOYEE_STANDARD_RATE_FACTOR = 0.04 as const;
export const PILA_PENSION_EMPLOYER_STANDARD_RATE_FACTOR = 0.12 as const;
export const PILA_PENSION_STANDARD_RATE_FIELD_VALUE = '0.16000' as const;

export interface PilaPensionStandardRate {
  readonly ruleVersion: typeof PILA_PENSION_STANDARD_RATE_RULE_VERSION;
  readonly factor: typeof PILA_PENSION_STANDARD_RATE_FACTOR;
  readonly employeeFactor: typeof PILA_PENSION_EMPLOYEE_STANDARD_RATE_FACTOR;
  readonly employerFactor: typeof PILA_PENSION_EMPLOYER_STANDARD_RATE_FACTOR;
  readonly fieldValue: typeof PILA_PENSION_STANDARD_RATE_FIELD_VALUE;
}

export function getPilaPensionStandardRate(
  contributionPeriodStart: string,
  expectedPaymentDate: string | null,
): PilaPensionStandardRate | null {
  if (
    !isCalendarDate(contributionPeriodStart) ||
    contributionPeriodStart < PILA_PENSION_STANDARD_RATE_EFFECTIVE_FROM ||
    contributionPeriodStart >= PILA_NEW_PENSION_SYSTEM_EFFECTIVE_FROM ||
    !expectedPaymentDate ||
    !isCalendarDate(expectedPaymentDate) ||
    expectedPaymentDate >= PILA_NEW_PENSION_SYSTEM_EFFECTIVE_FROM
  ) {
    return null;
  }

  return {
    ruleVersion: PILA_PENSION_STANDARD_RATE_RULE_VERSION,
    factor: PILA_PENSION_STANDARD_RATE_FACTOR,
    employeeFactor: PILA_PENSION_EMPLOYEE_STANDARD_RATE_FACTOR,
    employerFactor: PILA_PENSION_EMPLOYER_STANDARD_RATE_FACTOR,
    fieldValue: PILA_PENSION_STANDARD_RATE_FIELD_VALUE,
  };
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
