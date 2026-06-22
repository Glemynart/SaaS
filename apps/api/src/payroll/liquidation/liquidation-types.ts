/**
 * Tipos del LiquidationCalculator (N2D.1).
 *
 * Sin dependencias de Prisma ni NestJS. El calculator es puro.
 * El mapper (N2D.3) resolverá entidades Prisma → estos DTOs antes de
 * invocar calculate(), y mapeará el resultado a las entidades de persistencia.
 *
 * Decisiones de cálculo (cerradas para N2D.1):
 *  - salarioBase: lo que el mapper entregue (puede ser SBL con o sin auxilio
 *    según el concepto; en N2D.1 el caller es responsable de esa resolución).
 *  - Convención de días: comercial colombiana, 30 días/mes, 360 días/año.
 *  - Salario integral (CST Art. 132): el factor prestacional del 30% ya
 *    remunera prima, cesantías e intereses → solo se liquidan vacaciones.
 */

/** Códigos estables del catálogo de conceptos de liquidación. */
export type LiquidationConceptCode =
  | 'LIQ_PRIMA'
  | 'LIQ_CESANTIAS'
  | 'LIQ_INT_CESANTIAS'
  | 'LIQ_VACACIONES'
  | 'LIQ_SALARIO_PENDIENTE';

/** Una línea calculada de la liquidación. */
export interface LiquidationConcept {
  codigo: LiquidationConceptCode;
  nombre: string;
  /** Base monetaria sobre la que se aplica el factor (en pesos, entero). */
  base: number;
  /** Factor adimensional (ej. diasTrabajados/360). No se redondea: es tasa, no dinero. */
  factor: number;
  /** Monto en peso entero: roundPeso(base × factor). */
  valor: number;
}

/** Entrada del calculator de liquidación. */
export interface LiquidationInput {
  /** Salario base de liquidación, ya resuelto por el mapper (COP, entero). */
  salarioBase: number;
  /** true → omite prima, cesantías e intereses (CST Art. 132). */
  salarioIntegral: boolean;
  /** Fecha de inicio del contrato (o del período de liquidación). */
  fechaIngreso: Date;
  /** Fecha de retiro del empleado (último día trabajado, inclusive). */
  fechaRetiro: Date;
  /**
   * Días de salario aún no cubiertos por un PayrollRun del mes de retiro.
   * 0 → no se emite LIQ_SALARIO_PENDIENTE.
   * El mapper (N2D.4) resuelve si existe un run que ya pagó estos días.
   */
  diasSalarioPendiente: number;
}

/** Resultado del calculator de liquidación. Todos los montos en peso entero. */
export interface LiquidationResult {
  conceptos: LiquidationConcept[];
  /** Σ prima + cesantías + intereses + vacaciones. */
  totalPrestaciones: number;
  /** Σ salario pendiente (0 si diasSalarioPendiente = 0). */
  totalSalarioPendiente: number;
  /** totalPrestaciones + totalSalarioPendiente. */
  totalLiquidacion: number;
}
