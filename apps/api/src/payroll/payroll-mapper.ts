/**
 * payroll-mapper.ts — Conversión de entidades Prisma a tipos del PayrollCalculator.
 *
 * Contiene solo funciones puras: sin I/O, sin NestJS, sin efectos.
 * El servicio llama estas funciones para preparar los inputs del calculator.
 */

import { Prisma } from '@prisma/client';
import {
  ArlClase,
  FspTramo,
  LegalParamsSnapshot,
  NoveltyInput,
  PayrollCalculationInput,
} from './calculator/payroll-types';
import {
  functionalBlock,
  isFunctionalBlock,
  PayrollBlockCode,
  PayrollEvaluationResult,
  PayrollFunctionalBlock,
} from './payroll-evaluation';

// ── Tipos mínimos de entidades Prisma que necesita el mapper ─────────────────

export interface EmpForPayroll {
  id: string;
  salario: Prisma.Decimal;
  salarioIntegral: boolean;
  fechaIngreso?: Date | null;
  fechaRetiro?: Date | null;
}

export interface ContratoForPayroll {
  id: string;
  empleadoId: string;
  tipo: string;
  /** ContratoEstado es subtype de string → asignable aquí. */
  estado: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  sedeId: string | null;
  salario: Prisma.Decimal;
  claseRiesgoArl: number | null;
}

/** Campos del modelo ParametroLegalNomina que usa el mapper. */
export interface ParamLegalForPayroll {
  id: string;
  smmlv: Prisma.Decimal;
  auxilioTransporte: Prisma.Decimal;
  topeIbcMinSmmlv: number;
  topeIbcMaxSmmlv: number;
  umbralAuxilioSmmlv: Prisma.Decimal;
  umbralExoneracionSmmlv: number;
  pctSaludEmpleado: Prisma.Decimal;
  pctPensionEmpleado: Prisma.Decimal;
  pctSaludEmpleador: Prisma.Decimal;
  pctPensionEmpleador: Prisma.Decimal;
  pctCaja: Prisma.Decimal;
  pctIcbf: Prisma.Decimal;
  pctSena: Prisma.Decimal;
  arlClaseI: Prisma.Decimal;
  arlClaseII: Prisma.Decimal;
  arlClaseIII: Prisma.Decimal;
  arlClaseIV: Prisma.Decimal;
  arlClaseV: Prisma.Decimal;
  factorProvPrima: Prisma.Decimal;
  factorProvCesantias: Prisma.Decimal;
  factorProvIntCesantias: Prisma.Decimal;
  factorProvVacaciones: Prisma.Decimal;
  fspTramos: Prisma.JsonValue;
}

// ── ParametroLegalNomina → LegalParamsSnapshot ───────────────────────────────

/** Convierte la fila de DB a snapshot plano de números que consume el calculator. */
export function toSnapshot(p: ParamLegalForPayroll): LegalParamsSnapshot {
  return {
    smmlv: Number(p.smmlv),
    auxilioTransporte: Number(p.auxilioTransporte),
    topeIbcMinSmmlv: p.topeIbcMinSmmlv,
    topeIbcMaxSmmlv: p.topeIbcMaxSmmlv,
    umbralAuxilioSmmlv: Number(p.umbralAuxilioSmmlv),
    umbralExoneracionSmmlv: p.umbralExoneracionSmmlv,
    pctSaludEmpleado: Number(p.pctSaludEmpleado),
    pctPensionEmpleado: Number(p.pctPensionEmpleado),
    pctSaludEmpleador: Number(p.pctSaludEmpleador),
    pctPensionEmpleador: Number(p.pctPensionEmpleador),
    pctCaja: Number(p.pctCaja),
    pctIcbf: Number(p.pctIcbf),
    pctSena: Number(p.pctSena),
    arlPorClase: {
      1: Number(p.arlClaseI),
      2: Number(p.arlClaseII),
      3: Number(p.arlClaseIII),
      4: Number(p.arlClaseIV),
      5: Number(p.arlClaseV),
    },
    factorProvPrima: Number(p.factorProvPrima),
    factorProvCesantias: Number(p.factorProvCesantias),
    factorProvIntCesantias: Number(p.factorProvIntCesantias),
    factorProvVacaciones: Number(p.factorProvVacaciones),
    fspTramos: p.fspTramos as unknown as FspTramo[],
  };
}

// ── Resolución de contrato ────────────────────────────────────────────────────

export interface ContratoResolution {
  contrato: ContratoForPayroll | null;
  /** true = no se encontró contrato VIGENTE que cubra el período; se usó fallback. */
  fallback: boolean;
}

/**
 * Selecciona el contrato correcto para liquidar un empleado en un período.
 * `contratos` debe estar ordenado por fechaInicio DESC (orden de la query).
 *
 * Prioridad:
 *  1. VIGENTE cuyo rango cubra periodStart — si hay varios, el más reciente.
 *  2. Fallback: el más reciente independientemente de estado.
 *  3. Sin contratos → { contrato: null, fallback: false }.
 */
export function resolveContrato(
  contratos: ContratoForPayroll[],
  periodStart: Date,
): ContratoResolution {
  const vigentes = contratos.filter(
    (c) =>
      c.estado === 'VIGENTE' &&
      c.fechaInicio <= periodStart &&
      (c.fechaFin === null || c.fechaFin >= periodStart),
  );

  if (vigentes.length > 0) {
    // Ya ordenados DESC → primero = más reciente fechaInicio
    return { contrato: vigentes[0], fallback: false };
  }

  if (contratos.length > 0) {
    return { contrato: contratos[0], fallback: true };
  }

  return { contrato: null, fallback: false };
}

/**
 * Resolves one active contract for an employee hired during a monthly period.
 * This narrow path requires one contract beginning on the recorded hire date
 * and covering the rest of the month. Other cases retain the original resolver.
 */
export function resolveContratoForPayrollPeriod(
  contratos: ContratoForPayroll[],
  periodStart: Date,
  periodEnd: Date,
  employeeEntryDate: Date | null | undefined,
  employeeRetirementDate?: Date | null,
): ContratoResolution {
  const retirementDate = employeeRetirementDate
    ? calendarDate(employeeRetirementDate)
    : null;
  const periodStartForRetirement = calendarDate(periodStart);
  const periodEndForRetirement = calendarDate(periodEnd);
  const entryDateForRetirement = employeeEntryDate
    ? calendarDate(employeeEntryDate)
    : null;
  if (
    retirementDate &&
    periodStartForRetirement &&
    periodEndForRetirement &&
    entryDateForRetirement &&
    entryDateForRetirement <= periodStartForRetirement &&
    retirementDate >= periodStartForRetirement &&
    retirementDate <= periodEndForRetirement
  ) {
    const matchingRetirementContracts = contratos.filter((contract) => {
      const contractStart = calendarDate(contract.fechaInicio);
      return (
        contract.estado === 'TERMINADO' &&
        contractStart !== null &&
        contractStart <= periodStartForRetirement &&
        contract.fechaFin !== null &&
        calendarDate(contract.fechaFin) === retirementDate
      );
    });
    if (matchingRetirementContracts.length === 1) {
      return { contrato: matchingRetirementContracts[0], fallback: false };
    }
    return {
      contrato: contratos[0] ?? null,
      fallback: contratos.length > 0,
    };
  }

  const entryDate = employeeEntryDate ? calendarDate(employeeEntryDate) : null;
  const periodStartDate = calendarDate(periodStart);
  const periodEndDate = calendarDate(periodEnd);
  if (!entryDate || !periodStartDate || !periodEndDate) {
    return resolveContrato(contratos, periodStart);
  }
  if (entryDate <= periodStartDate) {
    return resolveContrato(contratos, periodStart);
  }
  if (entryDate > periodEndDate) {
    return {
      contrato: contratos[0] ?? null,
      fallback: contratos.length > 0,
    };
  }

  const overlapping = contratos.filter((contract) => {
    const contractStart = calendarDate(contract.fechaInicio);
    const contractEnd = contract.fechaFin
      ? calendarDate(contract.fechaFin)
      : null;
    return (
      contract.estado === 'VIGENTE' &&
      contractStart !== null &&
      contractStart <= periodEndDate &&
      (contract.fechaFin === null ||
        (contractEnd !== null && contractEnd >= periodStartDate))
    );
  });
  const matchingStart = overlapping[0]
    ? calendarDate(overlapping[0].fechaInicio)
    : null;
  const matchingContract = overlapping[0];
  const matchingEnd = matchingContract?.fechaFin
    ? calendarDate(matchingContract.fechaFin)
    : null;
  const matching =
    overlapping.length === 1 &&
    matchingContract !== undefined &&
    matchingStart === entryDate &&
    (matchingContract.fechaFin === null ||
      (matchingEnd !== null && matchingEnd >= periodEndDate))
      ? matchingContract
      : null;

  if (matching) return { contrato: matching, fallback: false };
  return {
    contrato: contratos[0] ?? null,
    fallback: contratos.length > 0,
  };
}

// ── Resolución de clase ARL ───────────────────────────────────────────────────

export interface ArlResolution {
  clase: ArlClase;
  /** true = el valor original era inválido (null, 0, fuera de rango); se usó clase I. */
  warned: boolean;
}

/** Valida clase ARL 1–5. null, 0 o fuera de rango → clase I con advertencia. */
export function resolveClaseArl(rawClase: number | null): ArlResolution {
  if (
    rawClase !== null &&
    Number.isInteger(rawClase) &&
    rawClase >= 1 &&
    rawClase <= 5
  ) {
    return { clase: rawClase as ArlClase, warned: false };
  }
  return { clase: 1, warned: true };
}

// ── Construcción del PayrollCalculationInput ─────────────────────────────────

export interface BuildInputResult {
  input: PayrollCalculationInput;
  /** Advertencias generadas en la resolución de datos (no son del calculator). */
  evaluations: PayrollEvaluationResult[];
  blocks: PayrollFunctionalBlock[];
  serviceWarnings: string[];
}

/**
 * Compone el input del calculator a partir de entidades ya resueltas.
 * Emite advertencias de servicio para:
 *  - Clase ARL inválida → asignada a I
 *  - Divergencia entre Empleado.salario y Contrato.salario
 */
export function buildCalculationInput(
  emp: EmpForPayroll,
  contrato: ContratoForPayroll | null,
  novelties: Array<{ tipo: string; valor: Prisma.Decimal | null }>,
  aportesExonerados: boolean,
  legalParams: LegalParamsSnapshot,
  diasNomina = 30,
): BuildInputResult {
  const evaluations: PayrollEvaluationResult[] = [];
  const serviceWarnings: string[] = [];

  const { clase: claseRiesgoArl, warned: arlWarned } = resolveClaseArl(
    contrato?.claseRiesgoArl ?? null,
  );
  if (contrato && arlWarned) {
    const raw = contrato?.claseRiesgoArl ?? null;
    const context =
      contrato === null
        ? 'sin contrato'
        : raw === null
          ? 'clase no especificada en contrato'
          : `valor inválido: ${raw}`;
    serviceWarnings.push(`Clase ARL inválida (${context}): asignando clase I`);
  }

  if (contrato && arlWarned) {
    const raw = contrato.claseRiesgoArl;
    const context =
      raw === null
        ? 'clase no especificada en contrato'
        : `valor invalido: ${raw}`;
    evaluations.push(
      functionalBlock(
        PayrollBlockCode.INVALID_ARL_CLASS,
        `Clase ARL invalida (${context}): no se puede liquidar con correccion garantizada`,
      ),
    );
  }

  if (emp.salarioIntegral) {
    evaluations.push(
      functionalBlock(
        PayrollBlockCode.UNSUPPORTED_INTEGRAL_SALARY,
        'Salario integral fuera de v1: no se puede liquidar con correccion garantizada',
      ),
    );
  }

  if (contrato) {
    const empSalario = Number(emp.salario);
    const contratoSalario = Number(contrato.salario);
    if (Math.abs(empSalario - contratoSalario) > 1) {
      evaluations.push(
        functionalBlock(
          PayrollBlockCode.MATERIAL_SALARY_MISMATCH,
          `Divergencia salarial: empleado=${empSalario} vs contrato=${contratoSalario}; no se puede liquidar con correccion garantizada`,
        ),
      );
      serviceWarnings.push(
        `Divergencia salarial: empleado=${empSalario} vs contrato=${contratoSalario}; usando empleado.salario`,
      );
    }
  }

  const input: PayrollCalculationInput = {
    salarioBase: Number(emp.salario),
    diasNomina,
    salarioIntegral: emp.salarioIntegral,
    claseRiesgoArl,
    aportesExonerados,
    legalParams,
    novelties: novelties.map(
      (n): NoveltyInput => ({ tipo: n.tipo, valor: Number(n.valor ?? 0) }),
    ),
  };

  const blocks = evaluations.filter(isFunctionalBlock);

  return { input, evaluations, blocks, serviceWarnings };
}

function calendarDate(value: Date): string | null {
  if (Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
}
