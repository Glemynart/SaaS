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
    layout.fields.map(({ fieldNumber, kind, length, numericFormat }) => [
      fieldNumber,
      {
        value:
          numericFormat === 'DECIMAL_FRACTION'
            ? `0.${'1'.padEnd(length - 2, '0')}`
            : kind === 'N'
              ? '1'
              : 'X',
      },
    ]),
  );
  return { ...values, ...overrides };
}

function layoutSignature(record: PilaAt2V30RecordKey): string {
  return PILA_AT2_V30_RECORD_LAYOUTS[record].fields
    .map(({ length, kind }) => `${length}${kind}`)
    .join(' ');
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

  it.each([
    [
      'employerType1',
      '200A 2A 16A 1N 10A 40A 1A 1N 1A 1A 40A 3A 2A 4N 10N 10N 60A 16A 1N 2A 20A 30A 20A 30A 10A 1N 10A 2N 7N 2N 10A 2A 1A 1A',
    ],
    [
      'payrollHeaderType2',
      '2N 1N 4N 200A 2A 16A 1N 1A 10N 10A 1A 10A 40A 6A 7A 7A 10N 10A 5N 12N 2N 2N',
    ],
    [
      'contributorDetailType2',
      '2N 5N 2A 16A 2N 2N 1A 1A 2A 3A 20A 30A 20A 30A 1A 1A 1A 1A 1A 1A 1A 1A 1A 1A 1A 1A 1A 1A 1A 2N 6A 6A 6A 6A 6A 2N 2N 2N 2N 9N 1A 9N 9N 9N 9N 7N 9N 9N 9N 9N 9N 9N 9N 7N 9N 9N 15A 9N 15A 9N 9N 9N 9N 7N 9N 7N 9N 7N 9N 7N 9N 7N 9N 2A 16A 1A 6A 1A 1A 10A 10A 10A 10A 10A 10A 10A 10A 10A 10A 10A 10A 10A 10A 10A 9N 3N 10A 7N',
    ],
  ] as const)(
    'preserves the official per-field width and kind sequence for %s',
    (record, expectedSignature) => {
      expect(layoutSignature(record)).toBe(expectedSignature);
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

  it('formats the AT2 field 61 fractional tariff with trailing zeroes', () => {
    const layout = PILA_AT2_V30_RECORD_LAYOUTS.contributorDetailType2;
    const field61Start = layout.fields
      .filter(({ fieldNumber }) => fieldNumber < 61)
      .reduce((total, field) => total + field.length, 0);
    const values = completeRecordValues('contributorDetailType2', {
      61: { value: '0.00522' },
    });
    const record = serializePilaAt2V30Record('contributorDetailType2', values);

    expect(record.slice(field61Start, field61Start + 9)).toBe('0.0052200');
    expect(
      PILA_AT2_V30_RECORD_LAYOUTS.contributorDetailType2.fields[60]
        .numericFormat,
    ).toBe('DECIMAL_FRACTION');
  });

  it('formats the AT2 field 46 pension fractional tariff to seven positions', () => {
    const layout = PILA_AT2_V30_RECORD_LAYOUTS.contributorDetailType2;
    const field46Start = layout.fields
      .filter(({ fieldNumber }) => fieldNumber < 46)
      .reduce((total, field) => total + field.length, 0);
    const values = completeRecordValues('contributorDetailType2', {
      46: { value: '0.16' },
    });
    const record = serializePilaAt2V30Record('contributorDetailType2', values);

    expect(record.slice(field46Start, field46Start + 7)).toBe('0.16000');
    expect(
      layout.fields.find(({ fieldNumber }) => fieldNumber === 46)
        ?.numericFormat,
    ).toBe('DECIMAL_FRACTION');
  });

  it('formats the AT2 field 54 health fractional tariff to seven positions', () => {
    const layout = PILA_AT2_V30_RECORD_LAYOUTS.contributorDetailType2;
    const field54Start = layout.fields
      .filter(({ fieldNumber }) => fieldNumber < 54)
      .reduce((total, field) => total + field.length, 0);
    const values = completeRecordValues('contributorDetailType2', {
      54: { value: '0.12500' },
    });
    const record = serializePilaAt2V30Record('contributorDetailType2', values);

    expect(record.slice(field54Start, field54Start + 7)).toBe('0.12500');
    expect(
      layout.fields.find(({ fieldNumber }) => fieldNumber === 54)
        ?.numericFormat,
    ).toBe('DECIMAL_FRACTION');
  });

  it('writes AT2 no-event incapacity and maternity fields as blanks and zeroes', () => {
    const layout = PILA_AT2_V30_RECORD_LAYOUTS.contributorDetailType2;
    const values = completeRecordValues('contributorDetailType2', {
      57: { value: null, emptyAs: 'spaces' },
      58: { value: 0 },
      59: { value: null, emptyAs: 'spaces' },
      60: { value: 0 },
    });
    const record = serializePilaAt2V30Record('contributorDetailType2', values);
    const fieldStart = (fieldNumber: number) =>
      layout.fields
        .filter((field) => field.fieldNumber < fieldNumber)
        .reduce((total, field) => total + field.length, 0);

    expect(record.slice(fieldStart(57), fieldStart(57) + 15)).toBe(
      ' '.repeat(15),
    );
    expect(record.slice(fieldStart(58), fieldStart(58) + 9)).toBe('000000000');
    expect(record.slice(fieldStart(59), fieldStart(59) + 15)).toBe(
      ' '.repeat(15),
    );
    expect(record.slice(fieldStart(60), fieldStart(60) + 9)).toBe('000000000');
  });

  it('formats the AT2 field 64 CCF fractional tariff to seven positions', () => {
    const layout = PILA_AT2_V30_RECORD_LAYOUTS.contributorDetailType2;
    const field64Start = layout.fields
      .filter(({ fieldNumber }) => fieldNumber < 64)
      .reduce((total, field) => total + field.length, 0);
    const values = completeRecordValues('contributorDetailType2', {
      64: { value: '0.04' },
    });
    const record = serializePilaAt2V30Record('contributorDetailType2', values);

    expect(record.slice(field64Start, field64Start + 7)).toBe('0.04000');
    expect(
      PILA_AT2_V30_RECORD_LAYOUTS.contributorDetailType2.fields[63]
        .numericFormat,
    ).toBe('DECIMAL_FRACTION');
  });

  it.each([
    [66, '0.02', '0.02000'],
    [68, '0.03', '0.03000'],
  ])(
    'formats the AT2 field %i parafiscal fractional tariff',
    (fieldNumber, value, expected) => {
      const layout = PILA_AT2_V30_RECORD_LAYOUTS.contributorDetailType2;
      const fieldStart = layout.fields
        .filter((field) => field.fieldNumber < fieldNumber)
        .reduce((total, field) => total + field.length, 0);
      const field = layout.fields.find(
        (item) => item.fieldNumber === fieldNumber,
      );
      const values = completeRecordValues('contributorDetailType2', {
        [fieldNumber]: { value },
      });
      const record = serializePilaAt2V30Record(
        'contributorDetailType2',
        values,
      );

      expect(record.slice(fieldStart, fieldStart + 7)).toBe(expected);
      expect(field?.numericFormat).toBe('DECIMAL_FRACTION');
    },
  );

  it.each([0.00522, '0.00522000', '-0.00522', '0.00522X'] as const)(
    'rejects invalid decimal encoding for AT2 field 61: %s',
    (value) => {
      expect(() =>
        serializePilaAt2V30Record(
          'contributorDetailType2',
          completeRecordValues('contributorDetailType2', {
            61: { value },
          }),
        ),
      ).toThrow('campo 61');
    },
  );

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
