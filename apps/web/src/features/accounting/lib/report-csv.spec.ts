import { buildAccountingReportCsv } from './report-csv';

describe('buildAccountingReportCsv', () => {
  it('exports only the rows on the currently loaded page', () => {
    const csv = buildAccountingReportCsv('libro-mayor', {
      items: [
        {
          fecha: '2026-11-05T00:00:00.000Z',
          comprobanteNumero: 12,
          concepto: 'Pago; nómina',
          linea: 1,
          debito: '1200.50',
          credito: '0.00',
          saldoCorriente: '-15.25',
          descripcion: 'Línea "uno"',
        },
      ],
      total: 51,
    });

    expect(csv).toContain('"Fecha";"Comprobante";"Concepto"');
    expect(csv).toContain('"Pago; nómina"');
    expect(csv).toContain('"Línea ""uno"""');
    expect(csv).toContain('1200,50');
    expect(csv).toContain('-15,25');
    expect(csv).not.toContain('total;');
  });

  it('exports the selected fields for journals and both auxiliary reports', () => {
    const journalCsv = buildAccountingReportCsv('libro-diario', [
      {
        fecha: '2026-11-05',
        numero: 7,
        concepto: 'Venta demo',
        estado: 'CONTABILIZADO',
        totalDebito: '50.00',
        totalCredito: '50.00',
      },
    ]);
    expect(journalCsv).toContain('"2026-11-05";7;"Venta demo";"CONTABILIZADO";50,00;50,00');

    const thirdPartyCsv = buildAccountingReportCsv('auxiliar-tercero', {
      items: [
        {
          fecha: '2026-11-05',
          comprobanteNumero: 8,
          concepto: 'Recaudo',
          linea: 2,
          debito: '75.00',
          credito: '0.00',
          saldoCorriente: '75.00',
          terceroNombre: 'Cliente Demo',
          centroCostoId: null,
        },
      ],
      total: 1,
    });
    expect(thirdPartyCsv).toContain('"Cliente Demo";;');

    const costCenterCsv = buildAccountingReportCsv('auxiliar-centro-costo', {
      items: [
        {
          fecha: '2026-11-05',
          comprobanteNumero: 9,
          concepto: 'Causación',
          linea: 3,
          debito: '90.00',
          credito: '0.00',
          saldoCorriente: '90.00',
          terceroId: 'tercero-1',
          centroCostoCodigo: 'SEDE-01',
          centroCostoNombre: 'Sede central',
        },
      ],
      total: 1,
    });
    expect(costCenterCsv).toContain('"tercero-1";"SEDE-01";"Sede central"');
  });

  it('protects text cells from spreadsheet formula injection', () => {
    const csv = buildAccountingReportCsv('balance-prueba', [
      {
        codigo: '1.01',
        nombre: '=HYPERLINK("https://example.com")',
        totalDebito: '0.00',
        totalCredito: '10.00',
        saldo: '-10.00',
      },
    ]);

    expect(csv).toContain('"\'=HYPERLINK(""https://example.com"")"');
    expect(csv).toContain('0,00;10,00;-10,00');
  });

  it('flattens financial report sections, groups, accounts, and totals', () => {
    const csv = buildAccountingReportCsv('balance-general', {
      fechaCorte: '2026-12-31',
      activo: {
        codigo: '1',
        nombre: 'Activo',
        valor: '100.00',
        grupos: [
          {
            codigo: '11',
            nombre: 'Disponible',
            valor: '100.00',
            cuentas: [{ codigo: '1105', nombre: 'Caja', valor: '100.00' }],
          },
        ],
      },
      totalActivo: '100.00',
      totalPasivo: '0.00',
      totalPatrimonio: '100.00',
      totalPasivoPatrimonio: '100.00',
      diferencia: '0.00',
    });

    expect(csv).toContain('"Sección";"Activo";"1";"";100,00');
    expect(csv).toContain('"Grupo";"Activo";"11";"Disponible";100,00');
    expect(csv).toContain('"Cuenta";"Activo";"1105";"Caja";100,00');
    expect(csv).toContain('"Total";"";"";"Diferencia";0,00');
  });

  it('returns a header for empty results and preserves the Excel BOM', () => {
    const csv = buildAccountingReportCsv('balance-prueba', []);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe('\uFEFF"Código";"Cuenta";"Débito";"Crédito";"Saldo"\r\n');
  });
});
