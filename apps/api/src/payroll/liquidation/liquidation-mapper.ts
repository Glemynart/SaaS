/**
 * liquidation-mapper.ts — Conversión de entidades Prisma a tipos del LiquidationCalculator.
 *
 * Contiene solo funciones puras: sin I/O, sin NestJS, sin efectos.
 * El servicio llama estas funciones para preparar los inputs del calculator
 * y construir los datos de persistencia a partir del resultado.
 *
 * CONVENCIÓN CRÍTICA (documentada en N2D.1.1):
 *   Empleado.fechaRetiro (BD)           = último día trabajado, INCLUSIVO.
 *   LiquidationInput.fechaRetiro        = primer día NO trabajado, EXCLUSIVO.
 *
 *   El mapper aplica addDays(fechaRetiro, +1) para traducir entre semánticas.
 *   El calculator no se modifica; el mapper absorbe la diferencia.
 */

import { Prisma } from '@prisma/client';
import { diasComerciales } from './liquidation-calculator';
import { LiquidationInput, LiquidationResult } from './liquidation-types';

// ── Tipo mínimo del empleado que necesita el mapper ──────────────────────────

export interface EmpForLiquidation {
  id: string;
  salario: Prisma.Decimal;
  salarioIntegral: boolean;
  fechaIngreso: Date;
}

// ── Helper de fecha ──────────────────────────────────────────────────────────

/**
 * Suma `n` días calendario a `date` respetando UTC.
 * Usado exclusivamente para convertir `fechaRetiro` (último día trabajado,
 * inclusivo en la BD) al extremo exclusivo que espera el LiquidationCalculator.
 */
export function addDays(date: Date, n: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + n);
  return result;
}

// ── Construcción del LiquidationInput ────────────────────────────────────────

export interface BuildLiquidationInputResult {
  input: LiquidationInput;
  /** Días comerciales (30/360) liquidados; se persiste en Liquidation.diasLiquidados. */
  diasLiquidados: number;
}

/**
 * Construye el input del LiquidationCalculator y calcula los días comerciales.
 *
 * @param emp                - Datos mínimos del empleado.
 * @param fechaRetiroDb      - Último día trabajado (inclusivo) leído desde la BD.
 *                            null → lanza error; el servicio valida antes de llegar aquí.
 * @param diasSalarioPendiente - Días de salario no cubiertos por el run del mes de retiro.
 *                            N2D.4 los resolverá; por ahora el servicio pasa 0.
 */
export function buildLiquidationInput(
  emp: EmpForLiquidation,
  fechaRetiroDb: Date | null,
  diasSalarioPendiente: number = 0,
): BuildLiquidationInputResult {
  if (fechaRetiroDb === null) {
    throw new Error(
      `Empleado ${emp.id}: fechaRetiro no registrada. ` +
        'Registre la fecha de retiro antes de generar la liquidación.',
    );
  }

  // Último día trabajado (incl.) + 1 día = primer día no trabajado (excl.)
  const fechaFinExclusiva = addDays(fechaRetiroDb, 1);
  const diasLiquidados = diasComerciales(emp.fechaIngreso, fechaFinExclusiva);

  const input: LiquidationInput = {
    salarioBase: Number(emp.salario),
    salarioIntegral: emp.salarioIntegral,
    fechaIngreso: emp.fechaIngreso,
    fechaRetiro: fechaFinExclusiva,
    diasSalarioPendiente,
  };

  return { input, diasLiquidados };
}

// ── Construcción del payload de persistencia ─────────────────────────────────

/**
 * Construye el payload para `prisma.liquidation.create({ data: ... })`.
 * Todos los valores monetarios provienen del calculator — no se recalcula nada.
 *
 * totalProvisiones = 0 en N2D.1: todos los conceptos del calculator son EARNING.
 * Cuando N2D añada conceptos de tipo PROVISION, este helper deberá actualizarse.
 *
 * @param fechaRetiro - Último día trabajado (inclusivo), se persiste para display.
 */
export function buildLiquidationCreateData(
  tenantId: string,
  empleadoId: string,
  fechaRetiro: Date,
  diasLiquidados: number,
  result: LiquidationResult,
) {
  return {
    tenantId,
    empleadoId,
    fechaRetiro,
    status: 'DRAFT' as const,
    diasLiquidados,
    totalDevengado: result.totalLiquidacion,
    totalProvisiones: 0,
    totalLiquidacion: result.totalLiquidacion,
    concepts: {
      create: result.conceptos.map((c) => ({
        codigo: c.codigo,
        nombre: c.nombre,
        tipo: 'EARNING' as const,
        base: c.base,
        factor: c.factor,
        valor: c.valor,
      })),
    },
  };
}
