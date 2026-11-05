import * as iconv from 'iconv-lite';
import {
  PILA_AT2_V30_RECORD_LAYOUTS,
  serializePilaAt2V30RecordCandidate,
} from './pila-at2-v30-record-serializer';
import type {
  PilaAt2V30FieldInput,
  PilaAt2V30RecordCandidate,
  PilaAt2V30RecordKey,
} from './pila-at2-v30-record-serializer';
import type { PilaAt2V30DetailCandidate } from './pila-at2-v30-detail-mapper';

export const PILA_AT2_V30_LOCAL_FILE_FORMAT_VERSION =
  'AT2_V30_CP1252_CRLF_LOCAL_V1' as const;

export interface PilaAt2V30ExportIssue {
  record: 'APORTANTE_TIPO_1' | 'CABECERA_TIPO_2' | 'DETALLE_TIPO_2';
  employeeId?: string;
  fieldNumber?: number;
  message: string;
}

interface AggregateCandidate {
  formatVersion: 'AT2_V30';
  supportedSnapshots: boolean;
  tenantId: string | null;
  payrollPeriodId: string | null;
  values: Partial<Record<number, PilaAt2V30FieldInput>>;
  unresolvedFields: readonly { fieldNumber: number; reason: string }[];
}

interface HeaderCandidate extends AggregateCandidate {
  unresolvedFields: readonly {
    fieldNumber: number;
    code: string;
    reason: string;
  }[];
}

interface DetailCandidate {
  formatVersion: 'AT2_V30';
  supportedSnapshot: boolean;
  scopeMismatch: boolean;
  employeeId: string;
  tenantId: string | null;
  payrollPeriodId: string | null;
  values: Partial<Record<number, PilaAt2V30FieldInput>>;
  unresolvedFields: readonly { fieldNumber: number; reason: string }[];
  normativeRuleVersions?: PilaAt2V30DetailCandidate['normativeRuleVersions'];
}

export interface PilaAt2V30FileCandidates {
  employer: AggregateCandidate;
  header: HeaderCandidate;
  details: readonly DetailCandidate[];
}

export interface PilaAt2V30LocalFiles {
  formatVersion: typeof PILA_AT2_V30_LOCAL_FILE_FORMAT_VERSION;
  normativeFormat: 'AT2_V30';
  encoding: 'windows-1252';
  recordSeparator: '\r\n';
  finalRecordSeparator: false;
  operatorCompatibilityStatus: 'NOT_VERIFIED';
  type1File: Buffer;
  type2File: Buffer;
  recordCounts: { type1: 1; type2: number; details: number };
}

export class PilaAt2V30FileExportBlockedError extends Error {
  constructor(readonly issues: readonly PilaAt2V30ExportIssue[]) {
    super(
      'No se generó ningún archivo PILA: hay campos o registros que requieren corrección.',
    );
    this.name = 'PilaAt2V30FileExportBlockedError';
  }
}

interface SerializedCandidate {
  record: PilaAt2V30RecordKey;
  candidate: PilaAt2V30RecordCandidate;
  issueRecord: PilaAt2V30ExportIssue['record'];
  employeeId?: string;
}

function encodeRecordCandidate(input: SerializedCandidate): {
  bytes: Buffer | null;
  issues: PilaAt2V30ExportIssue[];
} {
  const issues: PilaAt2V30ExportIssue[] = [];
  const { record, candidate, issueRecord, employeeId } = input;

  if (!candidate.supported) {
    issues.push({
      record: issueRecord,
      employeeId,
      message: 'La fuente de este registro no está soportada.',
    });
  }
  for (const unresolved of candidate.unresolvedFields) {
    issues.push({
      record: issueRecord,
      employeeId,
      fieldNumber: unresolved.fieldNumber,
      message: unresolved.reason,
    });
  }
  if (issues.length > 0) return { bytes: null, issues };

  for (const fieldNumberText of Object.keys(candidate.values)) {
    const fieldNumber = Number(fieldNumberText);
    const fieldInput = candidate.values[fieldNumber];
    if (
      typeof fieldInput?.value === 'string' &&
      iconv.decode(
        iconv.encode(fieldInput.value, 'windows-1252'),
        'windows-1252',
      ) !== fieldInput.value
    ) {
      issues.push({
        record: issueRecord,
        employeeId,
        fieldNumber,
        message:
          'El texto no se puede representar sin pérdida en Windows-1252.',
      });
    }
  }
  if (issues.length > 0) return { bytes: null, issues };

  let serialized: string;
  try {
    serialized = serializePilaAt2V30RecordCandidate(record, candidate);
  } catch (error) {
    const fieldNumber = getFieldNumber(error);
    issues.push({
      record: issueRecord,
      employeeId,
      fieldNumber,
      message:
        error instanceof Error
          ? error.message
          : 'El registro no cumple el layout AT2 v30.',
    });
    return { bytes: null, issues };
  }

  const bytes = iconv.encode(serialized, 'windows-1252');
  const expectedLength = PILA_AT2_V30_RECORD_LAYOUTS[record].recordLength;
  if (
    bytes.length !== expectedLength ||
    iconv.decode(bytes, 'windows-1252') !== serialized
  ) {
    issues.push({
      record: issueRecord,
      employeeId,
      message:
        'El registro no conserva su longitud ni texto al codificarlo en Windows-1252.',
    });
    return { bytes: null, issues };
  }

  return { bytes, issues };
}

function getFieldNumber(error: unknown): number | undefined {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('fieldNumber' in error)
  ) {
    return undefined;
  }
  const fieldNumber = error.fieldNumber;
  return typeof fieldNumber === 'number' && Number.isInteger(fieldNumber)
    ? fieldNumber
    : undefined;
}

/**
 * Composes local AT2 v30 file candidates from fully mapped, approved-snapshot
 * candidates. It fails the entire batch if any record is incomplete, mixed
 * across tenants/periods, duplicated, out of sequence, or not representable.
 *
 * CP1252 + CRLF is an explicit local file convention. It is not an assertion
 * that SOI or another operator accepts that convention; compatibility remains
 * unverified until an operator-specific upload succeeds.
 */
export function composePilaAt2V30LocalFiles(
  candidates: PilaAt2V30FileCandidates,
): PilaAt2V30LocalFiles {
  const issues: PilaAt2V30ExportIssue[] = [];
  const { employer, header, details } = candidates;
  const tenantId = employer.tenantId;
  const payrollPeriodId = employer.payrollPeriodId;

  if (!tenantId || !payrollPeriodId) {
    issues.push({
      record: 'APORTANTE_TIPO_1',
      message: 'No se puede confirmar el tenant y período de los snapshots.',
    });
  }
  if (
    employer.formatVersion !== 'AT2_V30' ||
    header.formatVersion !== 'AT2_V30' ||
    details.some((detail) => detail.formatVersion !== 'AT2_V30')
  ) {
    issues.push({
      record: 'DETALLE_TIPO_2',
      message: 'Los candidatos mezclan versiones del formato.',
    });
  }
  if (
    header.tenantId !== tenantId ||
    header.payrollPeriodId !== payrollPeriodId ||
    details.some(
      (detail) =>
        detail.tenantId !== tenantId ||
        detail.payrollPeriodId !== payrollPeriodId ||
        detail.scopeMismatch,
    )
  ) {
    issues.push({
      record: 'DETALLE_TIPO_2',
      message:
        'Los candidatos no pertenecen al mismo tenant y período aprobado.',
    });
  }
  if (details.length === 0) {
    issues.push({
      record: 'DETALLE_TIPO_2',
      message: 'La planilla no tiene registros de detalle.',
    });
  }
  if (details.length > 99_999) {
    issues.push({
      record: 'DETALLE_TIPO_2',
      fieldNumber: 2,
      message: 'La planilla excede el máximo de 99.999 registros de detalle.',
    });
  }

  const employeeIds = new Set(details.map(({ employeeId }) => employeeId));
  if (employeeIds.size !== details.length || employeeIds.has('')) {
    issues.push({
      record: 'DETALLE_TIPO_2',
      message: 'Debe existir exactamente un detalle por empleado.',
    });
  }

  const orderedDetails = [...details].sort((left, right) => {
    const leftSequence = Number(left.values[2]?.value);
    const rightSequence = Number(right.values[2]?.value);
    return leftSequence - rightSequence;
  });
  orderedDetails.forEach((detail, index) => {
    if (detail.values[2]?.value !== index + 1) {
      issues.push({
        record: 'DETALLE_TIPO_2',
        employeeId: detail.employeeId,
        fieldNumber: 2,
        message:
          'La secuencia debe ser completa, única y consecutiva desde 00001.',
      });
    }
  });

  const employerRecord = encodeRecordCandidate({
    record: 'employerType1',
    issueRecord: 'APORTANTE_TIPO_1',
    candidate: {
      supported: employer.supportedSnapshots,
      values: employer.values,
      unresolvedFields: employer.unresolvedFields,
    },
  });
  const headerRecord = encodeRecordCandidate({
    record: 'payrollHeaderType2',
    issueRecord: 'CABECERA_TIPO_2',
    candidate: {
      supported: header.supportedSnapshots,
      values: header.values,
      unresolvedFields: header.unresolvedFields,
    },
  });
  const detailRecords = orderedDetails.map((detail) =>
    encodeRecordCandidate({
      record: 'contributorDetailType2',
      issueRecord: 'DETALLE_TIPO_2',
      employeeId: detail.employeeId,
      candidate: {
        supported: detail.supportedSnapshot && !detail.scopeMismatch,
        values: detail.values,
        unresolvedFields: detail.unresolvedFields,
      },
    }),
  );

  issues.push(
    ...employerRecord.issues,
    ...headerRecord.issues,
    ...detailRecords.flatMap(({ issues: recordIssues }) => recordIssues),
  );

  if (
    issues.length > 0 ||
    employerRecord.bytes === null ||
    headerRecord.bytes === null ||
    detailRecords.some(({ bytes }) => bytes === null)
  ) {
    throw new PilaAt2V30FileExportBlockedError(issues);
  }

  const separator = Buffer.from('\r\n', 'ascii');
  const type1File = employerRecord.bytes;
  const type2File = Buffer.concat([
    headerRecord.bytes,
    ...detailRecords.flatMap(({ bytes }) => [separator, bytes!]),
  ]);

  return {
    formatVersion: PILA_AT2_V30_LOCAL_FILE_FORMAT_VERSION,
    normativeFormat: 'AT2_V30',
    encoding: 'windows-1252',
    recordSeparator: '\r\n',
    finalRecordSeparator: false,
    operatorCompatibilityStatus: 'NOT_VERIFIED',
    type1File,
    type2File,
    recordCounts: {
      type1: 1,
      type2: 1 + detailRecords.length,
      details: detailRecords.length,
    },
  };
}
