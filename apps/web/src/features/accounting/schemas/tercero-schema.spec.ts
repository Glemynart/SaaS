import { terceroSchema } from './accounting-configuration-schemas';

describe('terceroSchema PEP-TUTOR identity', () => {
  const validThirdParty = {
    tipoDocumento: 'PC',
    numeroDocumento: '12345678',
    tipoPersona: 'NATURAL',
    primerNombre: 'Ana',
    primerApellido: 'Gómez',
  };

  it.each(['1234567', '12345678'])('accepts a PC number with %s digits', (numeroDocumento) => {
    expect(terceroSchema.safeParse({ ...validThirdParty, numeroDocumento }).success).toBe(true);
  });

  it.each(['123456', '123456789', '1234567A'])(
    'rejects a malformed PC number %s',
    (numeroDocumento) => {
      const result = terceroSchema.safeParse({
        ...validThirdParty,
        numeroDocumento,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toContainEqual(
          expect.objectContaining({
            path: ['numeroDocumento'],
            message: 'El número PEP-TUTOR debe contener 7 u 8 dígitos.',
          }),
        );
      }
    },
  );
});
