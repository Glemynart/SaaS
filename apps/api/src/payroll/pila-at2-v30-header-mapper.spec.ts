import type { PilaSnapshotPreparationInput } from './pila-preparation';
import { mapPilaAt2V30HeaderCandidate } from './pila-at2-v30-header-mapper';
import { serializePilaAt2V30RecordCandidate } from './pila-at2-v30-record-serializer';

function snapshot(employeeId = 'employee-1'): PilaSnapshotPreparationInput {
  return {
    employeeId,
    payloadVersion: 2,
    payload: {
      schemaVersion: 2,
      period: {
        payrollPeriodId: 'period-1',
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-31',
      },
      employer: {
        tenantId: 'tenant-1',
        razonSocial: 'Empresa Demo SAS',
        nit: '900123456',
        digitoVerif: '7',
        direccion: 'Calle Demo 10',
        telefono: '6011234567',
        email: null,
        aportesExonerados: false,
        municipio: { codigo: '11001' },
        pila: {
          claseAportante: 'B',
          tipoDocumentoAportante: 'NI',
          naturalezaJuridica: '2',
          tipoPersona: 'J',
          formaPresentacion: 'U',
          codigoActividadEconomica: '1234',
          codigoArlAportante: 'ARL001',
          tipoAportante: '1',
          fax: '6011234567',
          representanteTipoDocumento: 'CC',
          representanteNumeroDocumento: '123456789',
          representantePrimerApellido: 'Demo',
          representanteSegundoApellido: null,
          representantePrimerNombre: 'Ana',
          representanteSegundoNombre: null,
          beneficioLey1429: false,
          beneficioCcfLey1429: false,
          aportesExoneradosConfirmado: false,
          sinAccionEspecial: true,
        },
      },
      employee: { employeeId },
      affiliations: [
        {
          tipoCotizanteCodigo: '01',
          subtipoCotizanteCodigo: '00',
          vigenteDesde: '2026-01-01',
          vigenteHasta: null,
        },
      ],
      payroll: {
        ibcPorSubsistema: { cajaCompensacion: { valor: 2_000_000 } },
      },
    },
  };
}

function payloadOf(snapshotInput: PilaSnapshotPreparationInput) {
  return snapshotInput.payload as {
    employer: {
      tenantId: string;
      pila: Record<string, unknown>;
      [key: string]: unknown;
    };
    period: { payrollPeriodId: string; [key: string]: unknown };
    employee: { employeeId: string };
    affiliations: Array<Record<string, unknown>>;
    payroll: { ibcPorSubsistema: { cajaCompensacion: { valor: number } } };
    [key: string]: unknown;
  };
}

const expectedPeriod = {
  id: 'period-1',
  fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
  fechaFin: new Date('2026-10-31T00:00:00.000Z'),
};

function mapCandidateForDemoScope(
  snapshots: readonly PilaSnapshotPreparationInput[],
  period = expectedPeriod,
  expectedTenantId: string | null = 'tenant-1',
) {
  return mapPilaAt2V30HeaderCandidate({
    expectedTenantId,
    period,
    snapshots,
  });
}

describe('mapPilaAt2V30HeaderCandidate', () => {
  it('maps constants, shared employer data, period and totals from approved snapshots', () => {
    const candidate = mapCandidateForDemoScope([snapshot()]);

    expect(candidate).toMatchObject({
      formatVersion: 'AT2_V30',
      supportedSnapshots: true,
      tenantId: 'tenant-1',
      payrollPeriodId: 'period-1',
    });
    expect(candidate.values).toMatchObject({
      1: { value: '01' },
      2: { value: null, emptyAs: 'spaces' },
      3: { value: '1' },
      4: { value: 'Empresa Demo SAS' },
      5: { value: 'NI' },
      6: { value: '900123456' },
      7: { value: '7' },
      8: { value: 'E' },
      9: { value: null, emptyAs: 'spaces' },
      10: { value: null, emptyAs: 'spaces' },
      11: { value: 'U' },
      12: { value: null, emptyAs: 'spaces' },
      13: { value: null, emptyAs: 'spaces' },
      14: { value: 'ARL001' },
      15: { value: null, emptyAs: 'spaces' },
      16: { value: '2026-10' },
      17: { value: null, emptyAs: 'spaces' },
      18: { value: null, emptyAs: 'spaces' },
      19: { value: 1 },
      20: { value: 2_000_000 },
      21: { value: '1' },
      22: { value: null, emptyAs: 'spaces' },
    });
  });

  it('serializes a complete mapped header candidate without unresolved fields', () => {
    const candidate = mapCandidateForDemoScope([snapshot()]);

    expect(candidate.unresolvedFields).toEqual([]);
    const record = serializePilaAt2V30RecordCandidate('payrollHeaderType2', {
      supported: candidate.supportedSnapshots,
      values: candidate.values,
      unresolvedFields: candidate.unresolvedFields,
    });

    expect(record).toHaveLength(359);
    expect(record.slice(227, 237)).toBe(' '.repeat(10));
  });

  it('maps the type 2 header from current PILA v3 snapshots', () => {
    const input = snapshot();
    input.payloadVersion = 3;
    (input.payload as { schemaVersion: number }).schemaVersion = 3;

    const candidate = mapCandidateForDemoScope([input]);

    expect(candidate.supportedSnapshots).toBe(true);
    expect(candidate.values[8]).toEqual({ value: 'E' });
    expect(candidate.values[16]).toEqual({ value: '2026-10' });
    expect(candidate.values[19]).toEqual({ value: 1 });
    expect(candidate.values[20]).toEqual({ value: 2_000_000 });
    expect(candidate.unresolvedFields).toEqual([]);
  });

  it('maps the type 2 header from PILA v4 snapshots', () => {
    const input = snapshot();
    input.payloadVersion = 4;
    (input.payload as { schemaVersion: number }).schemaVersion = 4;

    const candidate = mapCandidateForDemoScope([input]);

    expect(candidate.supportedSnapshots).toBe(true);
    expect(candidate.values[16]).toEqual({ value: '2026-10' });
  });

  it('accepts PILA v5 snapshots for the type 2 header', () => {
    const input = snapshot();
    input.payloadVersion = 5;
    (input.payload as { schemaVersion: number }).schemaVersion = 5;

    const candidate = mapCandidateForDemoScope([input]);

    expect(candidate.supportedSnapshots).toBe(true);
  });

  it('accepts PILA v6 snapshots for the type 2 header', () => {
    const input = snapshot();
    input.payloadVersion = 6;
    (input.payload as { schemaVersion: number }).schemaVersion = 6;

    const candidate = mapCandidateForDemoScope([input]);

    expect(candidate.supportedSnapshots).toBe(true);
  });

  it('rejects a header snapshot whose payload and schema versions disagree', () => {
    const input = snapshot();
    input.payloadVersion = 3;

    const candidate = mapCandidateForDemoScope([input]);

    expect(candidate.supportedSnapshots).toBe(false);
    expect(candidate.unresolvedFields).toHaveLength(22);
    expect(candidate.unresolvedFields[0]?.reason).toContain('PILA v2 a v8');
  });

  it('aggregates distinct standard cotizantes and their frozen CCF IBCs', () => {
    const second = snapshot('employee-2');
    payloadOf(second).payroll.ibcPorSubsistema.cajaCompensacion.valor =
      3_000_000;

    const candidate = mapCandidateForDemoScope([snapshot(), second]);

    expect(candidate.values[19]).toEqual({ value: 2 });
    expect(candidate.values[20]).toEqual({ value: 5_000_000 });
  });

  it('keeps operator-assigned fields as blank candidates, not snapshot data', () => {
    const candidate = mapCandidateForDemoScope([snapshot()]);

    for (const fieldNumber of [2, 15, 17, 18, 22]) {
      expect(candidate.values[fieldNumber]).toEqual({
        value: null,
        emptyAs: 'spaces',
      });
      expect(candidate.unresolvedFields).not.toContainEqual(
        expect.objectContaining({ fieldNumber }),
      );
    }
  });

  it('blocks a type 2 header ARL code that exceeds the field width', () => {
    const input = snapshot();
    payloadOf(input).employer.pila.codigoArlAportante = 'ARL0001';

    const candidate = mapCandidateForDemoScope([input]);

    expect(candidate.values[14]).toBeUndefined();
    const unresolvedArlField = candidate.unresolvedFields.find(
      (field) => field.fieldNumber === 14,
    );
    expect(unresolvedArlField?.code).toBe('AT2_HEADER_FIELD_LAYOUT_INVALID');
    expect(unresolvedArlField?.reason).toContain(
      'supera la longitud de 6 posiciones',
    );
    expect(candidate.values[4]).toEqual({ value: 'Empresa Demo SAS' });
    expect(candidate.values[16]).toEqual({ value: '2026-10' });
  });

  it('refuses to map a mixed-tenant snapshot set', () => {
    const second = snapshot('employee-2');
    payloadOf(second).employer.tenantId = 'tenant-2';

    const candidate = mapCandidateForDemoScope([snapshot(), second]);

    expect(candidate.supportedSnapshots).toBe(false);
    expect(candidate.tenantId).toBeNull();
    expect(candidate.values).toEqual({});
  });

  it('refuses a snapshot set that belongs to a different authenticated tenant', () => {
    const candidate = mapCandidateForDemoScope(
      [snapshot()],
      expectedPeriod,
      'tenant-2',
    );

    expect(candidate.supportedSnapshots).toBe(false);
    expect(candidate.tenantId).toBeNull();
    expect(candidate.payrollPeriodId).toBeNull();
    expect(candidate.values).toEqual({});
  });

  it('refuses snapshots whose frozen period differs from the approved period id', () => {
    const stale = snapshot();
    payloadOf(stale).period.payrollPeriodId = 'period-other';

    const candidate = mapCandidateForDemoScope([stale]);

    expect(candidate.supportedSnapshots).toBe(false);
    expect(candidate.tenantId).toBeNull();
    expect(candidate.values).toEqual({});
  });

  it('refuses snapshots whose frozen dates differ from the approved period', () => {
    const stale = snapshot();
    payloadOf(stale).period.fechaFin = '2026-10-30';

    const candidate = mapCandidateForDemoScope([stale]);

    expect(candidate.supportedSnapshots).toBe(false);
    expect(candidate.tenantId).toBeNull();
    expect(candidate.values).toEqual({});
  });

  it('fails closed when authenticated tenant context is missing', () => {
    const candidate = mapCandidateForDemoScope(
      [snapshot()],
      expectedPeriod,
      null,
    );

    expect(candidate.supportedSnapshots).toBe(false);
    expect(candidate.tenantId).toBeNull();
    expect(candidate.values).toEqual({});
  });

  it('does not select between duplicate employee snapshots to form totals', () => {
    const candidate = mapCandidateForDemoScope([snapshot(), snapshot()]);

    expect(candidate.values[19]).toBeUndefined();
    expect(candidate.values[20]).toBeUndefined();
    expect(candidate.unresolvedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldNumber: 19 }),
        expect.objectContaining({ fieldNumber: 20 }),
      ]),
    );
  });

  it('blocks totals for nonstandard contributor sources', () => {
    const nonstandard = snapshot();
    payloadOf(nonstandard).affiliations[0].tipoCotizanteCodigo = '02';

    const candidate = mapCandidateForDemoScope([nonstandard]);

    expect(candidate.values[19]).toBeUndefined();
    expect(candidate.values[20]).toBeUndefined();
  });

  it('does not map a health period from an incomplete calendar month', () => {
    const partialPeriod = snapshot();
    payloadOf(partialPeriod).period.fechaFin = '2026-10-30';

    const candidate = mapCandidateForDemoScope([partialPeriod], {
      ...expectedPeriod,
      fechaFin: new Date('2026-10-30T00:00:00.000Z'),
    });

    expect(candidate.supportedSnapshots).toBe(true);
    expect(candidate.values[16]).toBeUndefined();
  });
});
