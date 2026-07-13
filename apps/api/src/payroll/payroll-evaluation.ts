/**
 * Clasificacion funcional de una regla de evaluacion de Payroll (P1/U4).
 *
 * Esta capa no persiste bloqueos ni decide aprobacion; solo expresa si una
 * regla produjo un resultado valido, un warning informativo o un bloqueo
 * funcional para la evaluacion de un empleado en un PayrollPeriod.
 */

export const PayrollEvaluationKind = {
  VALID: 'VALID',
  WARNING: 'WARNING',
  BLOCK: 'BLOCK',
} as const;

export type PayrollEvaluationKind =
  (typeof PayrollEvaluationKind)[keyof typeof PayrollEvaluationKind];

export const PayrollBlockCode = {
  MISSING_ACTIVE_CONTRACT: 'MISSING_ACTIVE_CONTRACT',
  INVALID_ARL_CLASS: 'INVALID_ARL_CLASS',
  UNSUPPORTED_INTEGRAL_SALARY: 'UNSUPPORTED_INTEGRAL_SALARY',
  MATERIAL_SALARY_MISMATCH: 'MATERIAL_SALARY_MISMATCH',
} as const;

export type PayrollBlockCode =
  (typeof PayrollBlockCode)[keyof typeof PayrollBlockCode];

export interface PayrollValidEvaluation {
  kind: typeof PayrollEvaluationKind.VALID;
}

export interface PayrollInformativeWarning {
  kind: typeof PayrollEvaluationKind.WARNING;
  code: string;
  message: string;
}

export interface PayrollFunctionalBlock {
  kind: typeof PayrollEvaluationKind.BLOCK;
  code: PayrollBlockCode;
  message: string;
}

export type PayrollEvaluationResult =
  | PayrollValidEvaluation
  | PayrollInformativeWarning
  | PayrollFunctionalBlock;

export function validEvaluation(): PayrollValidEvaluation {
  return { kind: PayrollEvaluationKind.VALID };
}

export function informativeWarning(
  code: string,
  message: string,
): PayrollInformativeWarning {
  return { kind: PayrollEvaluationKind.WARNING, code, message };
}

export function functionalBlock(
  code: PayrollBlockCode,
  message: string,
): PayrollFunctionalBlock {
  return { kind: PayrollEvaluationKind.BLOCK, code, message };
}

export function isInformativeWarning(
  result: PayrollEvaluationResult,
): result is PayrollInformativeWarning {
  return result.kind === PayrollEvaluationKind.WARNING;
}

export function isFunctionalBlock(
  result: PayrollEvaluationResult,
): result is PayrollFunctionalBlock {
  return result.kind === PayrollEvaluationKind.BLOCK;
}
