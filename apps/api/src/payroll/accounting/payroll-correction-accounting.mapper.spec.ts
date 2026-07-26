import { PayrollCorrectionMaterialization } from '../corrections/payroll-correction.types';
import {
  buildPayrollCorrectionAdjustmentLines,
  PayrollCorrectionSystemAccounts,
} from './payroll-correction-accounting.mapper';

const accounts: PayrollCorrectionSystemAccounts = {
  SALARIOS_POR_PAGAR: 'salary-payable',
  APORTES_SALUD_POR_PAGAR: 'health-payable',
  APORTES_PENSION_POR_PAGAR: 'contributions-payable',
  PROVISION_PRESTACIONES: 'provision-payable',
  GASTO_SUELDOS: 'salary-expense',
  GASTO_APORTES_SOCIALES: 'contributions-expense',
};

function materialization(
  entries: PayrollCorrectionMaterialization['entries'],
): PayrollCorrectionMaterialization {
  return {
    version: 1,
    generatedAt: '2026-07-22T00:00:00.000Z',
    snapshotIds: ['snapshot-1'],
    approvedCorrectionIds: ['correction-1'],
    entries,
  };
}

describe('buildPayrollCorrectionAdjustmentLines', () => {
  it('builds a balanced adjustment exclusively from materialized deltas', () => {
    const lines = buildPayrollCorrectionAdjustmentLines(
      materialization([
        {
          snapshotId: 'snapshot-1',
          employeeId: 'employee-1',
          centroCostoId: 'cc-1',
          concept: { codigo: 'SALARIO_BASE', tipo: 'EARNING' },
          delta: 1000,
        },
        {
          snapshotId: 'snapshot-1',
          employeeId: 'employee-1',
          centroCostoId: 'cc-1',
          concept: { codigo: 'SALUD_EMP', tipo: 'DEDUCTION' },
          delta: 40,
        },
        {
          snapshotId: 'snapshot-1',
          employeeId: 'employee-1',
          centroCostoId: 'cc-1',
          concept: { codigo: 'SALUD_PAT', tipo: 'EMPLOYER_CONTRIBUTION' },
          delta: 85,
        },
      ]),
      accounts,
    );

    expect(lines.reduce((total, line) => total + Number(line.debito), 0)).toBe(
      lines.reduce((total, line) => total + Number(line.credito), 0),
    );
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cuentaId: 'salary-expense',
          debito: 1000,
          credito: 0,
          centroCostoId: 'cc-1',
        }),
        expect.objectContaining({
          cuentaId: 'salary-payable',
          debito: 0,
          credito: 960,
        }),
      ]),
    );
  });

  it('reverses the accounting direction for negative deltas', () => {
    const lines = buildPayrollCorrectionAdjustmentLines(
      materialization([
        {
          snapshotId: 'snapshot-1',
          employeeId: 'employee-1',
          centroCostoId: null,
          concept: { codigo: 'SALARIO_BASE', tipo: 'EARNING' },
          delta: -1000,
        },
      ]),
      accounts,
    );

    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cuentaId: 'salary-expense',
          debito: 0,
          credito: 1000,
        }),
        expect.objectContaining({
          cuentaId: 'salary-payable',
          debito: 1000,
          credito: 0,
        }),
      ]),
    );
  });
});
