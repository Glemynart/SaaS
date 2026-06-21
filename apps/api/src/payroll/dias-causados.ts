/**
 * resolveDiasCausados (N2C.1a) — utilidad pura para días causados.
 *
 * Resuelve cuántos días de un período causa un empleado según su vínculo
 * laboral (ingreso / retiro), en convención de mes comercial de 30 días.
 *
 * Alcance N2C.1a: SOLO ingreso y/o retiro dentro del período. NO modela
 * incapacidades, licencias, vacaciones ni suspensiones (fases N2C.2+).
 *
 * Pura: sin I/O, sin Prisma, sin estado. El servicio le pasa fechas ya
 * resueltas y consume el entero; el PayrollCalculator nunca ve fechas.
 *
 * Convención (mes comercial 30/360):
 *  - Todo mes vale 30 días.
 *  - El último día calendario del mes cuenta como día 30 ("regla del 30 de
 *    febrero"): un febrero completo causa 30, no 28.
 *  - Días 31 se tratan como 30.
 *  - fechaRetiro = último día laborado (inclusive).
 *  - Resultado: entero en [0, 30].
 */

const DIAS_MES_COMERCIAL = 30;

/** Normaliza a medianoche UTC: compara y cuenta solo por fecha, sin hora/zona. */
function toUtcDate(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/** Número de días calendario del mes (día 0 del mes siguiente). */
function diasEnMes(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/** Día comercial: último día del mes → 30; en otro caso min(día, 30). */
function diaComercial(d: Date): number {
  const day = d.getUTCDate();
  if (day >= diasEnMes(d.getUTCFullYear(), d.getUTCMonth())) {
    return DIAS_MES_COMERCIAL;
  }
  return Math.min(day, DIAS_MES_COMERCIAL);
}

/** Serial comercial: cada mes aporta 30 días, para diferencias entre meses. */
function serialComercial(d: Date): number {
  const meses = d.getUTCFullYear() * 12 + d.getUTCMonth();
  return meses * DIAS_MES_COMERCIAL + diaComercial(d);
}

/**
 * Días causados por un empleado dentro de un período de nómina.
 *
 * @param fechaIngreso  Empleado.fechaIngreso (requerido).
 * @param fechaRetiro   Empleado.fechaRetiro (null = sin retiro).
 * @param periodInicio  PayrollPeriod.fechaInicio.
 * @param periodFin     PayrollPeriod.fechaFin.
 * @returns entero en [0, 30].
 */
export function resolveDiasCausados(
  fechaIngreso: Date,
  fechaRetiro: Date | null,
  periodInicio: Date,
  periodFin: Date,
): number {
  const ingreso = toUtcDate(fechaIngreso);
  const inicio = toUtcDate(periodInicio);
  const fin = toUtcDate(periodFin);
  const retiro = fechaRetiro ? toUtcDate(fechaRetiro) : null;

  // Recorta la ventana de causación a la intersección [ingreso, retiro] ∩ [inicio, fin].
  const inicioEfectivo =
    ingreso.getTime() > inicio.getTime() ? ingreso : inicio;
  const finEfectivo = retiro && retiro.getTime() < fin.getTime() ? retiro : fin;

  // Sin solapamiento: ingreso posterior al período, retiro previo, o datos
  // incoherentes (retiro antes del ingreso) → no causa nada.
  if (inicioEfectivo.getTime() > finEfectivo.getTime()) return 0;

  const dias =
    serialComercial(finEfectivo) - serialComercial(inicioEfectivo) + 1;

  return Math.min(Math.max(dias, 0), DIAS_MES_COMERCIAL);
}
