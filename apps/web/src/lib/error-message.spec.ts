import { getApiErrorMessage, getUserFacingError } from './error-message';

describe('error-message', () => {
  it('joins validation messages returned by the API', () => {
    expect(
      getApiErrorMessage(
        { message: ['El código es obligatorio.', 'El nombre es obligatorio.'] },
        'No se pudo guardar.',
      ),
    ).toBe('El código es obligatorio. El nombre es obligatorio.');
  });

  it('uses an actionable fallback for generic server responses', () => {
    expect(getApiErrorMessage({ message: 'Internal server error' }, 'Intenta de nuevo.')).toBe(
      'Intenta de nuevo.',
    );
    expect(getUserFacingError(new Error(''), 'Revisa la conexión.')).toBe('Revisa la conexión.');
  });

  it('preserves a domain message when it is available', () => {
    expect(
      getUserFacingError(
        new Error(
          'Ya existe un empleado inactivo con este documento. Por favor, reactive el empleado.',
        ),
        'No se pudo crear el empleado.',
      ),
    ).toContain('reactive el empleado');
  });
});
