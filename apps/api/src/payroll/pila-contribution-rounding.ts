/**
 * Decreto 1990 de 2016, art. 3 (modifies Decreto 780 de 2016, art. 3.2.1.5):
 * each contributor's contribution is approximated to the next higher multiple
 * of 100. Effective on publication, 2016-12-06.
 * https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=78396
 */
export const PILA_CONTRIBUTION_ROUNDING_RULE_VERSION =
  'CO_PILA_CONTRIBUTION_ROUND_UP_100_DEC1990_ART3_2_1_5_V1' as const;

export const PILA_CONTRIBUTION_ROUNDING_EFFECTIVE_FROM = '2016-12-06' as const;

export interface PilaContributionFactorRatio {
  numerator: number;
  denominator: number;
}

/**
 * Parses the decimal value stored in a snapshot without using binary floating
 * point to calculate a contribution. Scientific notation is rejected rather
 * than approximated.
 */
export function getPilaContributionFactorRatio(
  factor: unknown,
): PilaContributionFactorRatio | null {
  if (typeof factor !== 'number' || !Number.isFinite(factor) || factor <= 0) {
    return null;
  }

  const decimal = String(factor);
  const match = /^(\d+)(?:\.(\d+))?$/.exec(decimal);
  if (!match) return null;

  const fractionalDigits = match[2] ?? '';
  const numerator = Number(`${match[1]}${fractionalDigits}`);
  const denominator = 10 ** fractionalDigits.length;
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    return null;
  }

  const divisor = greatestCommonDivisor(numerator, denominator);
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  };
}

export function getPilaContributionRoundingRuleVersion(
  contributionPeriodStart: string,
): typeof PILA_CONTRIBUTION_ROUNDING_RULE_VERSION | null {
  return isCalendarDate(contributionPeriodStart) &&
    contributionPeriodStart >= PILA_CONTRIBUTION_ROUNDING_EFFECTIVE_FROM
    ? PILA_CONTRIBUTION_ROUNDING_RULE_VERSION
    : null;
}

/**
 * Checks whether a frozen contribution equals the legally rounded amount.
 * It never returns or writes a replacement amount.
 */
export function isPilaContributionAmountRoundedUpToHundred(
  contributionPeriodStart: string,
  base: number,
  factorNumerator: number,
  factorDenominator: number,
  snapshotAmount: number,
): boolean {
  if (
    getPilaContributionRoundingRuleVersion(contributionPeriodStart) === null ||
    !Number.isSafeInteger(base) ||
    base < 0 ||
    !Number.isSafeInteger(factorNumerator) ||
    factorNumerator < 0 ||
    !Number.isSafeInteger(factorDenominator) ||
    factorDenominator <= 0 ||
    !Number.isSafeInteger(snapshotAmount) ||
    snapshotAmount < 0
  ) {
    return false;
  }

  const rawNumerator = BigInt(base) * BigInt(factorNumerator);
  const hundredDenominator = BigInt(factorDenominator) * 100n;
  const amountInHundreds =
    (rawNumerator + hundredDenominator - 1n) / hundredDenominator;
  const roundedAmount = amountInHundreds * 100n;

  return (
    roundedAmount <= BigInt(Number.MAX_SAFE_INTEGER) &&
    roundedAmount === BigInt(snapshotAmount)
  );
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = left;
  let b = right;
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}
