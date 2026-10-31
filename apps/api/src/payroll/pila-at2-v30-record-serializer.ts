/**
 * Character-level fixed-width formatting for the three AT2 v30 input records.
 *
 * Field widths and N/A kinds were transcribed from AT2 v30 (24-07-2026):
 * employer type 1, pp. 9-16; payroll header type 2, pp. 26-30; contributor
 * detail type 2, pp. 81-102. The official PDF SHA-256 is recorded in
 * docs/research/pila/AT2-V30-MVP-ACCEPTANCE-MATRIX.md.
 *
 * This module deliberately does not map PayrollSnapshot values, decide which
 * empty fields are valid, encode bytes, add file separators, or claim that a
 * record is accepted by any operator. Those checks belong to the versioned
 * mapping and operator-specific export flow.
 */

export const PILA_AT2_V30_FORMAT_VERSION = 'AT2_V30' as const;

export type PilaAt2V30FieldKind = 'A' | 'N';

export interface PilaAt2V30FieldLayout {
  readonly fieldNumber: number;
  readonly length: number;
  readonly kind: PilaAt2V30FieldKind;
  readonly numericFormat?: 'DECIMAL_FRACTION';
}

export interface PilaAt2V30RecordLayout {
  readonly formatVersion: typeof PILA_AT2_V30_FORMAT_VERSION;
  readonly recordLength: number;
  readonly fields: readonly PilaAt2V30FieldLayout[];
}

export const PILA_AT2_V30_RECORD_LAYOUTS = {
  employerType1: defineLayout(
    [
      [200, 'A'],
      [2, 'A'],
      [16, 'A'],
      [1, 'N'],
      [10, 'A'],
      [40, 'A'],
      [1, 'A'],
      [1, 'N'],
      [1, 'A'],
      [1, 'A'],
      [40, 'A'],
      [3, 'A'],
      [2, 'A'],
      [4, 'N'],
      [10, 'N'],
      [10, 'N'],
      [60, 'A'],
      [16, 'A'],
      [1, 'N'],
      [2, 'A'],
      [20, 'A'],
      [30, 'A'],
      [20, 'A'],
      [30, 'A'],
      [10, 'A'],
      [1, 'N'],
      [10, 'A'],
      [2, 'N'],
      [7, 'N'],
      [2, 'N'],
      [10, 'A'],
      [2, 'A'],
      [1, 'A'],
      [1, 'A'],
    ],
    567,
  ),
  payrollHeaderType2: defineLayout(
    [
      [2, 'N'],
      [1, 'N'],
      [4, 'N'],
      [200, 'A'],
      [2, 'A'],
      [16, 'A'],
      [1, 'N'],
      [1, 'A'],
      [10, 'N'],
      [10, 'A'],
      [1, 'A'],
      [10, 'A'],
      [40, 'A'],
      [6, 'A'],
      [7, 'A'],
      [7, 'A'],
      [10, 'N'],
      [10, 'A'],
      [5, 'N'],
      [12, 'N'],
      [2, 'N'],
      [2, 'N'],
    ],
    359,
  ),
  contributorDetailType2: defineLayout(
    [
      [2, 'N'],
      [5, 'N'],
      [2, 'A'],
      [16, 'A'],
      [2, 'N'],
      [2, 'N'],
      [1, 'A'],
      [1, 'A'],
      [2, 'A'],
      [3, 'A'],
      [20, 'A'],
      [30, 'A'],
      [20, 'A'],
      [30, 'A'],
      [1, 'A'],
      [1, 'A'],
      [1, 'A'],
      [1, 'A'],
      [1, 'A'],
      [1, 'A'],
      [1, 'A'],
      [1, 'A'],
      [1, 'A'],
      [1, 'A'],
      [1, 'A'],
      [1, 'A'],
      [1, 'A'],
      [1, 'A'],
      [1, 'A'],
      [2, 'N'],
      [6, 'A'],
      [6, 'A'],
      [6, 'A'],
      [6, 'A'],
      [6, 'A'],
      [2, 'N'],
      [2, 'N'],
      [2, 'N'],
      [2, 'N'],
      [9, 'N'],
      [1, 'A'],
      [9, 'N'],
      [9, 'N'],
      [9, 'N'],
      [9, 'N'],
      [7, 'N'],
      [9, 'N'],
      [9, 'N'],
      [9, 'N'],
      [9, 'N'],
      [9, 'N'],
      [9, 'N'],
      [9, 'N'],
      [7, 'N'],
      [9, 'N'],
      [9, 'N'],
      [15, 'A'],
      [9, 'N'],
      [15, 'A'],
      [9, 'N'],
      [9, 'N'],
      [9, 'N'],
      [9, 'N'],
      [7, 'N'],
      [9, 'N'],
      [7, 'N'],
      [9, 'N'],
      [7, 'N'],
      [9, 'N'],
      [7, 'N'],
      [9, 'N'],
      [7, 'N'],
      [9, 'N'],
      [2, 'A'],
      [16, 'A'],
      [1, 'A'],
      [6, 'A'],
      [1, 'A'],
      [1, 'A'],
      [10, 'A'],
      [10, 'A'],
      [10, 'A'],
      [10, 'A'],
      [10, 'A'],
      [10, 'A'],
      [10, 'A'],
      [10, 'A'],
      [10, 'A'],
      [10, 'A'],
      [10, 'A'],
      [10, 'A'],
      [10, 'A'],
      [10, 'A'],
      [10, 'A'],
      [9, 'N'],
      [3, 'N'],
      [10, 'A'],
      [7, 'N'],
    ],
    693,
    [46, 54, 61, 64, 66, 68],
  ),
} as const satisfies Record<string, PilaAt2V30RecordLayout>;

export type PilaAt2V30RecordKey = keyof typeof PILA_AT2_V30_RECORD_LAYOUTS;

export interface PilaAt2V30FieldInput {
  readonly value: string | number | null;
  /**
   * AT2 field semantics are owned by the mapper. A null value must explicitly
   * choose its representation instead of being silently defaulted here.
   */
  readonly emptyAs?: 'spaces' | 'zeros';
}

export type PilaAt2V30RecordValues = Readonly<
  Record<number, PilaAt2V30FieldInput>
>;

export class PilaAt2V30SerializationError extends Error {
  constructor(
    message: string,
    readonly fieldNumber?: number,
  ) {
    super(message);
    this.name = 'PilaAt2V30SerializationError';
  }
}

/**
 * Formats one AT2 v30 record as a fixed-width JavaScript string.
 * It does not encode the text as an operator-specific file.
 */
export function serializePilaAt2V30Record(
  record: PilaAt2V30RecordKey,
  values: PilaAt2V30RecordValues,
): string {
  const layout = PILA_AT2_V30_RECORD_LAYOUTS[record];
  const allowedFields = new Set(
    layout.fields.map(({ fieldNumber }) => fieldNumber),
  );

  for (const key of Object.keys(values)) {
    const fieldNumber = Number(key);
    if (!Number.isInteger(fieldNumber) || !allowedFields.has(fieldNumber)) {
      throw new PilaAt2V30SerializationError(
        `AT2 v30: el campo ${key} no pertenece al registro ${record}.`,
      );
    }
  }

  const output: string[] = [];
  for (const field of layout.fields) {
    if (!Object.prototype.hasOwnProperty.call(values, field.fieldNumber)) {
      throw new PilaAt2V30SerializationError(
        `AT2 v30: falta una decisión explícita para el campo ${field.fieldNumber}.`,
        field.fieldNumber,
      );
    }

    const input = values[field.fieldNumber];
    if (!input || typeof input !== 'object') {
      throw new PilaAt2V30SerializationError(
        `AT2 v30: el campo ${field.fieldNumber} no tiene un valor válido.`,
        field.fieldNumber,
      );
    }
    output.push(formatField(field, input));
  }

  const result = output.join('');
  if (Array.from(result).length !== layout.recordLength) {
    throw new PilaAt2V30SerializationError(
      `AT2 v30: la longitud resultante no coincide con ${layout.recordLength}.`,
    );
  }
  return result;
}

function formatField(
  field: PilaAt2V30FieldLayout,
  input: PilaAt2V30FieldInput,
): string {
  if (input.value === null) {
    if (input.emptyAs === 'spaces') return ' '.repeat(field.length);
    if (input.emptyAs === 'zeros' && field.kind === 'N') {
      return '0'.repeat(field.length);
    }
    throw fieldError(
      field,
      'un valor nulo necesita una representación vacía explícita válida',
    );
  }
  if (input.emptyAs !== undefined) {
    throw fieldError(field, 'no debe declarar emptyAs cuando el valor existe');
  }

  if (field.kind === 'N') {
    if (field.numericFormat === 'DECIMAL_FRACTION') {
      const decimalValue =
        typeof input.value === 'string' &&
        /^(?:0|[1-9]\d*)\.\d{1,7}$/.test(input.value)
          ? input.value
          : null;
      if (decimalValue === null) {
        throw fieldError(
          field,
          'requiere una fracción decimal con hasta siete posiciones decimales',
        );
      }
      if (decimalValue.length > field.length) {
        throw fieldError(
          field,
          'supera la longitud permitida de ' + field.length + ' posiciones',
        );
      }
      return decimalValue.padEnd(field.length, '0');
    }

    const numericValue =
      typeof input.value === 'number'
        ? Number.isSafeInteger(input.value) && input.value >= 0
          ? String(input.value)
          : null
        : typeof input.value === 'string' && /^\d+$/.test(input.value)
          ? input.value
          : null;
    if (numericValue === null) {
      throw fieldError(field, 'requiere dígitos no negativos sin separadores');
    }
    if (numericValue.length > field.length) {
      throw fieldError(
        field,
        `supera la longitud de ${field.length} posiciones`,
      );
    }
    return numericValue.padStart(field.length, '0');
  }

  if (typeof input.value !== 'string') {
    throw fieldError(field, 'requiere texto');
  }
  const hasControlCharacter = Array.from(input.value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
  });
  if (hasControlCharacter) {
    throw fieldError(field, 'no admite caracteres de control');
  }
  const characterLength = Array.from(input.value).length;
  if (characterLength > field.length) {
    throw fieldError(field, `supera la longitud de ${field.length} posiciones`);
  }
  return `${input.value}${' '.repeat(field.length - characterLength)}`;
}

function fieldError(
  field: PilaAt2V30FieldLayout,
  reason: string,
): PilaAt2V30SerializationError {
  return new PilaAt2V30SerializationError(
    `AT2 v30: el campo ${field.fieldNumber} ${reason}.`,
    field.fieldNumber,
  );
}

function defineLayout(
  compactFields: readonly (readonly [number, PilaAt2V30FieldKind])[],
  recordLength: number,
  decimalFieldNumbers: readonly number[] = [],
): PilaAt2V30RecordLayout {
  const fields = compactFields.map(([length, kind], index) => {
    const fieldNumber = index + 1;
    return {
      fieldNumber,
      length,
      kind,
      ...(decimalFieldNumbers.includes(fieldNumber)
        ? { numericFormat: 'DECIMAL_FRACTION' as const }
        : {}),
    };
  });
  const totalFieldLength = fields.reduce(
    (total, field) => total + field.length,
    0,
  );
  if (totalFieldLength !== recordLength) {
    throw new Error(
      `La definición AT2 v30 suma ${totalFieldLength}; se esperaban ${recordLength} posiciones.`,
    );
  }
  return Object.freeze({
    formatVersion: PILA_AT2_V30_FORMAT_VERSION,
    recordLength,
    fields: Object.freeze(fields),
  });
}
