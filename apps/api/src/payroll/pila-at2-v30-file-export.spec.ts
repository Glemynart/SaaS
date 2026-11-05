import * as iconv from 'iconv-lite';
import {
  PILA_AT2_V30_LOCAL_FILE_FORMAT_VERSION,
  PilaAt2V30FileExportBlockedError,
  composePilaAt2V30LocalFiles,
} from './pila-at2-v30-file-export';
import type { PilaAt2V30FileCandidates } from './pila-at2-v30-file-export';
import { PILA_AT2_V30_RECORD_LAYOUTS } from './pila-at2-v30-record-serializer';
import type {
  PilaAt2V30FieldInput,
  PilaAt2V30RecordKey,
} from './pila-at2-v30-record-serializer';

function completeRecordValues(
  record: PilaAt2V30RecordKey,
  overrides: Record<number, PilaAt2V30FieldInput> = {},
): Record<number, PilaAt2V30FieldInput> {
  const values = Object.fromEntries(
    PILA_AT2_V30_RECORD_LAYOUTS[record].fields.map(
      ({ fieldNumber, kind, length, numericFormat }) => [
        fieldNumber,
        {
          value:
            numericFormat === 'DECIMAL_FRACTION'
              ? '0.' + '1'.padEnd(length - 2, '0')
              : kind === 'N'
                ? '1'
                : 'X',
        },
      ],
    ),
  ) as Record<number, PilaAt2V30FieldInput>;
  return { ...values, ...overrides };
}

function completeFileCandidates(): PilaAt2V30FileCandidates {
  return {
    employer: {
      formatVersion: 'AT2_V30' as const,
      supportedSnapshots: true,
      tenantId: 'tenant-1',
      payrollPeriodId: 'period-1',
      values: completeRecordValues('employerType1', {
        1: { value: 'Empresa Ñ' },
        28: { value: null, emptyAs: 'spaces' },
        29: { value: null, emptyAs: 'spaces' },
      }),
      unresolvedFields: [],
    },
    header: {
      formatVersion: 'AT2_V30' as const,
      supportedSnapshots: true,
      tenantId: 'tenant-1',
      payrollPeriodId: 'period-1',
      values: completeRecordValues('payrollHeaderType2', {
        1: { value: '01' },
        2: { value: null, emptyAs: 'spaces' },
        8: { value: 'E' },
        9: { value: null, emptyAs: 'spaces' },
        15: { value: null, emptyAs: 'spaces' },
        17: { value: null, emptyAs: 'spaces' },
        18: { value: null, emptyAs: 'spaces' },
        22: { value: null, emptyAs: 'spaces' },
      }),
      unresolvedFields: [],
    },
    details: [
      {
        formatVersion: 'AT2_V30' as const,
        supportedSnapshot: true,
        scopeMismatch: false,
        employeeId: 'employee-1',
        tenantId: 'tenant-1',
        payrollPeriodId: 'period-1',
        values: completeRecordValues('contributorDetailType2', {
          1: { value: '02' },
          2: { value: 1 },
          12: { value: 'Pérez' },
          96: { value: null, emptyAs: 'spaces' },
        }),
        unresolvedFields: [],
      },
      {
        formatVersion: 'AT2_V30' as const,
        supportedSnapshot: true,
        scopeMismatch: false,
        employeeId: 'employee-2',
        tenantId: 'tenant-1',
        payrollPeriodId: 'period-1',
        values: completeRecordValues('contributorDetailType2', {
          1: { value: '02' },
          2: { value: 2 },
          12: { value: 'Muñoz' },
          96: { value: null, emptyAs: 'spaces' },
        }),
        unresolvedFields: [],
      },
    ],
  };
}

describe('composePilaAt2V30LocalFiles', () => {
  it('composes the employer file and ordered type 2 records with exact byte widths', () => {
    const files = composePilaAt2V30LocalFiles(completeFileCandidates());
    const separator = Buffer.from('\r\n', 'ascii');
    const type2Records = iconv
      .decode(files.type2File, 'windows-1252')
      .split('\r\n');

    expect(files.formatVersion).toBe(PILA_AT2_V30_LOCAL_FILE_FORMAT_VERSION);
    expect(files.encoding).toBe('windows-1252');
    expect(files.operatorCompatibilityStatus).toBe('NOT_VERIFIED');
    expect(files.recordCounts).toEqual({ type1: 1, type2: 3, details: 2 });
    expect(files.type1File.length).toBe(567);
    expect(iconv.decode(files.type1File, 'windows-1252').slice(0, 200)).toBe(
      'Empresa Ñ' + ' '.repeat(191),
    );
    expect(files.type2File.includes(separator)).toBe(true);
    expect(type2Records).toHaveLength(3);
    expect(
      type2Records.map((record) => iconv.encode(record, 'windows-1252').length),
    ).toEqual([359, 693, 693]);
    expect(type2Records[0].slice(0, 2)).toBe('01');
    expect(type2Records[1].slice(0, 7)).toBe('0200001');
    expect(type2Records[2].slice(0, 7)).toBe('0200002');
    expect(files.type2File.subarray(-2).toString('ascii')).not.toBe('\r\n');
  });

  it('rejects the complete batch when any candidate has an unresolved field', () => {
    const candidates = completeFileCandidates();
    candidates.details[1].unresolvedFields = [
      { fieldNumber: 63, reason: 'No existe una fuente única.' },
    ];

    try {
      composePilaAt2V30LocalFiles(candidates);
      throw new Error('Se esperaba el rechazo del lote.');
    } catch (error) {
      expect(error).toBeInstanceOf(PilaAt2V30FileExportBlockedError);
      expect((error as PilaAt2V30FileExportBlockedError).issues).toContainEqual(
        expect.objectContaining({
          record: 'DETALLE_TIPO_2',
          employeeId: 'employee-2',
          fieldNumber: 63,
          message: 'No existe una fuente única.',
        }),
      );
    }
  });

  it('rejects a detail whose text cannot be represented without loss', () => {
    const candidates = completeFileCandidates();
    candidates.details[0].values = completeRecordValues(
      'contributorDetailType2',
      {
        1: { value: '02' },
        2: { value: 1 },
        12: { value: 'Ana 🚀' },
      },
    );

    try {
      composePilaAt2V30LocalFiles(candidates);
      throw new Error('Se esperaba el rechazo del lote.');
    } catch (error) {
      expect(error).toBeInstanceOf(PilaAt2V30FileExportBlockedError);
      expect((error as PilaAt2V30FileExportBlockedError).issues).toContainEqual(
        expect.objectContaining({
          employeeId: 'employee-1',
          fieldNumber: 12,
          message:
            'El texto no se puede representar sin pérdida en Windows-1252.',
        }),
      );
    }
  });

  it('rejects mixed tenant or period candidates and non-consecutive detail sequences', () => {
    const candidates = completeFileCandidates();
    candidates.details[1].tenantId = 'tenant-2';
    candidates.details[1].values = completeRecordValues(
      'contributorDetailType2',
      {
        1: { value: '02' },
        2: { value: 3 },
      },
    );

    expect(() => composePilaAt2V30LocalFiles(candidates)).toThrow(
      PilaAt2V30FileExportBlockedError,
    );
    try {
      composePilaAt2V30LocalFiles(candidates);
    } catch (error) {
      expect((error as PilaAt2V30FileExportBlockedError).issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message:
              'Los candidatos no pertenecen al mismo tenant y período aprobado.',
          }),
          expect.objectContaining({
            employeeId: 'employee-2',
            fieldNumber: 2,
          }),
        ]),
      );
    }
  });

  it('does not serialize a candidate marked unsupported', () => {
    const candidates = completeFileCandidates();
    candidates.employer.supportedSnapshots = false;

    expect(() => composePilaAt2V30LocalFiles(candidates)).toThrow(
      PilaAt2V30FileExportBlockedError,
    );
  });
});
