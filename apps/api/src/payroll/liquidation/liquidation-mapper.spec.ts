import { Prisma } from '@prisma/client';
import { addDays, buildLiquidationInput } from './liquidation-mapper';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseEmp = {
  id: 'emp-test-001',
  salario: new Prisma.Decimal(3_000_000),
  salarioIntegral: false,
  fechaIngreso: new Date('2023-01-01'),
};

// ── addDays ───────────────────────────────────────────────────────────────────

describe('addDays', () => {
  it('suma 1 día calendario a 2023-12-31 → 2024-01-01', () => {
    const result = addDays(new Date('2023-12-31'), 1);
    expect(result.toISOString().slice(0, 10)).toBe('2024-01-01');
  });

  it('suma 1 día a último día de febrero en año bisiesto', () => {
    const result = addDays(new Date('2024-02-29'), 1);
    expect(result.toISOString().slice(0, 10)).toBe('2024-03-01');
  });

  it('no muta la fecha original', () => {
    const original = new Date('2023-06-15');
    addDays(original, 10);
    expect(original.toISOString().slice(0, 10)).toBe('2023-06-15');
  });
});

// ── buildLiquidationInput ─────────────────────────────────────────────────────

describe('buildLiquidationInput — adaptación semántica inclusivo → exclusivo', () => {
  /**
   * Caso 1 (requerido):
   * Retiro 2023-12-31 (último día trabajado, inclusivo en BD)
   * → el mapper debe enviar 2024-01-01 al calculator (exclusivo).
   */
  it('caso 1: retiro 2023-12-31 → calculator recibe fechaRetiro = 2024-01-01', () => {
    const { input } = buildLiquidationInput(baseEmp, new Date('2023-12-31'));

    expect(input.fechaRetiro.toISOString().slice(0, 10)).toBe('2024-01-01');
  });

  /**
   * Caso 2 (requerido):
   * Empleado ingresa 2023-01-01, retiro 2023-12-31.
   * diasComerciales(2023-01-01, 2024-01-01) = 360 → año completo.
   */
  it('caso 2: 2023-01-01 → retiro 2023-12-31 → diasLiquidados = 360', () => {
    const { diasLiquidados } = buildLiquidationInput(
      baseEmp,
      new Date('2023-12-31'),
    );

    expect(diasLiquidados).toBe(360);
  });

  /**
   * Caso 3 (requerido):
   * Empleado sin fechaRetiro → debe lanzar error descriptivo.
   */
  it('caso 3: fechaRetiro null → lanza error con mensaje descriptivo', () => {
    expect(() => buildLiquidationInput(baseEmp, null)).toThrow(
      /fechaRetiro no registrada/i,
    );
  });

  it('caso 3: el error menciona el id del empleado', () => {
    expect(() => buildLiquidationInput(baseEmp, null)).toThrow(baseEmp.id);
  });
});

describe('buildLiquidationInput — invariantes del input', () => {
  it('salarioBase = Number(emp.salario)', () => {
    const { input } = buildLiquidationInput(baseEmp, new Date('2023-12-31'));
    expect(input.salarioBase).toBe(3_000_000);
  });

  it('salarioIntegral se propaga al input', () => {
    const integral = { ...baseEmp, salarioIntegral: true };
    const { input } = buildLiquidationInput(integral, new Date('2023-12-31'));
    expect(input.salarioIntegral).toBe(true);
  });

  it('fechaIngreso se propaga sin modificar', () => {
    const { input } = buildLiquidationInput(baseEmp, new Date('2023-12-31'));
    expect(input.fechaIngreso.toISOString().slice(0, 10)).toBe('2023-01-01');
  });

  it('diasSalarioPendiente por defecto = 0', () => {
    const { input } = buildLiquidationInput(baseEmp, new Date('2023-12-31'));
    expect(input.diasSalarioPendiente).toBe(0);
  });

  it('diasSalarioPendiente se propaga si se pasa explícitamente', () => {
    const { input } = buildLiquidationInput(
      baseEmp,
      new Date('2023-12-31'),
      15,
    );
    expect(input.diasSalarioPendiente).toBe(15);
  });

  it('6 meses: retiro 2023-06-30 → diasLiquidados = 180', () => {
    const { diasLiquidados } = buildLiquidationInput(
      baseEmp,
      new Date('2023-06-30'),
    );
    // addDays(2023-06-30, 1) = 2023-07-01
    // diasComerciales(2023-01-01, 2023-07-01) = 180
    expect(diasLiquidados).toBe(180);
  });

  it('mismo día: ingreso = retiro → diasLiquidados = 1 (trabaja ese día)', () => {
    const emp = { ...baseEmp, fechaIngreso: new Date('2023-06-15') };
    const { diasLiquidados } = buildLiquidationInput(
      emp,
      new Date('2023-06-15'),
    );
    // addDays(2023-06-15, 1) = 2023-06-16
    // diasComerciales(2023-06-15, 2023-06-16) = 1
    expect(diasLiquidados).toBe(1);
  });
});
