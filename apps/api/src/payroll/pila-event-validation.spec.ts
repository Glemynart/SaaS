import { PilaEventCode, PilaVacLrSubtype } from '@prisma/client';
import {
  parsePilaCalendarDate,
  validatePilaEventDateRange,
} from './pila-event-validation';

const period = {
  fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
  fechaFin: new Date('2026-10-31T00:00:00.000Z'),
};

describe('PILA event validation', () => {
  it('accepts real calendar dates and rejects impossible dates', () => {
    expect(parsePilaCalendarDate('2024-02-29')?.toISOString()).toBe(
      '2024-02-29T00:00:00.000Z',
    );
    expect(parsePilaCalendarDate('2026-02-29')).toBeNull();
    expect(parsePilaCalendarDate('2026-2-09')).toBeNull();
  });

  it('requires a complete interval for disability events and allows overlap across a month', () => {
    expect(
      validatePilaEventDateRange(
        { codigo: PilaEventCode.IGE, fechaInicio: '2026-10-30' },
        period,
      ),
    ).toBe('La novedad IGE requiere fecha final.');

    expect(
      validatePilaEventDateRange(
        {
          codigo: PilaEventCode.IGE,
          fechaInicio: '2026-10-30',
          fechaFin: '2026-11-03',
        },
        period,
      ),
    ).toBeNull();
  });

  it('requires single-date events to fall inside the payroll period', () => {
    expect(
      validatePilaEventDateRange(
        { codigo: PilaEventCode.ING, fechaInicio: '2026-09-30' },
        period,
      ),
    ).toBe('La novedad debe ocurrir dentro del período de nómina.');

    expect(
      validatePilaEventDateRange(
        {
          codigo: PilaEventCode.RET,
          fechaInicio: '2026-10-31',
          fechaFin: '2026-10-31',
        },
        period,
      ),
    ).toBe('La novedad RET solo admite una fecha.');
  });

  it('allows VCT start and optional end dates', () => {
    expect(
      validatePilaEventDateRange(
        { codigo: PilaEventCode.VCT, fechaInicio: '2026-10-10' },
        period,
      ),
    ).toBeNull();
    expect(
      validatePilaEventDateRange(
        {
          codigo: PilaEventCode.VCT,
          fechaInicio: '2026-10-10',
          fechaFin: '2026-10-11',
        },
        period,
      ),
    ).toBeNull();
  });

  it('requires a VAC-LR subtype and rejects it for other event codes', () => {
    expect(
      validatePilaEventDateRange(
        {
          codigo: PilaEventCode.VAC_LR,
          fechaInicio: '2026-10-10',
          fechaFin: '2026-10-12',
        },
        period,
      ),
    ).toContain('VAC-LR requiere indicar');

    expect(
      validatePilaEventDateRange(
        {
          codigo: PilaEventCode.VAC_LR,
          subtipo: PilaVacLrSubtype.VACACIONES_DISFRUTADAS,
          fechaInicio: '2026-10-10',
          fechaFin: '2026-10-12',
        },
        period,
      ),
    ).toBeNull();

    expect(
      validatePilaEventDateRange(
        {
          codigo: PilaEventCode.ING,
          subtipo: PilaVacLrSubtype.LICENCIA_REMUNERADA,
          fechaInicio: '2026-10-10',
        },
        period,
      ),
    ).toContain('solo se admite para la novedad VAC-LR');
  });

  it('requires explicit IRL days and rejects day counts for other events', () => {
    expect(
      validatePilaEventDateRange(
        {
          codigo: PilaEventCode.IRL,
          fechaInicio: '2026-10-10',
          fechaFin: '2026-10-10',
        },
        period,
      ),
    ).toBe('IRL requiere informar entre 1 y 30 días.');

    expect(
      validatePilaEventDateRange(
        {
          codigo: PilaEventCode.IRL,
          fechaInicio: '2026-10-10',
          fechaFin: '2026-10-10',
          dias: 1,
        },
        period,
      ),
    ).toBeNull();

    expect(
      validatePilaEventDateRange(
        {
          codigo: PilaEventCode.ING,
          fechaInicio: '2026-10-10',
          dias: 1,
        },
        period,
      ),
    ).toBe('Solo la novedad IRL admite informar días.');
  });
});
