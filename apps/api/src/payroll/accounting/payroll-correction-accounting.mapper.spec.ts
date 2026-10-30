import { PayrollCorrectionMaterialization } from '../corrections/payroll-correction.types';
import {
  buildPayrollCorrectionAdjustmentLines,
  PayrollCorrectionSystemAccounts,
} from './payroll-correction-accounting.mapper';

const accounts: PayrollCorrectionSystemAccounts = {
  SALARIOS_POR_PAGAR: 'salary-payable',
  APORTES_SALUD_POR_PAGAR: 'health-payable',
  APORTES_RIESGOS_LABORALES_POR_PAGAR: 'risks-payable',
  APORTES_PARAFISCALES_POR_PAGAR: 'parafiscal-payable',
  APORTES_PENSION_POR_PAGAR: 'pension-payable',
  PROVISION_CESANTIAS_POR_PAGAR: 'severance-payable',
  PROVISION_INTERESES_CESANTIAS_POR_PAGAR: 'severance-interest-payable',
  PROVISION_VACACIONES_POR_PAGAR: 'vacation-payable',
  PROVISION_PRIMA_POR_PAGAR: 'service-bonus-payable',
  GASTO_SUELDOS: 'salary-expense',
  GASTO_APORTES_SALUD: 'health-expense',
  GASTO_APORTES_PENSION: 'pension-expense',
  GASTO_APORTES_RIESGOS_LABORALES: 'risk-expense',
  GASTO_APORTES_CAJA: 'family-fund-expense',
  GASTO_APORTES_ICBF: 'icbf-expense',
  GASTO_APORTES_SENA: 'sena-expense',
  GASTO_PROVISION_CESANTIAS: 'severance-expense',
  GASTO_PROVISION_INTERESES_CESANTIAS: 'severance-interest-expense',
  GASTO_PROVISION_PRIMA: 'service-bonus-expense',
  GASTO_PROVISION_VACACIONES: 'vacation-expense',
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
          concept: { codigo: 'PENSION_EMP', tipo: 'DEDUCTION' },
          delta: 20,
        },
        {
          snapshotId: 'snapshot-1',
          employeeId: 'employee-1',
          centroCostoId: 'cc-1',
          concept: { codigo: 'SALUD_PAT', tipo: 'EMPLOYER_CONTRIBUTION' },
          delta: 85,
        },
        {
          snapshotId: 'snapshot-1',
          employeeId: 'employee-1',
          centroCostoId: 'cc-1',
          concept: { codigo: 'PENSION_PAT', tipo: 'EMPLOYER_CONTRIBUTION' },
          delta: 120,
        },
        {
          snapshotId: 'snapshot-1',
          employeeId: 'employee-1',
          centroCostoId: 'cc-1',
          concept: { codigo: 'ARL', tipo: 'EMPLOYER_CONTRIBUTION' },
          delta: 5,
        },
        {
          snapshotId: 'snapshot-1',
          employeeId: 'employee-1',
          centroCostoId: 'cc-1',
          concept: { codigo: 'CAJA', tipo: 'EMPLOYER_CONTRIBUTION' },
          delta: 10,
        },
        {
          snapshotId: 'snapshot-1',
          employeeId: 'employee-1',
          centroCostoId: 'cc-1',
          concept: { codigo: 'PROV_CESANTIAS', tipo: 'PROVISION' },
          delta: 2,
        },
        {
          snapshotId: 'snapshot-1',
          employeeId: 'employee-1',
          centroCostoId: 'cc-1',
          concept: { codigo: 'PROV_INT_CESANTIAS', tipo: 'PROVISION' },
          delta: 1,
        },
        {
          snapshotId: 'snapshot-1',
          employeeId: 'employee-1',
          centroCostoId: 'cc-1',
          concept: { codigo: 'PROV_PRIMA', tipo: 'PROVISION' },
          delta: 1,
        },
        {
          snapshotId: 'snapshot-1',
          employeeId: 'employee-1',
          centroCostoId: 'cc-1',
          concept: { codigo: 'PROV_VACACIONES', tipo: 'PROVISION' },
          delta: 1,
        },
      ]),
      accounts,
    );

    expect(lines.reduce((total, line) => total + Number(line.debito), 0)).toBe(
      1225,
    );
    expect(lines.reduce((total, line) => total + Number(line.credito), 0)).toBe(
      1225,
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
          credito: 940,
        }),
        expect.objectContaining({
          cuentaId: 'health-payable',
          debito: 0,
          credito: 125,
        }),
        expect.objectContaining({
          cuentaId: 'pension-payable',
          debito: 0,
          credito: 140,
        }),
        expect.objectContaining({
          cuentaId: 'risks-payable',
          debito: 0,
          credito: 5,
        }),
        expect.objectContaining({
          cuentaId: 'parafiscal-payable',
          debito: 0,
          credito: 10,
        }),
        expect.objectContaining({ cuentaId: 'health-expense', debito: 85 }),
        expect.objectContaining({ cuentaId: 'pension-expense', debito: 120 }),
        expect.objectContaining({ cuentaId: 'risk-expense', debito: 5 }),
        expect.objectContaining({
          cuentaId: 'family-fund-expense',
          debito: 10,
        }),
        expect.objectContaining({ cuentaId: 'severance-expense', debito: 2 }),
        expect.objectContaining({
          cuentaId: 'severance-interest-expense',
          debito: 1,
        }),
        expect.objectContaining({
          cuentaId: 'service-bonus-expense',
          debito: 1,
        }),
        expect.objectContaining({ cuentaId: 'vacation-expense', debito: 1 }),
        expect.objectContaining({ cuentaId: 'severance-payable', credito: 2 }),
        expect.objectContaining({
          cuentaId: 'severance-interest-payable',
          credito: 1,
        }),
        expect.objectContaining({
          cuentaId: 'service-bonus-payable',
          credito: 1,
        }),
        expect.objectContaining({ cuentaId: 'vacation-payable', credito: 1 }),
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
