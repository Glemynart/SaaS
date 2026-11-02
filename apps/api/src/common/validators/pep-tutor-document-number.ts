import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export function isValidPepTutorDocumentNumber(value: unknown): value is string {
  return typeof value === 'string' && /^\d{7,8}$/.test(value);
}

@ValidatorConstraint({ name: 'pepTutorDocumentNumber', async: false })
export class PepTutorDocumentNumberConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const document = args.object as { tipoDocumento?: unknown };
    return (
      document.tipoDocumento !== 'PC' || isValidPepTutorDocumentNumber(value)
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} para PEP-TUTOR (PC) debe contener 7 u 8 dígitos.`;
  }
}
