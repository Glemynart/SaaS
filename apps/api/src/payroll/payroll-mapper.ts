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

// ── Tipos mínimos de entidades Prisma que necesita el mapper ─────────────────

export interface EmpForPayroll {
  id: string;
  salario: Prisma.Decimal;
  salarioIntegral: boolean;
}

export interface ContratoForPayroll {
  id: string;
  empleadoId: string;
  /** ContratoEstado es subtype de string → asignable aquí. */
  estado: string;
  fechaInicio: Date;
  fechaFin: Date | null;
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
): BuildInputResult {
  const serviceWarnings: string[] = [];

  const { clase: claseRiesgoArl, warned: arlWarned } = resolveClaseArl(
    contrato?.claseRiesgoArl ?? null,
  );
  if (arlWarned) {
    const raw = contrato?.claseRiesgoArl ?? null;
    const context =
      contrato === null
        ? 'sin contrato'
        : raw === null
          ? 'clase no especificada en contrato'
          : `valor inválido: ${raw}`;
    serviceWarnings.push(`Clase ARL inválida (${context}): asignando clase I`);
  }

  if (contrato) {
    const empSalario = Number(emp.salario);
    const contratoSalario = Number(contrato.salario);
    if (Math.abs(empSalario - contratoSalario) > 1) {
      serviceWarnings.push(
        `Divergencia salarial: empleado=${empSalario} vs contrato=${contratoSalario}; usando empleado.salario`,
      );
    }
  }

  const input: PayrollCalculationInput = {
    salarioBase: Number(emp.salario),
    salarioIntegral: emp.salarioIntegral,
    claseRiesgoArl,
    aportesExonerados,
    legalParams,
    novelties: novelties.map(
      (n): NoveltyInput => ({ tipo: n.tipo, valor: Number(n.valor ?? 0) }),
    ),
  };

  return { input, serviceWarnings };
}
