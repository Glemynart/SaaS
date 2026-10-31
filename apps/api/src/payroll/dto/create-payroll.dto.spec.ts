import { validateSync } from 'class-validator';
import { CreatePayrollPeriodDto } from './create-payroll.dto';

function makePeriodDto(fechaPrevistaPagoPila: string | null) {
  return Object.assign(new CreatePayrollPeriodDto(), {
    nombre: 'Nómina de noviembre 2026',
    fechaInicio: '2026-11-01',
    fechaFin: '2026-11-30',
    fechaPrevistaPagoPila,
  });
}

describe('CreatePayrollPeriodDto.fechaPrevistaPagoPila', () => {
  it('acepta una fecha calendario ISO válida', () => {
    expect(validateSync(makePeriodDto('2026-12-05'))).toHaveLength(0);
  });

  it('rechaza timestamps porque el campo es una fecha calendario', () => {
    const errors = validateSync(makePeriodDto('2026-12-05T23:00:00-05:00'));

    expect(
      errors.some((error) => error.property === 'fechaPrevistaPagoPila'),
    ).toBe(true);
  });

  it('rechaza fechas ISO imposibles', () => {
    const errors = validateSync(makePeriodDto('2026-02-30'));

    expect(
      errors.some((error) => error.property === 'fechaPrevistaPagoPila'),
    ).toBe(true);
  });

  it('permite omitir la fecha mientras el período aún no la conozca', () => {
    const dto = makePeriodDto(null);

    expect(validateSync(dto)).toHaveLength(0);
  });
});
