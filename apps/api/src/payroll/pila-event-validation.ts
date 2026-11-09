import { PilaEventCode, PilaVacLrSubtype } from '@prisma/client';

export type PilaEventDateInput = {
  codigo: PilaEventCode;
  subtipo?: PilaVacLrSubtype;
  fechaInicio: string;
  fechaFin?: string;
  dias?: number;
  ultimoIbcReportado?: string | null;
  periodoIbcReportado?: string | null;
  operadorFuenteIbc?: string | null;
  referenciaFuenteIbc?: string | null;
  confirmoFuenteIbc?: boolean | null;
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

export function parsePilaYearMonth(
  value: string | null | undefined,
): Date | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  return parsePilaCalendarDate(`${value}-01`);
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

  const priorIbcFields = [
    input.ultimoIbcReportado,
    input.periodoIbcReportado,
    input.operadorFuenteIbc,
    input.referenciaFuenteIbc,
  ];
  const hasPriorIbcDeclaration = priorIbcFields.some(
    (value) => value !== undefined && value !== null,
  );
  if (hasPriorIbcDeclaration || input.confirmoFuenteIbc === true) {
    if (
      input.codigo !== PilaEventCode.VAC_LR ||
      input.subtipo !== PilaVacLrSubtype.VACACIONES_DISFRUTADAS
    ) {
      return 'El IBC previo declarado solo se admite para vacaciones disfrutadas (VAC-LR).';
    }

    const amount = input.ultimoIbcReportado;
    const month = input.periodoIbcReportado;
    const operator = input.operadorFuenteIbc?.trim();
    const reference = input.referenciaFuenteIbc?.trim();
    if (
      typeof amount !== 'string' ||
      !/^(?=.*[1-9])(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(amount) ||
      typeof month !== 'string' ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
      !operator ||
      operator.length > 80 ||
      !reference ||
      reference.length > 160 ||
      input.confirmoFuenteIbc !== true
    ) {
      return 'Para declarar el IBC previo, completa el valor, mes, operador y referencia, y confirma que los transcribiste de la fuente.';
    }
    if (month >= input.fechaInicio.slice(0, 7)) {
      return 'El período del último IBC reportado debe ser anterior al mes de inicio de las vacaciones.';
    }
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
