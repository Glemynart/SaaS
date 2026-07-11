import { Prisma } from '@prisma/client';
import { toSnapshot, ParamLegalForPayroll } from './payroll-mapper';

/**
 * Fila mínima de ParametroLegalNomina con Decimals, espejo del seed 2026.
 * Permite verificar que toSnapshot convierte Decimal → number sin pérdida,
 * en particular para los factores de provisión externalizados (P0).
 */
function paramRow(
  over: Partial<ParamLegalForPayroll> = {},
): ParamLegalForPayroll {
  const d = (v: string) => new Prisma.Decimal(v);
  return {
    id: 'param-2026',
    smmlv: d('1423500'),
    auxilioTransporte: d('202897'),
    topeIbcMinSmmlv: 1,
    topeIbcMaxSmmlv: 25,
    umbralAuxilioSmmlv: d('2'),
    umbralExoneracionSmmlv: 10,
    pctSaludEmpleado: d('0.04'),
    pctPensionEmpleado: d('0.04'),
    pctSaludEmpleador: d('0.085'),
    pctPensionEmpleador: d('0.12'),
    pctCaja: d('0.04'),
    pctIcbf: d('0.03'),
    pctSena: d('0.02'),
    arlClaseI: d('0.00522'),
    arlClaseII: d('0.01044'),
    arlClaseIII: d('0.02436'),
    arlClaseIV: d('0.0435'),
    arlClaseV: d('0.0696'),
    factorProvPrima: d('0.0833'),
    factorProvCesantias: d('0.0833'),
    factorProvIntCesantias: d('0.01'),
    factorProvVacaciones: d('0.0417'),
    fspTramos: [{ desdeSmmlv: 0, hastaSmmlv: 4, pct: 0 }],
    ...over,
  };
}

describe('toSnapshot — factores de provisión (P0)', () => {
  it('transporta los 4 factores de provisión como number', () => {
    const snap = toSnapshot(paramRow());

    expect(snap.factorProvPrima).toBe(0.0833);
    expect(snap.factorProvCesantias).toBe(0.0833);
    expect(snap.factorProvIntCesantias).toBe(0.01);
    expect(snap.factorProvVacaciones).toBe(0.0417);
  });

  it('convierte Decimal → number sin pérdida en los factores', () => {
    const snap = toSnapshot(
      paramRow({
        factorProvPrima: new Prisma.Decimal('0.083300'),
        factorProvVacaciones: new Prisma.Decimal('0.041700'),
      }),
    );

    expect(snap.factorProvPrima).toBe(0.0833);
    expect(snap.factorProvVacaciones).toBe(0.0417);
    expect(typeof snap.factorProvPrima).toBe('number');
  });

  it('respeta valores de vigencia distintos (versionado por parámetro)', () => {
    // Prueba que el factor NO está fijo en el motor: otra vigencia → otro valor.
    const snap = toSnapshot(
      paramRow({ factorProvPrima: new Prisma.Decimal('0.09') }),
    );

    expect(snap.factorProvPrima).toBe(0.09);
  });
});
