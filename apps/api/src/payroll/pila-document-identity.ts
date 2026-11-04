import { isValidPepTutorDocumentNumber } from '../common/validators/pep-tutor-document-number';

export const PILA_SUPPORTED_COTIZANTE_DOCUMENT_TYPES = new Set([
  'CC',
  'CE',
  'TI',
  'PA',
  'PC',
]);

export const PILA_SUPPORTED_EMPLOYER_DOCUMENT_TYPES = new Set([
  'NI',
  'CC',
  'CE',
  'TI',
  'PA',
  'CD',
  'SC',
  'PE',
  'PT',
  'PC',
]);

export const PILA_SUPPORTED_REPRESENTATIVE_DOCUMENT_TYPES = new Set([
  'CC',
  'CE',
  'PA',
  'CD',
]);

export function isValidPilaCotizanteIdentification(
  type: string,
  value: string,
): boolean {
  if (!PILA_SUPPORTED_COTIZANTE_DOCUMENT_TYPES.has(type)) return false;
  if (type === 'PC') return isValidPepTutorDocumentNumber(value);

  const numericMaxLength: Record<string, number> = {
    CC: 10,
    CE: 7,
    TI: 11,
  };
  const numericLimit = numericMaxLength[type];
  if (numericLimit !== undefined) {
    return new RegExp(`^\\d{1,${numericLimit}}$`).test(value);
  }

  return type === 'PA' && /^[A-Z0-9]{1,16}$/.test(value);
}

export function isValidPilaEmployerIdentification(
  type: string,
  value: string,
): boolean {
  if (!PILA_SUPPORTED_EMPLOYER_DOCUMENT_TYPES.has(type)) return false;
  if (type === 'PE') return /^\d{15}$/.test(value);

  const numericMaxLength: Record<string, number> = {
    CC: 10,
    CE: 7,
    TI: 11,
    NI: 11,
    SC: 8,
    PT: 8,
    PC: 8,
  };
  const numericLimit = numericMaxLength[type];
  if (numericLimit !== undefined) {
    return new RegExp(`^\\d{1,${numericLimit}}$`).test(value);
  }

  const alphanumericMaxLength: Record<string, number> = { PA: 16, CD: 11 };
  const alphanumericLimit = alphanumericMaxLength[type];
  return (
    alphanumericLimit !== undefined &&
    new RegExp(`^[A-Z0-9]{1,${alphanumericLimit}}$`).test(value)
  );
}

export function isValidPilaRepresentativeIdentification(
  type: string,
  value: string,
): boolean {
  if (!PILA_SUPPORTED_REPRESENTATIVE_DOCUMENT_TYPES.has(type)) return false;

  const numericMaxLength: Record<string, number> = { CC: 10, CE: 7 };
  const numericLimit = numericMaxLength[type];
  if (numericLimit !== undefined) {
    return new RegExp(`^\\d{1,${numericLimit}}$`).test(value);
  }

  const alphanumericMaxLength: Record<string, number> = { PA: 16, CD: 11 };
  const alphanumericLimit = alphanumericMaxLength[type];
  return (
    alphanumericLimit !== undefined &&
    new RegExp(`^[A-Z0-9]{1,${alphanumericLimit}}$`).test(value)
  );
}
