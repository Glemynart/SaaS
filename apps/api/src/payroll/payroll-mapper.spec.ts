import { Prisma } from '@prisma/client';
import {
  buildCalculationInput,
  ContratoForPayroll,
  EmpForPayroll,
  toSnapshot,
  ParamLegalForPayroll,
} from './payroll-mapper';
import { PayrollBlockCode, PayrollEvaluationKind } from './payroll-evaluation';

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

describe('buildCalculationInput - clasificacion funcional (U4)', () => {
  const baseEmp = (over: Partial<EmpForPayroll> = {}): EmpForPayroll => ({
    id: 'emp-1',
    salario: new Prisma.Decimal('2000000'),
    salarioIntegral: false,
    ...over,
  });

  const baseContrato = (
    over: Partial<ContratoForPayroll> = {},
  ): ContratoForPayroll => ({
    id: 'contrato-1',
    empleadoId: 'emp-1',
    tipo: 'TERMINO_FIJO',
    estado: 'VIGENTE',
    fechaInicio: new Date('2026-01-01'),
    fechaFin: null,
    sedeId: 'sede-1',
    salario: new Prisma.Decimal('2000000'),
    claseRiesgoArl: 1,
    ...over,
  });

  it('marca salario integral como bloqueo funcional', () => {
    const result = buildCalculationInput(
      baseEmp({ salarioIntegral: true }),
      baseContrato(),
      [],
      false,
      toSnapshot(paramRow()),
    );

    expect(result.blocks).toEqual([
      expect.objectContaining({
        kind: PayrollEvaluationKind.BLOCK,
        code: PayrollBlockCode.UNSUPPORTED_INTEGRAL_SALARY,
      }),
    ]);
  });

  it('marca clase ARL invalida como bloqueo funcional', () => {
    const result = buildCalculationInput(
      baseEmp(),
      baseContrato({ claseRiesgoArl: 9 }),
      [],
      false,
      toSnapshot(paramRow()),
    );

    expect(result.blocks).toEqual([
      expect.objectContaining({
        kind: PayrollEvaluationKind.BLOCK,
        code: PayrollBlockCode.INVALID_ARL_CLASS,
      }),
    ]);
  });

  it('marca divergencia salarial como bloqueo funcional', () => {
    const result = buildCalculationInput(
      baseEmp(),
      baseContrato({ salario: new Prisma.Decimal('2500000') }),
      [],
      false,
      toSnapshot(paramRow()),
    );

    expect(result.blocks).toEqual([
      expect.objectContaining({
        kind: PayrollEvaluationKind.BLOCK,
        code: PayrollBlockCode.MATERIAL_SALARY_MISMATCH,
      }),
    ]);
  });

  it('mantiene una evaluacion limpia cuando no hay bloqueo funcional', () => {
    const result = buildCalculationInput(
      baseEmp(),
      baseContrato(),
      [],
      false,
      toSnapshot(paramRow()),
    );

    expect(result.evaluations).toEqual([]);
    expect(result.blocks).toEqual([]);
  });
});
