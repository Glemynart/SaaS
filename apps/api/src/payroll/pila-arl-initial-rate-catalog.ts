/**
 * Versioned initial occupational-risk rates for standard dependent workers.
 *
 * Sources:
 * - Decreto 1772 de 1994, arts. 13 and 22 (effective 1994-08-05):
 *   https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=8803
 * - Decreto 1072 de 2015, art. 2.2.4.3.5:
 *   https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=72173
 * - Resolución 2634 de 2014, art. 7 (decimal field-61 representation):
 *   https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/Resolucion-2634-de-2014.pdf
 * - AT2 v30 (2026-07-24), pp. 94 and 160.
 */
export const PILA_ARL_INITIAL_RATE_RULE_VERSION =
  'CO_ARL_INITIAL_RATE_DEC1772_ART13_V1' as const;

export const PILA_ARL_INITIAL_RATE_EFFECTIVE_FROM = '1994-08-05' as const;

export interface PilaArlInitialRate {
  readonly factor: number;
  /** Fractional decimal, left-aligned and right-padded to AT2 field width. */
  readonly fieldValue: string;
}

const INITIAL_RATE_BY_CLASS: Readonly<Record<string, PilaArlInitialRate>> =
  Object.freeze({
    '1': { factor: 0.00522, fieldValue: '0.0052200' },
    '2': { factor: 0.01044, fieldValue: '0.0104400' },
    '3': { factor: 0.02436, fieldValue: '0.0243600' },
    '4': { factor: 0.0435, fieldValue: '0.0435000' },
    '5': { factor: 0.0696, fieldValue: '0.0696000' },
  });

export function getPilaArlInitialRate(
  riskClass: string | null,
  contributionPeriodStart: string,
): PilaArlInitialRate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(contributionPeriodStart)) {
    return null;
  }
  const periodStart = new Date(contributionPeriodStart + 'T00:00:00.000Z');
  if (
    Number.isNaN(periodStart.getTime()) ||
    periodStart.toISOString().slice(0, 10) !== contributionPeriodStart ||
    contributionPeriodStart < PILA_ARL_INITIAL_RATE_EFFECTIVE_FROM
  ) {
    return null;
  }
  return riskClass ? (INITIAL_RATE_BY_CLASS[riskClass] ?? null) : null;
}
