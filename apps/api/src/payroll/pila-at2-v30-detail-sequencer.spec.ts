import {
  PILA_AT2_V30_DETAIL_RECORD_SEQUENCE_RULE_VERSION,
  PILA_AT2_V30_MAX_DETAIL_RECORDS,
  sequencePilaAt2V30DetailCandidates,
  type PilaAt2V30DetailSequenceInput,
} from './pila-at2-v30-detail-sequencer';

function candidate(
  employeeId: string,
  overrides: Partial<PilaAt2V30DetailSequenceInput> = {},
): PilaAt2V30DetailSequenceInput {
  return {
    formatVersion: 'AT2_V30',
    supportedSnapshot: true,
    scopeMismatch: false,
    employeeId,
    tenantId: 'tenant-1',
    payrollPeriodId: 'period-1',
    values: { 1: { value: '02' } },
    unresolvedFields: [
      {
        fieldNumber: 2,
        reason: 'La secuencia requiere el conjunto completo de líneas.',
      },
    ],
    ...overrides,
  };
}

function sequence(candidates: readonly PilaAt2V30DetailSequenceInput[]) {
  return sequencePilaAt2V30DetailCandidates(candidates, [
    ...new Set(candidates.map(({ employeeId }) => employeeId)),
  ]);
}

describe('sequencePilaAt2V30DetailCandidates', () => {
  it('assigns a deterministic sequence from 00001 in employee ID order', () => {
    const result = sequence([candidate('employee-b'), candidate('employee-a')]);

    expect(result).toEqual({
      status: 'CANDIDATE',
      ruleVersion: PILA_AT2_V30_DETAIL_RECORD_SEQUENCE_RULE_VERSION,
      assignments: [
        { employeeId: 'employee-a', sequence: 1 },
        { employeeId: 'employee-b', sequence: 2 },
      ],
      pendingReason: null,
    });
  });

  it.each([
    [
      'duplicate employee snapshots',
      [candidate('employee-a'), candidate('employee-a')],
      'exactamente un snapshot aprobado por empleado',
    ],
    [
      'mixed periods',
      [
        candidate('employee-a'),
        candidate('employee-b', { payrollPeriodId: 'period-2' }),
      ],
      'mezclan formato, tenant o período',
    ],
    [
      'unsupported snapshot',
      [
        candidate('employee-a'),
        candidate('employee-b', { supportedSnapshot: false }),
      ],
      'Todos los snapshots deben ser válidos',
    ],
    [
      'scope mismatch',
      [
        candidate('employee-a'),
        candidate('employee-b', { scopeMismatch: true }),
      ],
      'Todos los snapshots deben ser válidos',
    ],
    [
      'employee without one standard detail line',
      [candidate('employee-a'), candidate('employee-b', { values: {} })],
      'exactamente una línea mensual estándar',
    ],
    [
      'missing tenant scope',
      [candidate('employee-a', { tenantId: null })],
      'confirmar el tenant y período',
    ],
  ])('keeps every sequence pending for %s', (_case, inputs, reason) => {
    const result = sequence(inputs);

    expect(result.status).toBe('PENDING');
    expect(result.assignments).toEqual([]);
    expect(result.ruleVersion).toBeNull();
    expect(result.pendingReason).toContain(reason);
  });

  it('keeps every sequence pending without the approved run employee set', () => {
    const result = sequencePilaAt2V30DetailCandidates(
      [candidate('employee-a')],
      null,
    );

    expect(result.status).toBe('PENDING');
    expect(result.assignments).toEqual([]);
    expect(result.pendingReason).toContain(
      'No se confirmó el conjunto completo de empleados',
    );
  });

  it('requires snapshots to match the complete approved run employee set', () => {
    const result = sequencePilaAt2V30DetailCandidates(
      [candidate('employee-a'), candidate('employee-b')],
      ['employee-a', 'employee-c'],
    );

    expect(result.status).toBe('PENDING');
    expect(result.assignments).toEqual([]);
    expect(result.pendingReason).toContain(
      'no coinciden exactamente con los empleados',
    );
  });

  it('blocks empty input and field overflow without partial assignments', () => {
    const empty = sequence([]);
    const overflow = sequence(
      Array.from({ length: PILA_AT2_V30_MAX_DETAIL_RECORDS + 1 }, (_, index) =>
        candidate(`employee-${index}`),
      ),
    );

    expect(empty.status).toBe('PENDING');
    expect(empty.assignments).toEqual([]);
    expect(overflow.status).toBe('PENDING');
    expect(overflow.assignments).toEqual([]);
    expect(overflow.pendingReason).toContain('99.999 registros');
  });
});
