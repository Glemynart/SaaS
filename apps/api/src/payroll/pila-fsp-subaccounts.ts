import { PayrollPilaFspSourceScope } from '@prisma/client';
import {
  getPilaContributionRoundingRuleVersion,
  PILA_CONTRIBUTION_ROUNDING_RULE_VERSION,
} from './pila-contribution-rounding';

export const PILA_FSP_SUBACCOUNT_RULE_VERSION =
  'CO_FSP_SUBACCOUNTS_DEC1833_PRE_2027_04_01_V1' as const;
export const PILA_FSP_NEW_SYSTEM_EFFECTIVE_FROM = '2027-04-01' as const;
export const PILA_FSP_AFFILIATION_ROUTING_REVIEW_FROM = '2025-07-01' as const;

export interface PilaFspPayrollConceptSource {
  tipo: string;
  base: number | null;
  factor: number | null;
  valor: number;
}

export interface PilaFspSubaccountAssessmentInput {
  sourceScope: PayrollPilaFspSourceScope;
  periodStart: string;
  periodEnd: string;
  paymentDate: string | null;
  ibcPensional: number | null;
  smmlv: number | null;
  fspConcepts: PilaFspPayrollConceptSource[];
}

export interface PilaFspSubaccountAssessment {
  sourceScope: PayrollPilaFspSourceScope;
  sourceScopeUpdatedAt: string | null;
  sourceScopeUpdatedById: string | null;
  status: 'READY' | 'BLOCKED';
  blocker: string | null;
  ruleVersion: typeof PILA_FSP_SUBACCOUNT_RULE_VERSION | null;
  roundingRuleVersion: typeof PILA_CONTRIBUTION_ROUNDING_RULE_VERSION | null;
  ibcPensionalAgregado: number | null;
  smmlv: number | null;
  solidaridad: number | null;
  subsistencia: number | null;
  payrollFspAmount: number | null;
}

export function assessPilaFspSubaccounts(
  input: PilaFspSubaccountAssessmentInput & {
    sourceScopeUpdatedAt?: Date | null;
    sourceScopeUpdatedById?: string | null;
  },
): PilaFspSubaccountAssessment {
  const sourceScopeUpdatedAt =
    input.sourceScopeUpdatedAt?.toISOString() ?? null;
  const sourceScopeUpdatedById = input.sourceScopeUpdatedById ?? null;
  const blocked = (blocker: string): PilaFspSubaccountAssessment => ({
    sourceScope: input.sourceScope,
    sourceScopeUpdatedAt,
    sourceScopeUpdatedById,
    status: 'BLOCKED',
    blocker,
    ruleVersion: null,
    roundingRuleVersion: null,
    ibcPensionalAgregado: null,
    smmlv: null,
    solidaridad: null,
    subsistencia: null,
    payrollFspAmount: null,
  });

  if (input.sourceScope !== PayrollPilaFspSourceScope.SINGLE_SOURCE_CONFIRMED) {
    return blocked(
      input.sourceScope === PayrollPilaFspSourceScope.MULTIPLE_SOURCES
        ? 'Hay múltiples fuentes de ingreso pensional; su agregación y distribución no está soportada.'
        : 'Falta confirmar el alcance completo de ingresos pensionales para este período.',
    );
  }

  if (
    !isCalendarDate(input.periodStart) ||
    !isCalendarDate(input.periodEnd) ||
    input.periodEnd < input.periodStart
  ) {
    return blocked('El período de cotización no tiene fechas válidas.');
  }

  if (
    input.periodStart >= PILA_FSP_NEW_SYSTEM_EFFECTIVE_FROM ||
    input.periodEnd >= PILA_FSP_NEW_SYSTEM_EFFECTIVE_FROM
  ) {
    return blocked(
      'El período alcanza el 2027-04-01; falta versionar las reglas del nuevo sistema pensional.',
    );
  }

  if (input.periodEnd >= PILA_FSP_AFFILIATION_ROUTING_REVIEW_FROM) {
    return blocked(
      'AT2 v30 diferencia el destino FSP por estado de afiliación pensional S/N desde 2025-07-01; el snapshot no conserva ese estado y su aplicación frente al nuevo sistema pensional requiere reconciliación.',
    );
  }

  if (!isCalendarDate(input.paymentDate)) {
    return blocked('Falta la fecha prevista de pago PILA congelada.');
  }
  if (input.paymentDate >= PILA_FSP_NEW_SYSTEM_EFFECTIVE_FROM) {
    return blocked(
      'La fecha prevista de pago alcanza el 2027-04-01; falta versionar las reglas del nuevo sistema pensional.',
    );
  }

  if (getPilaContributionRoundingRuleVersion(input.periodStart) === null) {
    return blocked(
      'No hay una regla PILA de redondeo versionada para el período.',
    );
  }

  if (
    !safePositiveInteger(input.smmlv) ||
    input.ibcPensional === null ||
    !Number.isSafeInteger(input.ibcPensional) ||
    input.ibcPensional < 0
  ) {
    return blocked(
      'Falta un SMMLV válido o el IBC pensional agregado congelado.',
    );
  }

  const rate = getFspSubaccountRates(input.ibcPensional, input.smmlv);
  const solidaridad = roundUpToHundred(input.ibcPensional, rate.solidarityBps);
  const subsistencia = roundUpToHundred(
    input.ibcPensional,
    rate.subsistenceBps,
  );
  if (solidaridad === null || subsistencia === null) {
    return blocked('No se pudieron calcular importes FSP seguros para PILA.');
  }

  const expectedTotal = solidaridad + subsistencia;
  if (!Number.isSafeInteger(expectedTotal)) {
    return blocked(
      'El total de las subcuentas excede el rango numérico seguro.',
    );
  }

  const payrollFspAmount = reconcilePayrollFsp(
    input.ibcPensional,
    rate.totalBps,
    input.fspConcepts,
    expectedTotal,
  );
  if (payrollFspAmount === null) {
    return blocked(
      'El total de las subcuentas no concilia con el concepto FSP congelado en nómina; no se ajustan importes aprobados.',
    );
  }

  return {
    sourceScope: input.sourceScope,
    sourceScopeUpdatedAt,
    sourceScopeUpdatedById,
    status: 'READY',
    blocker: null,
    ruleVersion: PILA_FSP_SUBACCOUNT_RULE_VERSION,
    roundingRuleVersion: PILA_CONTRIBUTION_ROUNDING_RULE_VERSION,
    ibcPensionalAgregado: input.ibcPensional,
    smmlv: input.smmlv,
    solidaridad,
    subsistencia,
    payrollFspAmount,
  };
}

export function getFspSubaccountRates(ibc: number, smmlv: number) {
  if (!Number.isSafeInteger(ibc) || ibc < 0 || !safePositiveInteger(smmlv)) {
    return { solidarityBps: 0, subsistenceBps: 0, totalBps: 0 };
  }

  const amount = BigInt(ibc);
  const minimumSalary = BigInt(smmlv);
  if (amount < 4n * minimumSalary) {
    return { solidarityBps: 0, subsistenceBps: 0, totalBps: 0 };
  }

  let additionalSubsistenceBps = 0;
  if (amount >= 16n * minimumSalary) {
    if (amount <= 17n * minimumSalary) additionalSubsistenceBps = 20;
    else if (amount <= 18n * minimumSalary) additionalSubsistenceBps = 40;
    else if (amount <= 19n * minimumSalary) additionalSubsistenceBps = 60;
    else if (amount <= 20n * minimumSalary) additionalSubsistenceBps = 80;
    else additionalSubsistenceBps = 100;
  }

  const solidarityBps = 50;
  const subsistenceBps = 50 + additionalSubsistenceBps;
  return {
    solidarityBps,
    subsistenceBps,
    totalBps: solidarityBps + subsistenceBps,
  };
}

function reconcilePayrollFsp(
  ibc: number,
  totalBps: number,
  concepts: PilaFspPayrollConceptSource[],
  expectedTotal: number,
): number | null {
  if (totalBps === 0) {
    return concepts.length === 0 && expectedTotal === 0 ? 0 : null;
  }
  if (concepts.length !== 1) return null;

  const [concept] = concepts;
  const expectedFactor = totalBps / 10_000;
  if (
    concept.tipo !== 'DEDUCTION' ||
    concept.base !== ibc ||
    concept.factor === null ||
    Math.abs(concept.factor - expectedFactor) >= 1e-9 ||
    !Number.isSafeInteger(concept.valor) ||
    concept.valor < 0 ||
    concept.valor !== Math.round((ibc * totalBps) / 10_000) ||
    concept.valor !== expectedTotal
  ) {
    return null;
  }
  return concept.valor;
}

function roundUpToHundred(base: number, factorBps: number): number | null {
  if (
    !Number.isSafeInteger(base) ||
    base < 0 ||
    !Number.isSafeInteger(factorBps) ||
    factorBps < 0
  ) {
    return null;
  }
  const amount =
    ((BigInt(base) * BigInt(factorBps) + 1_000_000n - 1n) / 1_000_000n) * 100n;
  return amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : null;
}

function safePositiveInteger(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value > 0;
}

function isCalendarDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
