export type NumberingRangeOperationalStatus =
  | 'INACTIVO'
  | 'AGOTADO'
  | 'FUTURO'
  | 'VENCIDO'
  | 'VIGENTE';

export function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error('La fecha debe ser válida y tener formato AAAA-MM-DD.');
  }
  return date;
}

/** Add calendar years and clamp leap-day anniversaries to the last day of February. */
export function addCalendarYears(date: Date, years: number): Date {
  const result = new Date(date);
  const month = result.getUTCMonth();
  result.setUTCFullYear(result.getUTCFullYear() + years);
  if (result.getUTCMonth() !== month) result.setUTCDate(0);
  return result;
}

export function getNumberingRangeStatus(
  range: {
    estado: 'ACTIVO' | 'INACTIVO';
    vigenciaDesde: Date;
    vigenciaHasta: Date;
    numeroHasta: number;
    ultimoNumeroAsignado: number;
  },
  at = new Date(),
): NumberingRangeOperationalStatus {
  if (range.estado === 'INACTIVO') return 'INACTIVO';
  if (range.ultimoNumeroAsignado >= range.numeroHasta) return 'AGOTADO';

  const today = at.toISOString().slice(0, 10);
  if (range.vigenciaDesde.toISOString().slice(0, 10) > today) return 'FUTURO';
  if (range.vigenciaHasta.toISOString().slice(0, 10) < today) return 'VENCIDO';
  return 'VIGENTE';
}
