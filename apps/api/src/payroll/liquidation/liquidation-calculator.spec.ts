import {
  calculate,
  diasComerciales,
  roundPeso,
} from './liquidation-calculator';
import { LiquidationConcept, LiquidationInput } from './liquidation-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function byCodigo(
  conceptos: LiquidationConcept[],
  codigo: string,
): LiquidationConcept | undefined {
  return conceptos.find((c) => c.codigo === codigo);
}

function baseInput(over: Partial<LiquidationInput> = {}): LiquidationInput {
  return {
    salarioBase: 3_000_000,
    salarioIntegral: false,
    fechaIngreso: new Date('2023-01-01'),
    fechaRetiro: new Date('2024-01-01'), // 360 días comerciales
    diasSalarioPendiente: 0,
    ...over,
  };
}

// ─── roundPeso ────────────────────────────────────────────────────────────────

describe('roundPeso', () => {
  it('redondea half-up a peso entero', () => {
    expect(roundPeso(120997.5)).toBe(120998);
    expect(roundPeso(7430.67)).toBe(7431);
    expect(roundPeso(56940)).toBe(56940);
    expect(roundPeso(0.5)).toBe(1);
    expect(roundPeso(1.5)).toBe(2);
    expect(roundPeso(2.5)).toBe(3);
  });

  it('no redondea hacia arriba cuando está debajo del punto medio', () => {
    expect(roundPeso(0.4)).toBe(0);
    expect(roundPeso(1.49)).toBe(1);
    expect(roundPeso(2.49)).toBe(2);
  });

  it('limpia ruido de punto flotante antes de redondear', () => {
    // 0.1 + 0.2 = 0.30000000000000004 en IEEE 754 — debe quedar 0
    expect(roundPeso(0.1 + 0.2 - 0.3)).toBe(0);
  });
});

// ─── diasComerciales ──────────────────────────────────────────────────────────

describe('diasComerciales', () => {
  it('1 año exacto = 360 días', () => {
    expect(
      diasComerciales(new Date('2023-01-01'), new Date('2024-01-01')),
    ).toBe(360);
  });

  it('6 meses = 180 días', () => {
    expect(
      diasComerciales(new Date('2023-01-01'), new Date('2023-07-01')),
    ).toBe(180);
  });

  it('mismo día = 0 días', () => {
    expect(
      diasComerciales(new Date('2023-06-15'), new Date('2023-06-15')),
    ).toBe(0);
  });

  it('1 mes = 30 días', () => {
    expect(
      diasComerciales(new Date('2023-01-01'), new Date('2023-02-01')),
    ).toBe(30);
  });

  it('normaliza días > 30: enero 31 → 30', () => {
    // Jan-31 → Feb-28: d1=30, d2=28 → 0*360 + 1*30 + (28-30) = 28
    expect(
      diasComerciales(new Date('2023-01-31'), new Date('2023-02-28')),
    ).toBe(28);
  });

  it('retorna negativo si hasta < desde (lo convierte en error el calculator)', () => {
    expect(
      diasComerciales(new Date('2024-01-01'), new Date('2023-01-01')),
    ).toBe(-360);
  });

  // ── Semántica [desde, hasta): hasta es EXCLUSIVO ──────────────────────────
  // El mapper (N2D.3) debe pasar fechaRetiro + 1 día desde la BD.
  // Si llega el último día trabajado como `hasta`, el resultado está 1 día corto.

  it('[semántica exclusiva] 2023-01-01 → 2024-01-01 = 360 (1 año completo)', () => {
    expect(
      diasComerciales(new Date('2023-01-01'), new Date('2024-01-01')),
    ).toBe(360);
  });

  it('[semántica exclusiva] 2023-01-01 → 2023-12-31 = 359 (último día como `hasta` pierde 1)', () => {
    expect(
      diasComerciales(new Date('2023-01-01'), new Date('2023-12-31')),
    ).toBe(359);
  });

  it('[semántica exclusiva] 2023-01-15 → 2023-07-15 = 180 (6 meses exactos)', () => {
    expect(
      diasComerciales(new Date('2023-01-15'), new Date('2023-07-15')),
    ).toBe(180);
  });

  it('[semántica exclusiva] 2023-01-15 → 2023-07-14 = 179 (último día como `hasta` pierde 1)', () => {
    expect(
      diasComerciales(new Date('2023-01-15'), new Date('2023-07-14')),
    ).toBe(179);
  });
});

// ─── N2D.1 — casos obligatorios ───────────────────────────────────────────────

describe('LiquidationCalculator — caso 1: empleado normal 1 año exacto', () => {
  // salarioBase=3M, fechaIngreso=2023-01-01, fechaRetiro=2024-01-01 → 360 días
  // prima:        3_000_000 × 360/360      = 3_000_000
  // cesantías:    3_000_000 × 360/360      = 3_000_000
  // int cesantías: 3_000_000 × (360/360)×0.12 = 360_000
  // vacaciones:   3_000_000 × 360/720      = 1_500_000
  // totalPrestaciones = 7_860_000

  const r = calculate(baseInput());

  it('emite los 4 conceptos prestacionales', () => {
    const codigos = r.conceptos.map((c) => c.codigo);
    expect(codigos).toContain('LIQ_PRIMA');
    expect(codigos).toContain('LIQ_CESANTIAS');
    expect(codigos).toContain('LIQ_INT_CESANTIAS');
    expect(codigos).toContain('LIQ_VACACIONES');
    expect(r.conceptos).toHaveLength(4);
  });

  it('prima: base=3M, factor=1, valor=3M', () => {
    const c = byCodigo(r.conceptos, 'LIQ_PRIMA')!;
    expect(c.base).toBe(3_000_000);
    expect(c.factor).toBe(1);
    expect(c.valor).toBe(3_000_000);
  });

  it('cesantías: base=3M, factor=1, valor=3M', () => {
    const c = byCodigo(r.conceptos, 'LIQ_CESANTIAS')!;
    expect(c.factor).toBe(1);
    expect(c.valor).toBe(3_000_000);
  });

  it('intereses cesantías: factor=0.12, valor=360_000', () => {
    const c = byCodigo(r.conceptos, 'LIQ_INT_CESANTIAS')!;
    expect(c.factor).toBeCloseTo(0.12, 10);
    expect(c.valor).toBe(360_000);
  });

  it('vacaciones: factor=0.5, valor=1_500_000', () => {
    const c = byCodigo(r.conceptos, 'LIQ_VACACIONES')!;
    expect(c.factor).toBeCloseTo(0.5, 10);
    expect(c.valor).toBe(1_500_000);
  });

  it('totalPrestaciones = 7_860_000', () => {
    expect(r.totalPrestaciones).toBe(7_860_000);
  });

  it('totalSalarioPendiente = 0 (diasSalarioPendiente=0)', () => {
    expect(r.totalSalarioPendiente).toBe(0);
  });

  it('totalLiquidacion = 7_860_000', () => {
    expect(r.totalLiquidacion).toBe(7_860_000);
  });
});

describe('LiquidationCalculator — caso 2: empleado normal 6 meses', () => {
  // fechaRetiro=2023-07-01 → 180 días comerciales
  // prima:         3M × 0.5 = 1_500_000
  // cesantías:     1_500_000
  // int cesantías: 3M × 0.5 × 0.12 = 180_000
  // vacaciones:    3M × 0.25 = 750_000
  // totalPrestaciones = 3_930_000

  const r = calculate(baseInput({ fechaRetiro: new Date('2023-07-01') }));

  it('4 conceptos prestacionales', () => {
    expect(r.conceptos).toHaveLength(4);
  });

  it('prima = 1_500_000', () => {
    expect(byCodigo(r.conceptos, 'LIQ_PRIMA')!.valor).toBe(1_500_000);
  });

  it('cesantías = 1_500_000', () => {
    expect(byCodigo(r.conceptos, 'LIQ_CESANTIAS')!.valor).toBe(1_500_000);
  });

  it('intereses = 180_000', () => {
    expect(byCodigo(r.conceptos, 'LIQ_INT_CESANTIAS')!.valor).toBe(180_000);
  });

  it('vacaciones = 750_000', () => {
    expect(byCodigo(r.conceptos, 'LIQ_VACACIONES')!.valor).toBe(750_000);
  });

  it('totalPrestaciones = 3_930_000', () => {
    expect(r.totalPrestaciones).toBe(3_930_000);
  });

  it('totalLiquidacion = 3_930_000', () => {
    expect(r.totalLiquidacion).toBe(3_930_000);
  });
});

describe('LiquidationCalculator — caso 3: salario integral', () => {
  // salarioBase=12M, salarioIntegral=true, 1 año
  // NO prima, NO cesantías, NO intereses (CST Art. 132)
  // vacaciones: 12M × 0.5 = 6_000_000

  const r = calculate(
    baseInput({ salarioBase: 12_000_000, salarioIntegral: true }),
  );

  it('NO emite LIQ_PRIMA', () => {
    expect(byCodigo(r.conceptos, 'LIQ_PRIMA')).toBeUndefined();
  });

  it('NO emite LIQ_CESANTIAS', () => {
    expect(byCodigo(r.conceptos, 'LIQ_CESANTIAS')).toBeUndefined();
  });

  it('NO emite LIQ_INT_CESANTIAS', () => {
    expect(byCodigo(r.conceptos, 'LIQ_INT_CESANTIAS')).toBeUndefined();
  });

  it('SÍ emite LIQ_VACACIONES con valor=6_000_000', () => {
    const c = byCodigo(r.conceptos, 'LIQ_VACACIONES')!;
    expect(c).toBeDefined();
    expect(c.valor).toBe(6_000_000);
  });

  it('solo 1 concepto (vacaciones)', () => {
    expect(r.conceptos).toHaveLength(1);
  });

  it('totalPrestaciones = 6_000_000', () => {
    expect(r.totalPrestaciones).toBe(6_000_000);
  });

  it('totalLiquidacion = 6_000_000', () => {
    expect(r.totalLiquidacion).toBe(6_000_000);
  });
});

describe('LiquidationCalculator — caso 4: salario pendiente = 0', () => {
  const r = calculate(baseInput({ diasSalarioPendiente: 0 }));

  it('NO emite LIQ_SALARIO_PENDIENTE cuando diasSalarioPendiente = 0', () => {
    expect(byCodigo(r.conceptos, 'LIQ_SALARIO_PENDIENTE')).toBeUndefined();
  });

  it('totalSalarioPendiente = 0', () => {
    expect(r.totalSalarioPendiente).toBe(0);
  });

  it('totalLiquidacion = totalPrestaciones (sin salario pendiente)', () => {
    expect(r.totalLiquidacion).toBe(r.totalPrestaciones);
  });
});

describe('LiquidationCalculator — caso 5: salario pendiente parcial', () => {
  // diasSalarioPendiente=15 → salarioBase × 15/30 = 3M × 0.5 = 1_500_000

  const r = calculate(baseInput({ diasSalarioPendiente: 15 }));

  it('emite LIQ_SALARIO_PENDIENTE', () => {
    expect(byCodigo(r.conceptos, 'LIQ_SALARIO_PENDIENTE')).toBeDefined();
  });

  it('salario pendiente: base=3M, factor=0.5, valor=1_500_000', () => {
    const c = byCodigo(r.conceptos, 'LIQ_SALARIO_PENDIENTE')!;
    expect(c.base).toBe(3_000_000);
    expect(c.factor).toBeCloseTo(0.5, 10);
    expect(c.valor).toBe(1_500_000);
  });

  it('totalSalarioPendiente = 1_500_000', () => {
    expect(r.totalSalarioPendiente).toBe(1_500_000);
  });

  it('totalLiquidacion = prestaciones + salario pendiente', () => {
    // totalPrestaciones (1 año, 3M) = 7_860_000 + salario pendiente 1_500_000
    expect(r.totalLiquidacion).toBe(
      r.totalPrestaciones + r.totalSalarioPendiente,
    );
    expect(r.totalLiquidacion).toBe(9_360_000);
  });

  it('5 conceptos en total (4 prestaciones + 1 salario pendiente)', () => {
    expect(r.conceptos).toHaveLength(5);
  });
});

describe('LiquidationCalculator — caso 5b: salario integral + salario pendiente', () => {
  // salarioIntegral=true, diasSalarioPendiente=10
  // vacaciones: 12M × 0.5 = 6_000_000
  // salario pendiente: 12M × 10/30 = 4_000_000

  const r = calculate(
    baseInput({
      salarioBase: 12_000_000,
      salarioIntegral: true,
      diasSalarioPendiente: 10,
    }),
  );

  it('2 conceptos: vacaciones + salario pendiente', () => {
    expect(r.conceptos).toHaveLength(2);
  });

  it('salario pendiente = 4_000_000', () => {
    expect(byCodigo(r.conceptos, 'LIQ_SALARIO_PENDIENTE')!.valor).toBe(
      4_000_000,
    );
  });

  it('totalLiquidacion = 10_000_000', () => {
    expect(r.totalLiquidacion).toBe(10_000_000);
  });
});

describe('LiquidationCalculator — caso 6: liquidación determinística', () => {
  it('misma entrada produce exactamente la misma salida', () => {
    const input = baseInput({
      salarioBase: 4_321_000,
      diasSalarioPendiente: 7,
    });
    expect(calculate(input)).toEqual(calculate(input));
  });

  it('entradas diferentes producen salidas diferentes', () => {
    const r1 = calculate(baseInput({ salarioBase: 3_000_000 }));
    const r2 = calculate(baseInput({ salarioBase: 4_000_000 }));
    expect(r1.totalLiquidacion).not.toBe(r2.totalLiquidacion);
  });
});

describe('LiquidationCalculator — caso 7: invariantes de totales', () => {
  const cases: LiquidationInput[] = [
    baseInput(),
    baseInput({ salarioBase: 12_000_000, salarioIntegral: true }),
    baseInput({ diasSalarioPendiente: 15 }),
    baseInput({ fechaRetiro: new Date('2023-07-01') }),
    baseInput({
      salarioBase: 12_000_000,
      salarioIntegral: true,
      diasSalarioPendiente: 10,
    }),
  ];

  it.each(cases.map((c, i) => [i + 1, c]))(
    'invariante %i: totalLiquidacion = totalPrestaciones + totalSalarioPendiente',
    (_i, input) => {
      const r = calculate(input);
      expect(r.totalLiquidacion).toBe(
        r.totalPrestaciones + r.totalSalarioPendiente,
      );
    },
  );

  it('totalPrestaciones = suma de conceptos no-PENDIENTE', () => {
    const r = calculate(baseInput({ diasSalarioPendiente: 15 }));
    const sumPrestaciones = r.conceptos
      .filter((c) => c.codigo !== 'LIQ_SALARIO_PENDIENTE')
      .reduce((s, c) => s + c.valor, 0);
    expect(r.totalPrestaciones).toBe(sumPrestaciones);
  });

  it('totalSalarioPendiente = suma de conceptos PENDIENTE', () => {
    const r = calculate(baseInput({ diasSalarioPendiente: 8 }));
    const sumPendiente = r.conceptos
      .filter((c) => c.codigo === 'LIQ_SALARIO_PENDIENTE')
      .reduce((s, c) => s + c.valor, 0);
    expect(r.totalSalarioPendiente).toBe(sumPendiente);
  });

  it('valor de cada concepto = roundPeso(base × factor)', () => {
    const r = calculate(baseInput({ diasSalarioPendiente: 15 }));
    for (const c of r.conceptos) {
      expect(c.valor).toBe(roundPeso(c.base * c.factor));
    }
  });
});

describe('LiquidationCalculator — caso 8: redondeo half-up', () => {
  it('redondea half-up en concepto prima', () => {
    // 5_000_001 × 0.5 = 2_500_000.5 → 2_500_001
    const r = calculate(
      baseInput({
        salarioBase: 5_000_001,
        fechaRetiro: new Date('2023-07-01'), // 180 días → factor 0.5
      }),
    );
    expect(byCodigo(r.conceptos, 'LIQ_PRIMA')!.valor).toBe(2_500_001);
  });

  it('redondea half-up en concepto vacaciones', () => {
    // salarioBase=3 pesos, dias=180 → factor=180/720=0.25 → 3×0.25=0.75 → 1
    const r = calculate(
      baseInput({
        salarioBase: 3,
        fechaRetiro: new Date('2023-07-01'),
      }),
    );
    expect(byCodigo(r.conceptos, 'LIQ_VACACIONES')!.valor).toBe(1);
  });

  it('redondea half-up en salario pendiente', () => {
    // 5_000_001 × 15/30 = 2_500_000.5 → 2_500_001
    const r = calculate(
      baseInput({ salarioBase: 5_000_001, diasSalarioPendiente: 15 }),
    );
    expect(byCodigo(r.conceptos, 'LIQ_SALARIO_PENDIENTE')!.valor).toBe(
      2_500_001,
    );
  });

  it('no redondea hacia arriba para valores < .5', () => {
    // salarioBase=2 pesos, dias=180 → prima=2×0.5=1.0 → exacto 1
    // salarioBase=1 peso,  dias=90  → prima=1×(90/360)=0.25 → 0
    const r = calculate(
      baseInput({ salarioBase: 1, fechaRetiro: new Date('2023-04-01') }), // 90 días
    );
    expect(byCodigo(r.conceptos, 'LIQ_PRIMA')!.valor).toBe(0);
  });
});

describe('LiquidationCalculator — caso 9: fechas invertidas lanzan error', () => {
  it('lanza Error cuando fechaRetiro < fechaIngreso', () => {
    expect(() =>
      calculate(
        baseInput({
          fechaIngreso: new Date('2024-01-01'),
          fechaRetiro: new Date('2023-01-01'),
        }),
      ),
    ).toThrow(Error);
  });

  it('el mensaje de error identifica las fechas problemáticas', () => {
    expect(() =>
      calculate(
        baseInput({
          fechaIngreso: new Date('2024-06-15'),
          fechaRetiro: new Date('2024-03-01'),
        }),
      ),
    ).toThrow(/fechaRetiro.*anterior.*fechaIngreso/i);
  });

  it('NO lanza cuando fechaIngreso = fechaRetiro (0 días)', () => {
    expect(() =>
      calculate(
        baseInput({
          fechaIngreso: new Date('2023-06-01'),
          fechaRetiro: new Date('2023-06-01'),
        }),
      ),
    ).not.toThrow();
  });
});

describe('LiquidationCalculator — caso 10: fechaIngreso = fechaRetiro (0 días)', () => {
  // días = 0 → todos los factores = 0 → todos los valores = 0
  const r = calculate(
    baseInput({
      fechaIngreso: new Date('2023-06-15'),
      fechaRetiro: new Date('2023-06-15'),
    }),
  );

  it('todos los conceptos prestacionales tienen valor = 0', () => {
    for (const c of r.conceptos) {
      expect(c.valor).toBe(0);
    }
  });

  it('totalLiquidacion = 0', () => {
    expect(r.totalLiquidacion).toBe(0);
  });

  it('NO emite LIQ_SALARIO_PENDIENTE (diasSalarioPendiente=0)', () => {
    expect(byCodigo(r.conceptos, 'LIQ_SALARIO_PENDIENTE')).toBeUndefined();
  });

  it('emite los 4 conceptos con factor=0 (auditable)', () => {
    expect(r.conceptos).toHaveLength(4);
    for (const c of r.conceptos) {
      expect(c.factor).toBe(0);
    }
  });
});
