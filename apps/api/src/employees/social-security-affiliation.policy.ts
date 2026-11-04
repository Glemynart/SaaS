export const SOCIAL_SECURITY_AFFILIATION_CAPTURE_VERSION =
  'PILA_AFFILIATION_CAPTURE_V4';

export function isSupportedPilaDependentContract(
  tipoContrato: string | null | undefined,
): boolean {
  return (
    tipoContrato === 'TERMINO_FIJO' ||
    tipoContrato === 'TERMINO_INDEFINIDO' ||
    tipoContrato === 'OBRA_LABOR'
  );
}

export interface PilaAffiliationDeclarations {
  extranjeroNoObligadoPension: boolean | null;
  colombianoEnElExterior: boolean | null;
}

export interface PilaAffiliationDeclarationError {
  field: keyof PilaAffiliationDeclarations;
  message: string;
}

export function validatePilaAffiliationDeclarations(
  tipoDocumento: string,
  declarations: PilaAffiliationDeclarations,
): PilaAffiliationDeclarationError[] {
  const errors: PilaAffiliationDeclarationError[] = [];
  const foreignPensionExemption = declarations.extranjeroNoObligadoPension;
  const colombianAbroad = declarations.colombianoEnElExterior;

  if (tipoDocumento === 'CC' || tipoDocumento === 'TI') {
    if (typeof colombianAbroad !== 'boolean') {
      errors.push({
        field: 'colombianoEnElExterior',
        message: 'Confirma si el cotizante colombiano reside en el exterior.',
      });
    }
    if (foreignPensionExemption !== null) {
      errors.push({
        field: 'extranjeroNoObligadoPension',
        message:
          'La exención pensional del extranjero no aplica a documentos CC/TI.',
      });
    }
    return errors;
  }

  if (tipoDocumento === 'CE' || tipoDocumento === 'PA') {
    if (typeof foreignPensionExemption !== 'boolean') {
      errors.push({
        field: 'extranjeroNoObligadoPension',
        message:
          'Confirma si el cotizante extranjero está exento de cotizar a pensión.',
      });
    }
    if (colombianAbroad !== null) {
      errors.push({
        field: 'colombianoEnElExterior',
        message:
          'La declaración de colombiano en el exterior no aplica a documentos CE/PA.',
      });
    }
    return errors;
  }

  if (foreignPensionExemption !== null || colombianAbroad !== null) {
    errors.push({
      field:
        foreignPensionExemption !== null
          ? 'extranjeroNoObligadoPension'
          : 'colombianoEnElExterior',
      message:
        'Las declaraciones de los campos 7 y 8 de AT2 v30 solo aplican a documentos CC, TI, CE o PA.',
    });
  }

  return errors;
}
