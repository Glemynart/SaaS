import {
  calculateMonthlyEmploymentDays,
  calculateMonthlyEntryDays,
  calculateMonthlyRetirementDays,
} from './payroll-30-day-month';

describe('calculateMonthlyEntryDays', () => {
  it.each([
    ['2025-02-28', 3],
    ['2024-02-29', 2],
    ['2026-03-30', 1],
    ['2026-03-31', 1],
  ])('applies the official 30-day month example for ING %s', (entry, days) => {
    const year = Number(entry.slice(0, 4));
    const month = Number(entry.slice(5, 7)) - 1;
    const periodStart = new Date(Date.UTC(year, month, 1));
    const periodEnd = new Date(Date.UTC(year, month + 1, 0));

    expect(
      calculateMonthlyEntryDays(
        periodStart,
        periodEnd,
        new Date(`${entry}T00:00:00.000Z`),
      ),
    ).toBe(days);
  });

  it('counts all 30 days when entry is on the first day of the month', () => {
    expect(
      calculateMonthlyEntryDays(
        new Date('2026-03-01T00:00:00.000Z'),
        new Date('2026-03-31T00:00:00.000Z'),
        new Date('2026-03-01T00:00:00.000Z'),
      ),
    ).toBe(30);
  });

  it('does not infer days for an incomplete payroll period', () => {
    expect(
      calculateMonthlyEntryDays(
        new Date('2026-03-01T00:00:00.000Z'),
        new Date('2026-03-15T00:00:00.000Z'),
        new Date('2026-03-10T00:00:00.000Z'),
      ),
    ).toBeNull();
  });
});

describe('calculateMonthlyRetirementDays', () => {
  it.each([
    ['2026-02-28', 30],
    ['2024-02-29', 30],
    ['2026-03-15', 15],
    ['2026-03-30', 30],
    ['2026-03-31', 30],
  ])('applies the 30-day month convention for RET %s', (retirement, days) => {
    const year = Number(retirement.slice(0, 4));
    const month = Number(retirement.slice(5, 7)) - 1;
    const periodStart = new Date(Date.UTC(year, month, 1));
    const periodEnd = new Date(Date.UTC(year, month + 1, 0));

    expect(
      calculateMonthlyRetirementDays(
        periodStart,
        periodEnd,
        new Date(`${retirement}T00:00:00.000Z`),
      ),
    ).toBe(days);
  });

  it('rejects dates outside a complete calendar month', () => {
    expect(
      calculateMonthlyRetirementDays(
        new Date('2026-03-01T00:00:00.000Z'),
        new Date('2026-03-30T00:00:00.000Z'),
        new Date('2026-03-15T00:00:00.000Z'),
      ),
    ).toBeNull();
  });
});

describe('calculateMonthlyEmploymentDays', () => {
  const periodStart = new Date('2026-03-01T00:00:00.000Z');
  const periodEnd = new Date('2026-03-31T00:00:00.000Z');

  it.each([
    ['2026-03-10', '2026-03-20', 11],
    ['2026-03-01', '2026-03-01', 1],
    ['2026-03-30', '2026-03-31', 1],
  ])(
    'counts employment from %s through %s under 30/360',
    (entry, retirement, days) => {
      expect(
        calculateMonthlyEmploymentDays(
          periodStart,
          periodEnd,
          new Date(`${entry}T00:00:00.000Z`),
          new Date(`${retirement}T00:00:00.000Z`),
        ),
      ).toBe(days);
    },
  );

  it('uses the existing February ingress and retirement boundaries', () => {
    expect(
      calculateMonthlyEmploymentDays(
        new Date('2026-02-01T00:00:00.000Z'),
        new Date('2026-02-28T00:00:00.000Z'),
        new Date('2026-02-28T00:00:00.000Z'),
        new Date('2026-02-28T00:00:00.000Z'),
      ),
    ).toBe(3);
  });

  it('rejects reversed dates and partial payroll periods', () => {
    expect(
      calculateMonthlyEmploymentDays(
        periodStart,
        periodEnd,
        new Date('2026-03-20T00:00:00.000Z'),
        new Date('2026-03-10T00:00:00.000Z'),
      ),
    ).toBeNull();
    expect(
      calculateMonthlyEmploymentDays(
        new Date('2026-03-15T00:00:00.000Z'),
        periodEnd,
        new Date('2026-03-20T00:00:00.000Z'),
        new Date('2026-03-25T00:00:00.000Z'),
      ),
    ).toBeNull();
  });
});
