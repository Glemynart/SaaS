import { calculate, roundPeso } from './payroll-calculator';
import {
  ArlClase,
  ConceptResult,
  LegalParamsSnapshot,
  PayrollCalculationInput,
} from './payroll-types';
import { WarningCode } from './payroll-warnings';

// Parámetros legales vigencia 2026 (espejo del seed N2A.1).
const SMMLV = 1_423_500;
const AUX = 202_897;

function baseParams(): LegalParamsSnapshot {
  return {
    smmlv: SMMLV,
    auxilioTransporte: AUX,
    topeIbcMinSmmlv: 1,
    topeIbcMaxSmmlv: 25,
    umbralAuxilioSmmlv: 2,
    umbralExoneracionSmmlv: 10,
    pctSaludEmpleado: 0.04,
    pctPensionEmpleado: 0.04,
    pctSaludEmpleador: 0.085,
    pctPensionEmpleador: 0.12,
    pctCaja: 0.04,
    pctIcbf: 0.03,
    pctSena: 0.02,
    arlPorClase: {
      1: 0.00522,
      2: 0.01044,
      3: 0.02436,
      4: 0.0435,
      5: 0.0696,
    },
    fspTramos: [
      { desdeSmmlv: 0, hastaSmmlv: 4, pct: 0 },
      { desdeSmmlv: 4, hastaSmmlv: 16, pct: 0.01 },
      { desdeSmmlv: 16, hastaSmmlv: 17, pct: 0.012 },
      { desdeSmmlv: 17, hastaSmmlv: 18, pct: 0.014 },
      { desdeSmmlv: 18, hastaSmmlv: 19, pct: 0.016 },
      { desdeSmmlv: 19, hastaSmmlv: 20, pct: 0.018 },
      { desdeSmmlv: 20, hastaSmmlv: null, pct: 0.02 },
    ],
  };
}

function baseInput(
  over: Partial<PayrollCalculationInput> = {},
): PayrollCalculationInput {
  return {
    salarioBase: SMMLV,
    salarioIntegral: false,
    claseRiesgoArl: 1,
    aportesExonerados: false,
    legalParams: baseParams(),
    novelties: [],
    ...over,
  };
}

function byCodigo(
  concepts: ConceptResult[],
  codigo: string,
): ConceptResult | undefined {
  return concepts.find((c) => c.codigo === codigo);
}

describe('roundPeso', () => {
  it('redondea half-up a peso entero', () => {
    expect(roundPeso(120997.5)).toBe(120998);
    expect(roundPeso(7430.67)).toBe(7431);
    expect(roundPeso(56940)).toBe(56940);
    expect(roundPeso(0.5)).toBe(1);
  });
});

describe('PayrollCalculator — casos obligatorios N2A', () => {
  it('1. salario mínimo: IBC = SMMLV, sin FSP, con auxilio', () => {
    const r = calculate(baseInput({ salarioBase: SMMLV }));

    expect(r.ibc).toBe(SMMLV);
    expect(r.auxilioTransporte).toBe(AUX);
    expect(byCodigo(r.concepts, 'SALUD_EMP')!.valor).toBe(56940); // 4%
    expect(byCodigo(r.concepts, 'PENSION_EMP')!.valor).toBe(56940);
    expect(byCodigo(r.concepts, 'FSP')).toBeUndefined();
    expect(r.totalDevengos).toBe(SMMLV + AUX);
    expect(r.netoPagar).toBe(SMMLV + AUX - 113880);
    expect(r.warnings).toHaveLength(0);
  });

  it('2. salario con auxilio: ≤ 2 SMMLV genera AUX_TRANSP', () => {
    const r = calculate(baseInput({ salarioBase: 2_000_000 }));

    expect(r.auxilioTransporte).toBe(AUX);
    expect(byCodigo(r.concepts, 'AUX_TRANSP')!.valor).toBe(AUX);
  });

  it('3. salario sin auxilio: > 2 SMMLV no genera AUX_TRANSP', () => {
    const r = calculate(baseInput({ salarioBase: 3_000_000 }));

    expect(r.auxilioTransporte).toBe(0);
    expect(byCodigo(r.concepts, 'AUX_TRANSP')).toBeUndefined();
    expect(r.ibc).toBe(3_000_000);
  });

  it('4. salario integral: IBC = 70% del salario, sin auxilio', () => {
    const r = calculate(
      baseInput({ salarioBase: 15_000_000, salarioIntegral: true }),
    );

    expect(r.ibc).toBe(10_500_000); // 70%
    expect(r.auxilioTransporte).toBe(0);
  });

  it('5. IBC superior al tope: se capa a 25 SMMLV con warning', () => {
    const r = calculate(baseInput({ salarioBase: 40_000_000 }));

    expect(r.ibc).toBe(SMMLV * 25); // 35_587_500
    expect(r.warnings.map((w) => w.code)).toContain(WarningCode.IBC_CAPPED);
    expect(byCodigo(r.concepts, 'SALUD_EMP')!.valor).toBe(1_423_500); // 4% del tope
  });

  it('6. exoneración activa: omite SALUD_PAT, ICBF, SENA', () => {
    const r = calculate(
      baseInput({ salarioBase: 2_000_000, aportesExonerados: true }),
    );

    expect(byCodigo(r.concepts, 'SALUD_PAT')).toBeUndefined();
    expect(byCodigo(r.concepts, 'ICBF')).toBeUndefined();
    expect(byCodigo(r.concepts, 'SENA')).toBeUndefined();
    // Pensión patronal, ARL y Caja SIEMPRE se pagan
    expect(byCodigo(r.concepts, 'PENSION_PAT')).toBeDefined();
    expect(byCodigo(r.concepts, 'ARL')).toBeDefined();
    expect(byCodigo(r.concepts, 'CAJA')).toBeDefined();
  });

  it('6b. exoneración NO aplica si salario ≥ 10 SMMLV aunque el flag esté activo', () => {
    const r = calculate(
      baseInput({ salarioBase: SMMLV * 10, aportesExonerados: true }),
    );
    expect(byCodigo(r.concepts, 'SALUD_PAT')).toBeDefined();
    expect(byCodigo(r.concepts, 'ICBF')).toBeDefined();
    expect(byCodigo(r.concepts, 'SENA')).toBeDefined();
  });

  it('7. ARL clase I: factor 0.00522', () => {
    const r = calculate(
      baseInput({ salarioBase: 2_000_000, claseRiesgoArl: 1 }),
    );
    const arl = byCodigo(r.concepts, 'ARL')!;
    expect(arl.factor).toBe(0.00522);
    expect(arl.valor).toBe(10440); // 2_000_000 * 0.00522
  });

  it('8. ARL clase V: factor 0.0696', () => {
    const r = calculate(
      baseInput({ salarioBase: 2_000_000, claseRiesgoArl: 5 as ArlClase }),
    );
    const arl = byCodigo(r.concepts, 'ARL')!;
    expect(arl.factor).toBe(0.0696);
    expect(arl.valor).toBe(139200); // 2_000_000 * 0.0696
  });

  it('9. FSP aplica: IBC ≥ 4 SMMLV cotiza 1%', () => {
    const r = calculate(baseInput({ salarioBase: 6_000_000 }));

    const fsp = byCodigo(r.concepts, 'FSP');
    expect(fsp).toBeDefined();
    expect(fsp!.factor).toBe(0.01);
    expect(fsp!.valor).toBe(60000); // 6_000_000 * 0.01
  });

  it('10. FSP no aplica: IBC < 4 SMMLV no genera concepto', () => {
    const r = calculate(baseInput({ salarioBase: 2_000_000 }));
    expect(byCodigo(r.concepts, 'FSP')).toBeUndefined();
  });
});

describe('PayrollCalculator — invariantes', () => {
  it('los totales cuadran con la suma de conceptos', () => {
    const r = calculate(baseInput({ salarioBase: 6_000_000 }));

    const sum = (tipo: string) =>
      r.concepts
        .filter((c) => c.tipo === tipo)
        .reduce((s, c) => s + c.valor, 0);

    expect(r.totalDevengos).toBe(sum('EARNING'));
    expect(r.totalDeducciones).toBe(sum('DEDUCTION'));
    expect(r.totalAportesPatronales).toBe(sum('EMPLOYER_CONTRIBUTION'));
    expect(r.netoPagar).toBe(r.totalDevengos - r.totalDeducciones);
    expect(r.costoTotalEmpleador).toBe(
      r.totalDevengos + r.totalAportesPatronales,
    );
  });

  it('es determinístico: misma entrada → misma salida', () => {
    const input = baseInput({ salarioBase: 4_321_000 });
    expect(calculate(input)).toEqual(calculate(input));
  });

  it('novedades BONUS/OVERTIME entran a IBC y devengos', () => {
    const r = calculate(
      baseInput({
        salarioBase: 3_000_000,
        novelties: [
          { tipo: 'BONUS', valor: 500_000 },
          { tipo: 'OVERTIME', valor: 200_000 },
        ],
      }),
    );

    expect(r.ibc).toBe(3_700_000); // base + bonos + extras
    expect(byCodigo(r.concepts, 'BONUS')!.valor).toBe(500_000);
    expect(byCodigo(r.concepts, 'OVERTIME')!.valor).toBe(200_000);
  });
});
