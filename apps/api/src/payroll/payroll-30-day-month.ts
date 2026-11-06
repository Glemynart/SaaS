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

function calendarDate(value: Date): string | null {
  if (Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
}
