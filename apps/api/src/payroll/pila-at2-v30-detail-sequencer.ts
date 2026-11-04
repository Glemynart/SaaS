import type { PilaAt2V30FieldInput } from './pila-at2-v30-record-serializer';

export const PILA_AT2_V30_MAX_DETAIL_RECORDS = 99_999;
export const PILA_AT2_V30_DETAIL_RECORD_SEQUENCE_RULE_VERSION =
  'AT2_V30_DETAIL_RECORD_SEQUENCE_BY_EMPLOYEE_ID_V1' as const;

export interface PilaAt2V30DetailSequenceInput {
  formatVersion: 'AT2_V30';
  supportedSnapshot: boolean;
  scopeMismatch: boolean;
  employeeId: string;
  tenantId: string | null;
  payrollPeriodId: string | null;
  values: Partial<Record<number, PilaAt2V30FieldInput>>;
  unresolvedFields: Array<{ fieldNumber: number; reason: string }>;
}

export interface PilaAt2V30DetailSequenceAssignment {
  employeeId: string;
  sequence: number;
}

export type PilaAt2V30DetailSequenceResult =
  | {
      status: 'CANDIDATE';
      ruleVersion: typeof PILA_AT2_V30_DETAIL_RECORD_SEQUENCE_RULE_VERSION;
      assignments: PilaAt2V30DetailSequenceAssignment[];
      pendingReason: null;
    }
  | {
      status: 'PENDING';
      ruleVersion: null;
      assignments: [];
      pendingReason: string;
    };

function pending(pendingReason: string): PilaAt2V30DetailSequenceResult {
  return {
    status: 'PENDING',
    ruleVersion: null,
    assignments: [],
    pendingReason,
  };
}

/**
 * Assigns AT2 type 2 field 2 across a complete, single-tenant period scope.
 * Employee ID order is deterministic; no partial sequence is returned when
 * any snapshot cannot prove exactly one standard monthly detail line.
 */
export function sequencePilaAt2V30DetailCandidates(
  candidates: readonly PilaAt2V30DetailSequenceInput[],
  expectedEmployeeIds: readonly string[] | null,
): PilaAt2V30DetailSequenceResult {
  if (candidates.length === 0) {
    return pending('No hay snapshots aprobados para determinar la secuencia.');
  }

  if (candidates.length > PILA_AT2_V30_MAX_DETAIL_RECORDS) {
    return pending(
      `La planilla excede el máximo de 99.999 registros que caben en el campo 2 N5.`,
    );
  }

  if (expectedEmployeeIds === null) {
    return pending(
      'No se confirmó el conjunto completo de empleados desde las ejecuciones aprobadas de nómina.',
    );
  }

  const expectedIds = new Set(expectedEmployeeIds);
  if (
    expectedIds.size !== expectedEmployeeIds.length ||
    expectedEmployeeIds.some((employeeId) => !employeeId.trim())
  ) {
    return pending(
      'La ejecución aprobada no contiene una lista única y válida de empleados para comparar con los snapshots.',
    );
  }

  const firstCandidate = candidates[0];
  const tenantId = firstCandidate.tenantId;
  const payrollPeriodId = firstCandidate.payrollPeriodId;
  if (!tenantId || !payrollPeriodId) {
    return pending(
      'No se puede confirmar el tenant y período del conjunto completo de snapshots.',
    );
  }

  const seenEmployeeIds = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.supportedSnapshot || candidate.scopeMismatch) {
      return pending(
        'Todos los snapshots deben ser válidos y pertenecer al mismo tenant y período antes de asignar la secuencia.',
      );
    }
    if (
      candidate.formatVersion !== firstCandidate.formatVersion ||
      candidate.tenantId !== tenantId ||
      candidate.payrollPeriodId !== payrollPeriodId
    ) {
      return pending(
        'Los registros candidatos mezclan formato, tenant o período.',
      );
    }
    if (
      !candidate.employeeId.trim() ||
      seenEmployeeIds.has(candidate.employeeId)
    ) {
      return pending(
        'Debe existir exactamente un snapshot aprobado por empleado para determinar la secuencia.',
      );
    }
    seenEmployeeIds.add(candidate.employeeId);
    if (
      candidate.values[1]?.value !== '02' ||
      Object.hasOwn(candidate.values, 2) ||
      !candidate.unresolvedFields.some(({ fieldNumber }) => fieldNumber === 2)
    ) {
      return pending(
        'Cada snapshot debe probar exactamente una línea mensual estándar y dejar el campo 2 pendiente de secuencia.',
      );
    }
  }

  if (
    seenEmployeeIds.size !== expectedIds.size ||
    [...expectedIds].some((employeeId) => !seenEmployeeIds.has(employeeId))
  ) {
    return pending(
      'Los snapshots aprobados no coinciden exactamente con los empleados de las ejecuciones aprobadas del período.',
    );
  }

  const sortedEmployeeIds = [...seenEmployeeIds].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );

  return {
    status: 'CANDIDATE',
    ruleVersion: PILA_AT2_V30_DETAIL_RECORD_SEQUENCE_RULE_VERSION,
    assignments: sortedEmployeeIds.map((employeeId, index) => ({
      employeeId,
      sequence: index + 1,
    })),
    pendingReason: null,
  };
}
