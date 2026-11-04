import { PayrollPilaFspSourceScope } from '@prisma/client';
import {
  assessPilaFspSubaccounts,
  getFspSubaccountRates,
  PILA_FSP_SUBACCOUNT_RULE_VERSION,
} from './pila-fsp-subaccounts';

const period = {
  sourceScope: PayrollPilaFspSourceScope.SINGLE_SOURCE_CONFIRMED,
  periodStart: '2025-06-01',
  periodEnd: '2025-06-30',
  paymentDate: '2025-07-01',
  estadoAfiliacionPensional: null,
  smmlv: 1_000_000,
};

function fspConcept(ibc: number, totalBps: number, amount: number) {
  return {
    tipo: 'DEDUCTION',
    base: ibc,
    factor: totalBps / 10_000,
    valor: amount,
  };
}

describe('PILA FSP subaccounts under the pre-2027-04-01 rule', () => {
  it.each([
    [3_999_999, 0],
    [4_000_000, 100],
    [15_999_999, 100],
    [16_000_000, 120],
    [16_999_999, 120],
    [17_000_000, 120],
    [17_000_001, 140],
    [17_999_999, 140],
    [18_000_000, 140],
    [18_000_001, 160],
    [18_999_999, 160],
    [19_000_000, 160],
    [19_000_001, 180],
    [19_999_999, 180],
    [20_000_000, 180],
    [20_000_001, 200],
    [21_000_000, 200],
  ])('resolves the exact total rate at IBC %i', (ibc, totalBps) => {
    expect(getFspSubaccountRates(ibc, 1_000_000).totalBps).toBe(totalBps);
  });

  it.each([
    [4_000_000, 100, 20_000, 20_000, 40_000],
    [16_000_000, 120, 80_000, 112_000, 192_000],
    [17_000_000, 120, 85_000, 119_000, 204_000],
    [18_000_000, 140, 90_000, 162_000, 252_000],
    [19_000_000, 160, 95_000, 209_000, 304_000],
    [20_000_000, 180, 100_000, 260_000, 360_000],
    [21_000_000, 200, 105_000, 315_000, 420_000],
  ])(
    'freezes separate subaccounts for IBC %i only when Payroll reconciles',
    (ibc, totalBps, solidaridad, subsistencia, total) => {
      const result = assessPilaFspSubaccounts({
        ...period,
        ibcPensional: ibc,
        fspConcepts: [fspConcept(ibc, totalBps, total)],
      });

      expect(result).toMatchObject({
        status: 'READY',
        blocker: null,
        ruleVersion: PILA_FSP_SUBACCOUNT_RULE_VERSION,
        ibcPensionalAgregado: ibc,
        solidaridad,
        subsistencia,
        payrollFspAmount: total,
      });
    },
  );

  it('freezes zero only for a confirmed unique source below four SMMLV', () => {
    const result = assessPilaFspSubaccounts({
      ...period,
      ibcPensional: 3_999_999,
      fspConcepts: [],
    });

    expect(result).toMatchObject({
      status: 'READY',
      solidaridad: 0,
      subsistencia: 0,
      payrollFspAmount: 0,
    });
  });

  it.each([
    [PayrollPilaFspSourceScope.UNCONFIRMED, 'Falta confirmar'],
    [PayrollPilaFspSourceScope.MULTIPLE_SOURCES, 'múltiples fuentes'],
  ])('blocks source scope %s', (sourceScope, expectedReason) => {
    const result = assessPilaFspSubaccounts({
      ...period,
      sourceScope,
      ibcPensional: 4_000_000,
      fspConcepts: [fspConcept(4_000_000, 100, 40_000)],
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.blocker).toContain(expectedReason);
    expect(result.solidaridad).toBeNull();
    expect(result.subsistencia).toBeNull();
  });

  it.each([
    ['period reaches new regime', { periodEnd: '2027-04-01' }],
    [
      'period starts in new regime',
      { periodStart: '2027-04-01', periodEnd: '2027-04-30' },
    ],
    [
      'period crosses into new regime',
      { periodStart: '2027-03-01', periodEnd: '2027-04-01' },
    ],
    ['planned payment reaches new regime', { paymentDate: '2027-04-01' }],
    ['payment date is missing', { paymentDate: null }],
  ])('blocks when %s', (_case, overrides) => {
    const result = assessPilaFspSubaccounts({
      ...period,
      ...overrides,
      ibcPensional: 4_000_000,
      fspConcepts: [fspConcept(4_000_000, 100, 40_000)],
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.blocker).toBeTruthy();
  });

  it.each([null, 'S', 'N'] as const)(
    'uses the legacy FSP subaccounts for July 2025 regardless of affiliation state %s',
    (estadoAfiliacionPensional) => {
      const result = assessPilaFspSubaccounts({
        ...period,
        periodStart: '2025-07-01',
        periodEnd: '2025-07-31',
        paymentDate: '2025-08-01',
        estadoAfiliacionPensional,
        ibcPensional: 4_000_000,
        fspConcepts: [fspConcept(4_000_000, 100, 40_000)],
      });

      expect(result).toMatchObject({
        estadoAfiliacionPensional,
        status: 'READY',
        blocker: null,
        ruleVersion: PILA_FSP_SUBACCOUNT_RULE_VERSION,
        solidaridad: 20_000,
        subsistencia: 20_000,
        payrollFspAmount: 40_000,
      });
    },
  );

  it('accepts March 2027 only when the planned payment also precedes the new system', () => {
    const result = assessPilaFspSubaccounts({
      ...period,
      periodStart: '2027-03-01',
      periodEnd: '2027-03-31',
      paymentDate: '2027-03-31',
      ibcPensional: 4_000_000,
      fspConcepts: [fspConcept(4_000_000, 100, 40_000)],
    });

    expect(result.status).toBe('READY');
    expect(result.solidaridad).toBe(20_000);
    expect(result.subsistencia).toBe(20_000);
  });

  it('does not publish values if separate rounded amounts differ from Payroll FSP', () => {
    const result = assessPilaFspSubaccounts({
      ...period,
      ibcPensional: 4_000_100,
      fspConcepts: [fspConcept(4_000_100, 100, 40_001)],
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.blocker).toContain('no concilia');
    expect(result.solidaridad).toBeNull();
    expect(result.subsistencia).toBeNull();
  });
});
