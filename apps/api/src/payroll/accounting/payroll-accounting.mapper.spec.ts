import {
  buildPayrollAccrualLines,
  PayrollSystemAccounts,
} from './payroll-accounting.mapper';

const accounts: PayrollSystemAccounts = {
  SALARIOS_POR_PAGAR: 'account-salarios',
  APORTES_SALUD_POR_PAGAR: 'account-salud',
  APORTES_RIESGOS_LABORALES_POR_PAGAR: 'account-arl',
  APORTES_PARAFISCALES_POR_PAGAR: 'account-parafiscales',
  APORTES_PENSION_POR_PAGAR: 'account-pension',
  PROVISION_CESANTIAS_POR_PAGAR: 'account-cesantias-payable',
  PROVISION_INTERESES_CESANTIAS_POR_PAGAR:
    'account-intereses-cesantias-payable',
  PROVISION_VACACIONES_POR_PAGAR: 'account-vacaciones-payable',
  PROVISION_PRIMA_POR_PAGAR: 'account-prima-payable',
  GASTO_SUELDOS: 'account-gasto-salarios',
  GASTO_APORTES_SALUD: 'account-gasto-eps',
  GASTO_APORTES_PENSION: 'account-gasto-pension',
  GASTO_APORTES_RIESGOS_LABORALES: 'account-gasto-arl',
  GASTO_APORTES_CAJA: 'account-gasto-caja',
  GASTO_APORTES_ICBF: 'account-gasto-icbf',
  GASTO_APORTES_SENA: 'account-gasto-sena',
  GASTO_PROVISION_CESANTIAS: 'account-gasto-cesantias',
  GASTO_PROVISION_INTERESES_CESANTIAS: 'account-gasto-intereses-cesantias',
  GASTO_PROVISION_PRIMA: 'account-gasto-prima',
  GASTO_PROVISION_VACACIONES: 'account-gasto-vacaciones',
};

describe('buildPayrollAccrualLines', () => {
  it('separa obligaciones por naturaleza y produce una partida balanceada', () => {
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
            { codigo: 'SALARIO_BASE', tipo: 'EARNING', valor: 100 },
            { codigo: 'SALUD_EMP', tipo: 'DEDUCTION', valor: 4 },
            { codigo: 'PENSION_EMP', tipo: 'DEDUCTION', valor: 6 },
            {
              codigo: 'SALUD_PAT',
              tipo: 'EMPLOYER_CONTRIBUTION',
              valor: 8,
            },
            {
              codigo: 'PENSION_PAT',
              tipo: 'EMPLOYER_CONTRIBUTION',
              valor: 4,
            },
            { codigo: 'ARL', tipo: 'EMPLOYER_CONTRIBUTION', valor: 2 },
            { codigo: 'CAJA', tipo: 'EMPLOYER_CONTRIBUTION', valor: 3 },
            { codigo: 'ICBF', tipo: 'EMPLOYER_CONTRIBUTION', valor: 2 },
            { codigo: 'SENA', tipo: 'EMPLOYER_CONTRIBUTION', valor: 1 },
            { codigo: 'PROV_PRIMA', tipo: 'PROVISION', valor: 2 },
            { codigo: 'PROV_CESANTIAS', tipo: 'PROVISION', valor: 1 },
            { codigo: 'PROV_INT_CESANTIAS', tipo: 'PROVISION', valor: 1 },
            { codigo: 'PROV_VACACIONES', tipo: 'PROVISION', valor: 1 },
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
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cuentaId: accounts.APORTES_SALUD_POR_PAGAR,
          credito: 12,
        }),
        expect.objectContaining({
          cuentaId: accounts.APORTES_PENSION_POR_PAGAR,
          credito: 10,
        }),
        expect.objectContaining({
          cuentaId: accounts.APORTES_RIESGOS_LABORALES_POR_PAGAR,
          credito: 2,
        }),
        expect.objectContaining({
          cuentaId: accounts.APORTES_PARAFISCALES_POR_PAGAR,
          credito: 6,
        }),
        expect.objectContaining({
          cuentaId: accounts.GASTO_APORTES_SALUD,
          debito: 8,
        }),
        expect.objectContaining({
          cuentaId: accounts.GASTO_APORTES_PENSION,
          debito: 4,
        }),
        expect.objectContaining({
          cuentaId: accounts.GASTO_APORTES_RIESGOS_LABORALES,
          debito: 2,
        }),
        expect.objectContaining({
          cuentaId: accounts.GASTO_APORTES_CAJA,
          debito: 3,
        }),
        expect.objectContaining({
          cuentaId: accounts.GASTO_APORTES_ICBF,
          debito: 2,
        }),
        expect.objectContaining({
          cuentaId: accounts.GASTO_APORTES_SENA,
          debito: 1,
        }),
        expect.objectContaining({
          cuentaId: accounts.GASTO_PROVISION_CESANTIAS,
          debito: 1,
        }),
        expect.objectContaining({
          cuentaId: accounts.GASTO_PROVISION_INTERESES_CESANTIAS,
          debito: 1,
        }),
        expect.objectContaining({
          cuentaId: accounts.GASTO_PROVISION_PRIMA,
          debito: 2,
        }),
        expect.objectContaining({
          cuentaId: accounts.GASTO_PROVISION_VACACIONES,
          debito: 1,
        }),
        expect.objectContaining({
          cuentaId: accounts.PROVISION_CESANTIAS_POR_PAGAR,
          credito: 1,
        }),
        expect.objectContaining({
          cuentaId: accounts.PROVISION_INTERESES_CESANTIAS_POR_PAGAR,
          credito: 1,
        }),
        expect.objectContaining({
          cuentaId: accounts.PROVISION_PRIMA_POR_PAGAR,
          credito: 2,
        }),
        expect.objectContaining({
          cuentaId: accounts.PROVISION_VACACIONES_POR_PAGAR,
          credito: 1,
        }),
      ]),
    );
    expect(
      lines.every((line) => Object.values(accounts).includes(line.cuentaId)),
    ).toBe(true);
    expect(lines.every((line) => line.centroCostoId === 'center-1')).toBe(true);
  });

  it('rechaza conceptos deducibles sin una clasificación contable', () => {
    expect(() =>
      buildPayrollAccrualLines(
        [
          {
            centroCostoId: null,
            totalDevengos: 100,
            totalDeducciones: 1,
            netoPagar: 99,
            totalAportesPatronales: 0,
            totalProvisiones: 0,
            concepts: [
              { codigo: 'SALARIO_BASE', tipo: 'EARNING', valor: 100 },
              { codigo: 'DEDUCCION_DESCONOCIDA', tipo: 'DEDUCTION', valor: 1 },
            ],
          },
        ],
        accounts,
      ),
    ).toThrow('no tiene clasificación contable de nómina');
  });
});
