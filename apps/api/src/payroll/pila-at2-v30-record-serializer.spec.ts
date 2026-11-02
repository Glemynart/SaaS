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
    layout.fields.map(({ fieldNumber, kind, numericFormat }) => [
      fieldNumber,
      {
        value:
          numericFormat === 'DECIMAL_FRACTION'
            ? '0.1000000'
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
    const employer = serializePilaAt2V30Record(
      'employerType1',
      completeRecordValues('employerType1', {
        1: { value: 'Empresa Ñ' },
      }),
    );
    const header = serializePilaAt2V30Record(
      'payrollHeaderType2',
      completeRecordValues('payrollHeaderType2', {
        3: { value: 7 },
      }),
    );

    expect(Array.from(employer.slice(0, 200)).join('')).toBe(
      `Empresa Ñ${' '.repeat(191)}`,
    );
    expect(header.slice(3, 7)).toBe('0007');
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
    const layout = PILA_AT2_V30_RECORD_LAYOUTS.payrollHeaderType2;
    const spaceField = layout.fields.find(({ kind }) => kind === 'A');
    const zeroField = layout.fields.find(({ kind }) => kind === 'N');
    if (!spaceField || !zeroField) {
      throw new Error('La prueba requiere campos alfanuméricos y numéricos.');
    }
    const values = completeRecordValues('payrollHeaderType2', {
      [spaceField.fieldNumber]: { value: null, emptyAs: 'spaces' },
      [zeroField.fieldNumber]: { value: null, emptyAs: 'zeros' },
    });
    const record = serializePilaAt2V30Record('payrollHeaderType2', values);
    const fieldStart = (fieldNumber: number) =>
      layout.fields
        .filter((field) => field.fieldNumber < fieldNumber)
        .reduce((total, field) => total + field.length, 0);

    expect(
      record.slice(
        fieldStart(spaceField.fieldNumber),
        fieldStart(spaceField.fieldNumber) + spaceField.length,
      ),
    ).toBe(' '.repeat(spaceField.length));
    expect(
      record.slice(
        fieldStart(zeroField.fieldNumber),
        fieldStart(zeroField.fieldNumber) + zeroField.length,
      ),
    ).toBe('0'.repeat(zeroField.length));
  });
  it('requires an explicit placeholder for null values', () => {
    expect(() =>
      serializePilaAt2V30Record(
        'employerType1',
        completeRecordValues('employerType1', {
          5: { value: null },
          10: { value: 'U' },
        }),
      ),
    ).toThrow('campo 5');
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

  it('allows an explicitly selected blank for a branch in unique presentation', () => {
    const record = serializePilaAt2V30Record(
      'employerType1',
      completeRecordValues('employerType1', {
        5: { value: null, emptyAs: 'spaces' },
        10: { value: 'U' },
      }),
    );

    expect(record.slice(219, 229)).toBe(' '.repeat(10));
  });

  it('rejects spaces as the empty representation for numeric fields', () => {
    expect(() =>
      serializePilaAt2V30Record(
        'employerType1',
        completeRecordValues('employerType1', {
          4: { value: null, emptyAs: 'spaces' },
        }),
      ),
    ).toThrow('campo 4');
  });

  it('fills an explicitly empty numeric field with zeroes', () => {
    const record = serializePilaAt2V30Record(
      'employerType1',
      completeRecordValues('employerType1', {
        4: { value: null, emptyAs: 'zeros' },
        9: { value: 'N' },
      }),
    );

    expect(record.slice(218, 219)).toBe('0');
  });
});
