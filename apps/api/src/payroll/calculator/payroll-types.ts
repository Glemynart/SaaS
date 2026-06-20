/**
 * Tipos del PayrollCalculator (N2A).
 *
 * Deliberadamente SIN dependencias de Prisma ni NestJS: el calculator es puro.
 * El servicio mapea las entidades Prisma a estos DTOs planos antes de invocar
 * calculate(), y mapea el resultado de vuelta a PayrollRun / PayrollConcept.
 */

import { PayrollWarning } from './payroll-warnings';

/** Espejo del enum Prisma PayrollConceptType (definido aquí para no acoplar a Prisma). */
export type PayrollConceptType =
  | 'EARNING'
  | 'DEDUCTION'
  | 'EMPLOYER_CONTRIBUTION';

/** Clase de riesgo ARL (Decreto 1072/2015). El servicio resuelve null → 1. */
export type ArlClase = 1 | 2 | 3 | 4 | 5;

/** Códigos estables del catálogo de conceptos N2A. */
export const ConceptCodigo = {
  SALARIO_BASE: 'SALARIO_BASE',
  BONUS: 'BONUS',
  OVERTIME: 'OVERTIME',
  AUX_TRANSP: 'AUX_TRANSP',
  SALUD_EMP: 'SALUD_EMP',
  PENSION_EMP: 'PENSION_EMP',
  FSP: 'FSP',
  SALUD_PAT: 'SALUD_PAT',
  PENSION_PAT: 'PENSION_PAT',
  ARL: 'ARL',
  CAJA: 'CAJA',
  ICBF: 'ICBF',
  SENA: 'SENA',
} as const;

export type ConceptCodigo = (typeof ConceptCodigo)[keyof typeof ConceptCodigo];

/** Un tramo de la escala progresiva del Fondo de Solidaridad Pensional. */
export interface FspTramo {
  desdeSmmlv: number; // inclusivo
  hastaSmmlv: number | null; // exclusivo; null = sin tope superior
  pct: number; // tasa TOTAL del tramo (fracción), no adicional
}

/**
 * Copia plana de ParametroLegalNomina vigente. Todos los valores en `number`
 * (el servicio convierte Decimal → number al mapear). Las tarifas son fracciones
 * (0.04 = 4%). Los montos son COP en peso.
 */
export interface LegalParamsSnapshot {
  smmlv: number;
  auxilioTransporte: number;

  topeIbcMinSmmlv: number;
  topeIbcMaxSmmlv: number;
  umbralAuxilioSmmlv: number;
  umbralExoneracionSmmlv: number;

  pctSaludEmpleado: number;
  pctPensionEmpleado: number;
  pctSaludEmpleador: number;
  pctPensionEmpleador: number;
  pctCaja: number;
  pctIcbf: number;
  pctSena: number;

  /** Tarifa ARL indexada por clase de riesgo (1–5). */
  arlPorClase: Record<ArlClase, number>;

  fspTramos: FspTramo[];
}

/** Novedad ya normalizada que el calculator consume (N2A: solo BONUS/OVERTIME relevantes). */
export interface NoveltyInput {
  tipo: string;
  valor: number;
}

/** Entrada del calculator: un empleado, ya resuelto por el servicio. */
export interface PayrollCalculationInput {
  /** Empleado.salario — fuente oficial del salario (decisión cerrada). */
  salarioBase: number;
  /** Empleado.salarioIntegral → IBC al 70%. */
  salarioIntegral: boolean;
  /** Contrato.claseRiesgoArl ya resuelta (null → 1 lo hace el servicio). */
  claseRiesgoArl: ArlClase;
  /** Tenant.aportesExonerados (Art. 114-1). */
  aportesExonerados: boolean;
  /** Parámetros legales vigentes, resueltos por el servicio (no-null garantizado). */
  legalParams: LegalParamsSnapshot;
  /** Novedades del período para este empleado. */
  novelties: NoveltyInput[];
}

/** Una línea de concepto calculada. */
export interface ConceptResult {
  tipo: PayrollConceptType;
  codigo: ConceptCodigo;
  nombre: string;
  base: number | null; // base de cálculo (IBC) o null para devengos fijos
  factor: number | null; // tarifa aplicada o null
  valor: number; // peso entero
}

/** Salida del calculator. Todos los montos en peso entero. */
export interface PayrollCalculationResult {
  concepts: ConceptResult[];
  ibc: number;
  auxilioTransporte: number;
  totalDevengos: number;
  totalDeducciones: number;
  totalAportesPatronales: number;
  netoPagar: number;
  costoTotalEmpleador: number;
  warnings: PayrollWarning[];
}
