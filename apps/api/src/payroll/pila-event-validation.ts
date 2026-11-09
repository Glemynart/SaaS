import { PilaEventCode, PilaVacLrSubtype } from '@prisma/client';

export type PilaEventDateInput = {
  codigo: PilaEventCode;
  subtipo?: PilaVacLrSubtype;
  fechaInicio: string;
  fechaFin?: string;
  dias?: number;
};

export function parsePilaCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return parsed;
}

export function validatePilaEventDateRange(
  input: PilaEventDateInput,
  period: { fechaInicio: Date; fechaFin: Date },
): string | null {
  if (input.codigo === PilaEventCode.VAC_LR && !input.subtipo) {
    return 'La novedad VAC-LR requiere indicar si corresponde a vacaciones disfrutadas o licencia remunerada.';
  }
  if (input.codigo !== PilaEventCode.VAC_LR && input.subtipo !== undefined) {
    return 'El subtipo solo se admite para la novedad VAC-LR.';
  }

  const eventStart = parsePilaCalendarDate(input.fechaInicio);
  if (!eventStart) return 'La fecha inicial debe ser un día calendario válido.';

  const periodStart = calendarDate(period.fechaInicio);
  const periodEnd = calendarDate(period.fechaFin);
  if (!periodStart || !periodEnd || periodStart > periodEnd) {
    return 'El período de nómina no tiene un rango calendario válido.';
  }

  const rangeCodes = new Set<PilaEventCode>([
    PilaEventCode.SLN,
    PilaEventCode.IGE,
    PilaEventCode.LMA,
    PilaEventCode.VAC_LR,
    PilaEventCode.IRL,
    PilaEventCode.VCT,
  ]);
  const requiresEndDate = new Set<PilaEventCode>([
    PilaEventCode.SLN,
    PilaEventCode.IGE,
    PilaEventCode.LMA,
    PilaEventCode.VAC_LR,
    PilaEventCode.IRL,
  ]);

  if (requiresEndDate.has(input.codigo) && !input.fechaFin) {
    return `La novedad ${input.codigo} requiere fecha final.`;
  }
  if (input.fechaFin && !rangeCodes.has(input.codigo)) {
    return `La novedad ${input.codigo} solo admite una fecha.`;
  }

  const eventEnd = input.fechaFin
    ? parsePilaCalendarDate(input.fechaFin)
    : eventStart;
  if (!eventEnd) return 'La fecha final debe ser un día calendario válido.';
  if (eventEnd < eventStart) {
    return 'La fecha final no puede ser anterior a la fecha inicial.';
  }

  const overlapsPeriod = eventStart <= periodEnd && eventEnd >= periodStart;
  if (!overlapsPeriod) {
    return 'La novedad debe ocurrir dentro del período de nómina.';
  }
  if (
    !rangeCodes.has(input.codigo) &&
    (eventStart < periodStart || eventStart > periodEnd)
  ) {
    return 'La fecha de la novedad debe estar dentro del período de nómina.';
  }

  if (input.codigo === PilaEventCode.IRL) {
    if (!Number.isInteger(input.dias) || input.dias! < 1 || input.dias! > 30) {
      return 'IRL requiere informar entre 1 y 30 días.';
    }
  } else if (input.dias !== undefined) {
    return 'Solo la novedad IRL admite informar días.';
  }

  return null;
}

function calendarDate(value: Date): Date | null {
  if (Number.isNaN(value.getTime())) return null;
  return parsePilaCalendarDate(value.toISOString().slice(0, 10));
}
