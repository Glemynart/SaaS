import { validate } from 'class-validator';
import {
  TipoDocIdentidad as PrismaTipoDocIdentidad,
  TipoPersona,
} from '@prisma/client';
import { CreateTerceroDto } from '../../accounting/terceros/dto/create-tercero.dto';
import {
  CreateEmployeeDto,
  TipoDocIdentidad as EmployeeTipoDocIdentidad,
} from '../../employees/dto/create-employee.dto';
import { UpdateEmployeeDto } from '../../employees/dto/update-employee.dto';

const CONSTRAINT = 'pepTutorDocumentNumber';

async function constraintMessage(
  target: object,
  property: string,
): Promise<string | undefined> {
  const errors = await validate(target);
  return errors.find((error) => error.property === property)?.constraints?.[
    CONSTRAINT
  ];
}

describe('PEP-TUTOR document number validation', () => {
  it.each(['1234567', '12345678'])(
    'accepts an employee PC number with %s digits',
    async (number) => {
      const dto = Object.assign(new CreateEmployeeDto(), {
        tipoDocumento: EmployeeTipoDocIdentidad.PC,
        cedula: number,
      });

      await expect(constraintMessage(dto, 'cedula')).resolves.toBeUndefined();
    },
  );

  it.each(['123456', '123456789', '1234567A'])(
    'rejects malformed employee PC number %s',
    async (number) => {
      const dto = Object.assign(new CreateEmployeeDto(), {
        tipoDocumento: EmployeeTipoDocIdentidad.PC,
        cedula: number,
      });

      await expect(constraintMessage(dto, 'cedula')).resolves.toContain(
        '7 u 8 dígitos',
      );
    },
  );

  it('rejects a malformed PC identity in an employee update when both fields are sent', async () => {
    const dto = Object.assign(new UpdateEmployeeDto(), {
      tipoDocumento: EmployeeTipoDocIdentidad.PC,
      cedula: '123456789',
    });

    await expect(constraintMessage(dto, 'cedula')).resolves.toContain(
      '7 u 8 dígitos',
    );
  });

  it.each(['1234567', '12345678'])(
    'accepts a third party PC number with %s digits',
    async (number) => {
      const dto = Object.assign(new CreateTerceroDto(), {
        tipoDocumento: PrismaTipoDocIdentidad.PC,
        tipoPersona: TipoPersona.NATURAL,
        numeroDocumento: number,
      });

      await expect(
        constraintMessage(dto, 'numeroDocumento'),
      ).resolves.toBeUndefined();
    },
  );

  it.each(['123456', '123456789', '1234567A'])(
    'rejects malformed third party PC number %s',
    async (number) => {
      const dto = Object.assign(new CreateTerceroDto(), {
        tipoDocumento: PrismaTipoDocIdentidad.PC,
        tipoPersona: TipoPersona.NATURAL,
        numeroDocumento: number,
      });

      await expect(
        constraintMessage(dto, 'numeroDocumento'),
      ).resolves.toContain('7 u 8 dígitos');
    },
  );
});
