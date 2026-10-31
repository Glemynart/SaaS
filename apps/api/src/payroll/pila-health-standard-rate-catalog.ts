/**
 * Standard health contribution for private dependent workers when the
 * employer has explicitly confirmed that it is not exempt. The candidate
 * combines the frozen employee and employer contributions only after their
 * factors, bases and individual rounding agree with the standard 4% and 8.5%.
 *
 * Sources: Ley 1122 de 2007, art. 10 (12.5%, split 4%/8.5%),
 * https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=22600;
 * AT2 v30, pp. 159. The decimal field representation remains a candidate
 * pending an accepted upload by each supported operator.
 */
export const PILA_HEALTH_STANDARD_RATE_RULE_VERSION =
  'CO_HEALTH_STANDARD_RATE_L1122_ART10_V1' as const;

export const PILA_HEALTH_STANDARD_RATE_EFFECTIVE_FROM = '2007-01-01' as const;
export const PILA_HEALTH_STANDARD_RATE_FACTOR = 0.125 as const;
export const PILA_HEALTH_EMPLOYEE_STANDARD_RATE_FACTOR = 0.04 as const;
export const PILA_HEALTH_EMPLOYER_STANDARD_RATE_FACTOR = 0.085 as const;
export const PILA_HEALTH_STANDARD_RATE_FIELD_VALUE = '0.12500' as const;

export interface PilaHealthStandardRate {
  readonly ruleVersion: typeof PILA_HEALTH_STANDARD_RATE_RULE_VERSION;
  readonly factor: typeof PILA_HEALTH_STANDARD_RATE_FACTOR;
  readonly employeeFactor: typeof PILA_HEALTH_EMPLOYEE_STANDARD_RATE_FACTOR;
  readonly employerFactor: typeof PILA_HEALTH_EMPLOYER_STANDARD_RATE_FACTOR;
  readonly fieldValue: typeof PILA_HEALTH_STANDARD_RATE_FIELD_VALUE;
}

export function getPilaHealthStandardRate(
  contributionPeriodStart: string,
): PilaHealthStandardRate | null {
  if (!isCalendarDate(contributionPeriodStart)) return null;
  if (contributionPeriodStart < PILA_HEALTH_STANDARD_RATE_EFFECTIVE_FROM) {
    return null;
  }

  return {
    ruleVersion: PILA_HEALTH_STANDARD_RATE_RULE_VERSION,
    factor: PILA_HEALTH_STANDARD_RATE_FACTOR,
    employeeFactor: PILA_HEALTH_EMPLOYEE_STANDARD_RATE_FACTOR,
    employerFactor: PILA_HEALTH_EMPLOYER_STANDARD_RATE_FACTOR,
    fieldValue: PILA_HEALTH_STANDARD_RATE_FIELD_VALUE,
  };
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
