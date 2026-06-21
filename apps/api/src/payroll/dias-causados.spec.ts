import { resolveDiasCausados } from './dias-causados';

/** Helper: fecha UTC pura desde 'YYYY-MM-DD'. */
function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

// Período estándar: junio 2026 (mes de 30 días).
const P_INI = d('2026-06-01');
const P_FIN = d('2026-06-30');

describe('resolveDiasCausados — casos obligatorios N2C.1a', () => {
  it('1. activo todo el período → 30', () => {
    expect(resolveDiasCausados(d('2025-01-01'), null, P_INI, P_FIN)).toBe(30);
  });

  it('2. ingreso dentro del período (día 15) → 16', () => {
    expect(resolveDiasCausados(d('2026-06-15'), null, P_INI, P_FIN)).toBe(16);
  });

  it('3. retiro dentro del período (día 10) → 10', () => {
    expect(
      resolveDiasCausados(d('2025-01-01'), d('2026-06-10'), P_INI, P_FIN),
    ).toBe(10);
  });

  it('4. ingreso y retiro dentro del período (10 → 20) → 11', () => {
    expect(
      resolveDiasCausados(d('2026-06-10'), d('2026-06-20'), P_INI, P_FIN),
    ).toBe(11);
  });

  it('5. ingreso después del período → 0', () => {
    expect(resolveDiasCausados(d('2026-07-05'), null, P_INI, P_FIN)).toBe(0);
  });

  it('6. retiro antes del período → 0', () => {
    expect(
      resolveDiasCausados(d('2025-01-01'), d('2026-05-20'), P_INI, P_FIN),
    ).toBe(0);
  });

  it('7. cubre completamente el período (ingreso antes, retiro después) → 30', () => {
    expect(
      resolveDiasCausados(d('2024-01-01'), d('2027-12-31'), P_INI, P_FIN),
    ).toBe(30);
  });
});

describe('resolveDiasCausados — bordes de mes', () => {
  it('ingreso el primer día del período → 30', () => {
    expect(resolveDiasCausados(d('2026-06-01'), null, P_INI, P_FIN)).toBe(30);
  });

  it('ingreso el último día del período → 1', () => {
    expect(resolveDiasCausados(d('2026-06-30'), null, P_INI, P_FIN)).toBe(1);
  });

  it('retiro el primer día del período → 1', () => {
    expect(
      resolveDiasCausados(d('2025-01-01'), d('2026-06-01'), P_INI, P_FIN),
    ).toBe(1);
  });

  it('febrero completo (28 días calendario) → 30 (regla del "30 de febrero")', () => {
    expect(
      resolveDiasCausados(
        d('2025-01-01'),
        null,
        d('2026-02-01'),
        d('2026-02-28'),
      ),
    ).toBe(30);
  });

  it('mes de 31 días (julio) activo completo → 30 (día 31 capado)', () => {
    expect(
      resolveDiasCausados(
        d('2025-01-01'),
        null,
        d('2026-07-01'),
        d('2026-07-31'),
      ),
    ).toBe(30);
  });

  it('retiro el día 31 de un mes de 31 días → 30', () => {
    expect(
      resolveDiasCausados(
        d('2025-01-01'),
        d('2026-07-31'),
        d('2026-07-01'),
        d('2026-07-31'),
      ),
    ).toBe(30);
  });
});

describe('resolveDiasCausados — robustez', () => {
  it('datos incoherentes (retiro antes del ingreso) → 0', () => {
    expect(
      resolveDiasCausados(d('2026-06-20'), d('2026-06-10'), P_INI, P_FIN),
    ).toBe(0);
  });

  it('ignora la componente horaria (cuenta solo por fecha)', () => {
    const ingresoConHora = new Date('2026-06-15T18:45:00.000Z');
    expect(resolveDiasCausados(ingresoConHora, null, P_INI, P_FIN)).toBe(16);
  });

  it('es determinístico: misma entrada → misma salida', () => {
    const a = resolveDiasCausados(
      d('2026-06-12'),
      d('2026-06-25'),
      P_INI,
      P_FIN,
    );
    const b = resolveDiasCausados(
      d('2026-06-12'),
      d('2026-06-25'),
      P_INI,
      P_FIN,
    );
    expect(a).toBe(b);
  });

  it('siempre devuelve un entero en [0, 30]', () => {
    const valores = [
      resolveDiasCausados(d('2026-06-01'), null, P_INI, P_FIN),
      resolveDiasCausados(d('2026-06-17'), d('2026-06-28'), P_INI, P_FIN),
      resolveDiasCausados(d('2026-08-01'), null, P_INI, P_FIN),
    ];
    for (const v of valores) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(30);
    }
  });
});
