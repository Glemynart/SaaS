import { employeeSchema } from './employee-schemas';

describe('employeeSchema PEP-TUTOR identity', () => {
  const validEmployee = {
    tipoDocumento: 'PC',
    cedula: '12345678',
    primerNombre: 'Ana',
    primerApellido: 'Gómez',
    email: '',
    telefono: '',
    cargo: 'Docente',
    salario: 2_500_000,
    tipoContrato: 'TERMINO_FIJO',
    fechaIngreso: '2026-01-01',
    sedeId: 'sede-a',
    tipoSalarioPila: 'F',
  };

  it.each(['1234567', '12345678'])('accepts a PC number with %s digits', (cedula) => {
    expect(employeeSchema.safeParse({ ...validEmployee, cedula }).success).toBe(true);
  });

  it.each(['123456', '123456789', '1234567A'])('rejects a malformed PC number %s', (cedula) => {
    const result = employeeSchema.safeParse({ ...validEmployee, cedula });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['cedula'],
          message: 'El número PEP-TUTOR debe contener 7 u 8 dígitos.',
        }),
      );
    }
  });
});
