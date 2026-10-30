import {
  buildPayrollAccrualLines,
  PayrollSystemAccounts,
} from './payroll-accounting.mapper';

const accounts: PayrollSystemAccounts = {
  SALARIOS_POR_PAGAR: 'account-salarios',
  APORTES_SALUD_POR_PAGAR: 'account-salud',
  APORTES_PENSION_POR_PAGAR: 'account-pension',
  PROVISION_PRESTACIONES: 'account-provision',
  GASTO_SUELDOS: 'account-gasto-salarios',
  GASTO_APORTES_SOCIALES: 'account-gasto-aportes',
};

describe('buildPayrollAccrualLines', () => {
  it('construye una partida balanceada únicamente desde cuentas mapeadas', () => {
    const lines = buildPayrollAccrualLines(
      [
        {
          centroCostoId: 'center-1',
          totalDevengos: 100,
          totalDeducciones: 10,
          netoPagar: 90,
          totalAportesPatronales: 20,
          totalProvisiones: 5,
          concepts: [
            { codigo: 'SALUD_EMP', valor: 4 },
            { codigo: 'SALUD_PAT', valor: 8 },
          ],
        },
      ],
      accounts,
    );

    const totalDebito = lines.reduce(
      (total, line) => total + Number(line.debito),
      0,
    );
    const totalCredito = lines.reduce(
      (total, line) => total + Number(line.credito),
      0,
    );

    expect(totalDebito).toBe(125);
    expect(totalCredito).toBe(125);
    expect(
      lines.every((line) => Object.values(accounts).includes(line.cuentaId)),
    ).toBe(true);
    expect(lines.every((line) => line.centroCostoId === 'center-1')).toBe(true);
  });

  it('conserva el tercero por empleado en la obligación de salarios', () => {
    const lines = buildPayrollAccrualLines(
      [
        {
          terceroId: 'tercero-ana',
          centroCostoId: null,
          totalDevengos: 100,
          totalDeducciones: 10,
          netoPagar: 90,
          totalAportesPatronales: 0,
          totalProvisiones: 0,
          concepts: [],
        },
        {
          terceroId: 'tercero-luis',
          centroCostoId: null,
          totalDevengos: 200,
          totalDeducciones: 20,
          netoPagar: 180,
          totalAportesPatronales: 0,
          totalProvisiones: 0,
          concepts: [],
        },
      ],
      accounts,
    );

    const salaryPayables = lines.filter(
      (line) => line.cuentaId === accounts.SALARIOS_POR_PAGAR,
    );
    expect(salaryPayables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ terceroId: 'tercero-ana', credito: 90 }),
        expect.objectContaining({ terceroId: 'tercero-luis', credito: 180 }),
      ]),
    );
    expect(salaryPayables).toHaveLength(2);
  });
});
