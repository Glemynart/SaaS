import {
  PILA_AT2_V30_RECORD_LAYOUTS,
  serializePilaAt2V30Record,
} from './pila-at2-v30-record-serializer';
import type {
  PilaAt2V30FieldInput,
  PilaAt2V30RecordKey,
} from './pila-at2-v30-record-serializer';

function completeRecordValues(
  record: PilaAt2V30RecordKey,
  overrides: Record<number, PilaAt2V30FieldInput> = {},
): Record<number, PilaAt2V30FieldInput> {
  const layout = PILA_AT2_V30_RECORD_LAYOUTS[record];
  const values = Object.fromEntries(
    layout.fields.map(({ fieldNumber, kind }) => [
      fieldNumber,
      { value: kind === 'N' ? '1' : 'X' },
    ]),
  );
  return { ...values, ...overrides };
}

describe('AT2 v30 fixed-width record formatting', () => {
  it.each([
    ['employerType1', 34, 567],
    ['payrollHeaderType2', 22, 359],
    ['contributorDetailType2', 98, 693],
  ] as const)(
    'defines %s with %i fields and %i positions from the official layout',
    (record, fieldCount, length) => {
      const layout = PILA_AT2_V30_RECORD_LAYOUTS[record];
      expect(layout.fields).toHaveLength(fieldCount);
      expect(layout.recordLength).toBe(length);
      expect(layout.fields.map(({ fieldNumber }) => fieldNumber)).toEqual(
        Array.from({ length: fieldCount }, (_, index) => index + 1),
      );
      expect(
        layout.fields.reduce((total, field) => total + field.length, 0),
      ).toBe(length);

      const serialized = serializePilaAt2V30Record(
        record,
        completeRecordValues(record),
      );
      expect(Array.from(serialized)).toHaveLength(length);
    },
  );

  it('pads numeric values with leading zeroes and text with trailing spaces', () => {
    const values = completeRecordValues('employerType1', {
      1: { value: 'Empresa Ñ' },
      4: { value: 7 },
    });
    const record = serializePilaAt2V30Record('employerType1', values);

    expect(Array.from(record.slice(0, 200)).join('')).toBe(
      `Empresa Ñ${' '.repeat(191)}`,
    );
    expect(record.slice(218, 219)).toBe('7');
  });

  it('requires explicit treatment of empty values', () => {
    const values = completeRecordValues('payrollHeaderType2', {
      2: { value: null, emptyAs: 'spaces' },
      3: { value: null, emptyAs: 'zeros' },
    });
    const record = serializePilaAt2V30Record('payrollHeaderType2', values);

    expect(record.slice(2, 3)).toBe(' ');
    expect(record.slice(3, 7)).toBe('0000');
  });

  it('rejects missing field decisions and unknown field numbers', () => {
    const missingField = completeRecordValues('employerType1');
    delete missingField[12];
    expect(() =>
      serializePilaAt2V30Record('employerType1', missingField),
    ).toThrow('falta una decisión explícita para el campo 12');

    expect(() =>
      serializePilaAt2V30Record('employerType1', {
        ...completeRecordValues('employerType1'),
        35: { value: 'X' },
      }),
    ).toThrow('el campo 35 no pertenece al registro employerType1');
  });

  it.each([
    [4, { value: '7X' }],
    [4, { value: -1 }],
    [1, { value: 7 }],
    [1, { value: 'X'.repeat(201) }],
    [1, { value: 'Nombre\nEmpresa' }],
    [4, { value: null }],
  ] as const)(
    'rejects invalid field %i input without truncation',
    (field, value) => {
      expect(() =>
        serializePilaAt2V30Record(
          'employerType1',
          completeRecordValues('employerType1', { [field]: value }),
        ),
      ).toThrow(`campo ${field}`);
    },
  );

  it('allows an explicitly selected blank for a numeric field', () => {
    expect(() =>
      serializePilaAt2V30Record(
        'employerType1',
        completeRecordValues('employerType1', {
          4: { value: null, emptyAs: 'spaces' },
        }),
      ),
    ).not.toThrow();
  });
});
