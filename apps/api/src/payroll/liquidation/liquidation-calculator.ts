/**
 * LiquidationCalculator (N2D.1) — función pura, determinística, sin I/O.
 *
 *   LiquidationInput → calculate() → LiquidationResult
 *
 * No accede a Prisma, NestJS, base de datos ni servicios. Toda la resolución
 * de bases (con/sin auxilio), novedades históricas y detección de PayrollRun
 * del mes de retiro ocurre en el mapper y el servicio (N2D.3 / N2D.4).
 *
 * Fórmulas (convención comercial colombiana, 30 días/mes, 360 días/año):
 *
 *   Prima (CST Art. 306)           valor = salarioBase × días / 360
 *   Cesantías (CST Art. 249)       valor = salarioBase × días / 360
 *   Intereses cesantías (Ley 52)   valor = salarioBase × (días / 360) × 0.12
 *   Vacaciones (CST Art. 186)      valor = salarioBase × días / 720
 *   Salario pendiente              valor = salarioBase × diasPendientes / 30
 *
 * Salario integral (CST Art. 132): el factor prestacional ≥ 30% ya remunera
 * prima, cesantías e intereses → se omiten. Solo se liquidan vacaciones
 * (derecho de descanso, no prestación social) y salario pendiente.
 *
 * Invariante: concepto.valor === roundPeso(concepto.base × concepto.factor)
 * Los totales se obtienen sumando los valores ya redondeados (no se redondeán
 * los totales por separado).
 */

import {
  LiquidationConcept,
  LiquidationConceptCode,
  LiquidationInput,
  LiquidationResult,
} from './liquidation-types';

/**
 * Redondeo half-up a peso entero. Limpia ruido de punto flotante a 6 decimales
 * antes de redondear, para que un valor legítimamente .5 no caiga a .4999998.
 * Espejo exacto del roundPeso de PayrollCalculator.
 */
export function roundPeso(value: number): number {
  const cleaned = Math.round(value * 1e6) / 1e6;
  return Math.floor(cleaned + 0.5);
}

/**
 * Diferencia en días bajo convención comercial colombiana (30E/360).
 * Intervalo [desde, hasta): `desde` es inclusivo, `hasta` es exclusivo.
 *
 *   diasComerciales(2023-01-01, 2024-01-01) → 360  // 1 año completo
 *   diasComerciales(2023-01-01, 2023-12-31) → 359  // ← NO es 1 año
 *
 * Consecuencia para el mapper (N2D.3): `Empleado.fechaRetiro` en la base
 * de datos es el último día trabajado (inclusivo, convención PILA/DIAN).
 * El mapper DEBE sumar 1 día calendario antes de pasarlo aquí:
 *   fechaFinExclusivo = addDays(empleado.fechaRetiro, 1)
 *
 * Cada mes vale 30 días. Días del mes > 30 se normalizan a 30 (no se
 * inflan los meses cortos). Retorna negativo si `hasta` < `desde`.
 */
export function diasComerciales(desde: Date, hasta: Date): number {
  // UTC methods: las fechas laborales son ISO YYYY-MM-DD y se parsean como
  // medianoche UTC. getDate() devolvería el día anterior en zonas UTC-N.
  let d1 = desde.getUTCDate();
  const m1 = desde.getUTCMonth() + 1;
  const y1 = desde.getUTCFullYear();

  let d2 = hasta.getUTCDate();
  const m2 = hasta.getUTCMonth() + 1;
  const y2 = hasta.getUTCFullYear();

  if (d1 > 30) d1 = 30;
  if (d2 > 30) d2 = 30;

  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

function concepto(
  codigo: LiquidationConceptCode,
  nombre: string,
  base: number,
  factor: number,
): LiquidationConcept {
  return { codigo, nombre, base, factor, valor: roundPeso(base * factor) };
}

export function calculate(input: LiquidationInput): LiquidationResult {
  const {
    salarioBase,
    salarioIntegral,
    fechaIngreso,
    fechaRetiro,
    diasSalarioPendiente,
  } = input;

  const dias = diasComerciales(fechaIngreso, fechaRetiro);
  if (dias < 0) {
    throw new Error(
      `fechaRetiro (${fechaRetiro.toISOString().slice(0, 10)}) es anterior a ` +
        `fechaIngreso (${fechaIngreso.toISOString().slice(0, 10)})`,
    );
  }

  const conceptos: LiquidationConcept[] = [];

  // Prestaciones sociales — omitidas en salario integral (CST Art. 132)
  if (!salarioIntegral) {
    conceptos.push(
      concepto('LIQ_PRIMA', 'Prima de servicios', salarioBase, dias / 360),
    );
    conceptos.push(
      concepto('LIQ_CESANTIAS', 'Cesantías', salarioBase, dias / 360),
    );
    conceptos.push(
      concepto(
        'LIQ_INT_CESANTIAS',
        'Intereses sobre cesantías',
        salarioBase,
        (dias / 360) * 0.12,
      ),
    );
  }

  // Vacaciones: siempre (incluido salario integral — es descanso, no prestación)
  conceptos.push(
    concepto('LIQ_VACACIONES', 'Vacaciones', salarioBase, dias / 720),
  );

  // Salario pendiente: solo si hay días sin cubrir por el run mensual
  if (diasSalarioPendiente > 0) {
    conceptos.push(
      concepto(
        'LIQ_SALARIO_PENDIENTE',
        'Salario días pendientes',
        salarioBase,
        diasSalarioPendiente / 30,
      ),
    );
  }

  const totalPrestaciones = conceptos
    .filter((c) => c.codigo !== 'LIQ_SALARIO_PENDIENTE')
    .reduce((s, c) => s + c.valor, 0);

  const totalSalarioPendiente = conceptos
    .filter((c) => c.codigo === 'LIQ_SALARIO_PENDIENTE')
    .reduce((s, c) => s + c.valor, 0);

  return {
    conceptos,
    totalPrestaciones,
    totalSalarioPendiente,
    totalLiquidacion: totalPrestaciones + totalSalarioPendiente,
  };
}
