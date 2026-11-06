import { Prisma } from '@prisma/client';
import {
  buildCalculationInput,
  ContratoForPayroll,
  EmpForPayroll,
  resolveContratoForPayrollPeriod,
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

describe('resolveContratoForPayrollPeriod - ingreso en el mes', () => {
  const contract = (
    over: Partial<ContratoForPayroll> = {},
  ): ContratoForPayroll => ({
    id: 'contract-1',
    empleadoId: 'emp-1',
    tipo: 'TERMINO_FIJO',
    estado: 'VIGENTE',
    fechaInicio: new Date('2026-03-10T00:00:00.000Z'),
    fechaFin: null,
    sedeId: 'site-1',
    salario: new Prisma.Decimal('2000000'),
    claseRiesgoArl: 1,
    ...over,
  });

  const periodStart = new Date('2026-03-01T00:00:00.000Z');
  const periodEnd = new Date('2026-03-31T00:00:00.000Z');
  const entryDate = new Date('2026-03-10T00:00:00.000Z');

  it('accepts one current contract starting on entry date and covering month end', () => {
    expect(
      resolveContratoForPayrollPeriod(
        [contract()],
        periodStart,
        periodEnd,
        entryDate,
      ),
    ).toEqual({ contrato: contract(), fallback: false });
  });

  it('keeps the existing fallback block for overlapping or incomplete contracts', () => {
    const newest = contract();
    const older = contract({
      id: 'contract-older',
      fechaInicio: new Date('2026-02-01T00:00:00.000Z'),
    });

    expect(
      resolveContratoForPayrollPeriod(
        [newest, older],
        periodStart,
        periodEnd,
        entryDate,
      ),
    ).toEqual({ contrato: newest, fallback: true });
    expect(
      resolveContratoForPayrollPeriod(
        [contract({ fechaFin: new Date('2026-03-20T00:00:00.000Z') })],
        periodStart,
        periodEnd,
        entryDate,
      ).fallback,
    ).toBe(true);
  });
});

describe('resolveContratoForPayrollPeriod - retiro en el mes', () => {
  const periodStart = new Date('2026-03-01T00:00:00.000Z');
  const periodEnd = new Date('2026-03-31T00:00:00.000Z');
  const retirementDate = new Date('2026-03-15T00:00:00.000Z');
  const hireDate = new Date('2024-06-01T00:00:00.000Z');
  const contract = (
    over: Partial<ContratoForPayroll> = {},
  ): ContratoForPayroll => ({
    id: 'contract-retired',
    empleadoId: 'emp-1',
    tipo: 'TERMINO_FIJO',
    estado: 'TERMINADO',
    fechaInicio: hireDate,
    fechaFin: retirementDate,
    sedeId: 'site-1',
    salario: new Prisma.Decimal('2000000'),
    claseRiesgoArl: 1,
    ...over,
  });

  it('accepts one terminated contract ending on the recorded retirement date', () => {
    expect(
      resolveContratoForPayrollPeriod(
        [contract()],
        periodStart,
        periodEnd,
        hireDate,
        retirementDate,
      ),
    ).toEqual({ contrato: contract(), fallback: false });
  });

  it('keeps the existing fallback block for missing, duplicate, or mismatched contracts', () => {
    const matching = contract();
    const mismatched = contract({
      id: 'contract-wrong-end',
      fechaFin: new Date('2026-03-14T00:00:00.000Z'),
    });
    expect(
      resolveContratoForPayrollPeriod(
        [mismatched],
        periodStart,
        periodEnd,
        hireDate,
        retirementDate,
      ).fallback,
    ).toBe(true);
    expect(
      resolveContratoForPayrollPeriod(
        [matching, { ...matching, id: 'contract-duplicate' }],
        periodStart,
        periodEnd,
        hireDate,
        retirementDate,
      ).fallback,
    ).toBe(true);
  });
});
