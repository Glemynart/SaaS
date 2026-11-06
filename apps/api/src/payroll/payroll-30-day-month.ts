/**
 * Day count for a dependent employee whose start date is inside a full
 * calendar-month payroll period. PILA/Payroll use a 30-day month convention.
 */
export function calculateMonthlyEntryDays(
  periodStart: Date,
  periodEnd: Date,
  entryDate: Date,
): number | null {
  const start = calendarDate(periodStart);
  const end = calendarDate(periodEnd);
  const entry = calendarDate(entryDate);
  if (!start || !end || !entry || start > end || entry < start || entry > end) {
    return null;
  }

  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const entryCalendarDate = new Date(`${entry}T00:00:00.000Z`);
  if (
    startDate.getUTCDate() !== 1 ||
    startDate.getUTCFullYear() !== endDate.getUTCFullYear() ||
    startDate.getUTCMonth() !== endDate.getUTCMonth() ||
    entryCalendarDate.getUTCFullYear() !== startDate.getUTCFullYear() ||
    entryCalendarDate.getUTCMonth() !== startDate.getUTCMonth()
  ) {
    return null;
  }

  const lastDay = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0),
  ).getUTCDate();
  if (endDate.getUTCDate() !== lastDay) return null;

  // Resolución 5858/2016, validation-date examples: ING on Feb 28 in a
  // non-leap year = 3 days, Feb 29 in a leap year = 2, and Mar 30/31 = 1.
  return Math.max(1, 30 - entryCalendarDate.getUTCDate() + 1);
}

/**
 * Day count for a dependent employee who works from the first day of a full
 * calendar-month period through a retirement date inside that period.
 * PILA applies the 30-day month convention; a retirement on the month's final
 * calendar day reports 30 days, including February.
 */
export function calculateMonthlyRetirementDays(
  periodStart: Date,
  periodEnd: Date,
  retirementDate: Date,
): number | null {
  const start = calendarDate(periodStart);
  const end = calendarDate(periodEnd);
  const retirement = calendarDate(retirementDate);
  if (
    !start ||
    !end ||
    !retirement ||
    start > end ||
    retirement < start ||
    retirement > end
  ) {
    return null;
  }

  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  const retirementCalendarDate = new Date(`${retirement}T00:00:00.000Z`);
  if (
    startDate.getUTCDate() !== 1 ||
    startDate.getUTCFullYear() !== endDate.getUTCFullYear() ||
    startDate.getUTCMonth() !== endDate.getUTCMonth() ||
    retirementCalendarDate.getUTCFullYear() !== startDate.getUTCFullYear() ||
    retirementCalendarDate.getUTCMonth() !== startDate.getUTCMonth()
  ) {
    return null;
  }

  const lastDay = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0),
  ).getUTCDate();
  if (endDate.getUTCDate() !== lastDay) return null;

  const retirementDay = retirementCalendarDate.getUTCDate();
  return retirementDay === lastDay ? 30 : Math.min(30, retirementDay);
}

function calendarDate(value: Date): string | null {
  if (Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
}
