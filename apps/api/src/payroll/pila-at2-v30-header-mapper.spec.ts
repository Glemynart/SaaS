import type { PilaSnapshotPreparationInput } from './pila-preparation';
import { mapPilaAt2V30HeaderCandidate } from './pila-at2-v30-header-mapper';

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
        payrollRunId: 'run-1',
        ibcPorSubsistema: { cajaCompensacion: { valor: 2_000_000 } },
      },
    },
  };
}

function mapCandidate(
  snapshots: readonly PilaSnapshotPreparationInput[],
  expectedApprovedSnapshotCount = snapshots.length,
) {
  return mapPilaAt2V30HeaderCandidate({
    snapshots,
    expectedApprovedSnapshotCount,
  });
}

function payloadOf(snapshotInput: PilaSnapshotPreparationInput) {
  return snapshotInput.payload as {
    employer: { tenantId: string; [key: string]: unknown };
    period: { payrollPeriodId: string; [key: string]: unknown };
    employee: { employeeId: string };
    affiliations: Array<Record<string, unknown>>;
    payroll: {
      payrollRunId: string;
      ibcPorSubsistema: { cajaCompensacion: { valor: number } };
    };
    [key: string]: unknown;
  };
}

describe('mapPilaAt2V30HeaderCandidate', () => {
  it('maps constants, shared employer data, period and totals from a complete snapshot set', () => {
    const candidate = mapCandidate([snapshot()]);

    expect(candidate).toMatchObject({
      formatVersion: 'AT2_V30',
      supportedSnapshots: true,
      tenantId: 'tenant-1',
      payrollPeriodId: 'period-1',
      payrollRunId: 'run-1',
      snapshotCountMatchesExpected: true,
    });
    expect(candidate.values).toMatchObject({
      1: { value: '01' },
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
      16: { value: '2026-10' },
      19: { value: 1 },
      20: { value: 2_000_000 },
      21: { value: '1' },
    });
    expect(candidate.values[2]).toBeUndefined();
    expect(candidate.values[15]).toBeUndefined();
    expect(candidate.values[17]).toBeUndefined();
    expect(candidate.values[18]).toBeUndefined();
    expect(candidate.values[22]).toBeUndefined();
  });

  it('aggregates distinct standard cotizantes and their frozen CCF IBCs', () => {
    const second = snapshot('employee-2');
    payloadOf(second).payroll.ibcPorSubsistema.cajaCompensacion.valor =
      3_000_000;

    const candidate = mapCandidate([snapshot(), second]);

    expect(candidate.values[19]).toEqual({ value: 2 });
    expect(candidate.values[20]).toEqual({ value: 5_000_000 });
  });

  it('keeps fields assigned by the operator unresolved', () => {
    const candidate = mapCandidate([snapshot()]);

    expect(
      candidate.unresolvedFields.map(({ fieldNumber }) => fieldNumber),
    ).toEqual(expect.arrayContaining([2, 15, 17, 18, 22]));
  });

  it('refuses to map a mixed-tenant snapshot set', () => {
    const second = snapshot('employee-2');
    payloadOf(second).employer.tenantId = 'tenant-2';

    const candidate = mapCandidate([snapshot(), second]);

    expect(candidate.supportedSnapshots).toBe(false);
    expect(candidate.tenantId).toBeNull();
    expect(candidate.values).toEqual({});
  });

  it('does not select between duplicate employee snapshots to form totals', () => {
    const candidate = mapCandidate([snapshot(), snapshot()]);

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

    const candidate = mapCandidate([nonstandard]);

    expect(candidate.values[19]).toBeUndefined();
    expect(candidate.values[20]).toBeUndefined();
  });

  it('does not map a health period from an incomplete calendar month', () => {
    const partialPeriod = snapshot();
    payloadOf(partialPeriod).period.fechaFin = '2026-10-30';

    const candidate = mapCandidate([partialPeriod]);

    expect(candidate.supportedSnapshots).toBe(true);
    expect(candidate.values[16]).toBeUndefined();
  });

  it('blocks totals when the snapshot set is smaller than the approved run', () => {
    const candidate = mapCandidate([snapshot()], 2);

    expect(candidate.snapshotCountMatchesExpected).toBe(false);
    expect(candidate.values[19]).toBeUndefined();
    expect(candidate.values[20]).toBeUndefined();
  });

  it('refuses to combine snapshots from separate payroll runs', () => {
    const second = snapshot('employee-2');
    payloadOf(second).payroll.payrollRunId = 'run-2';

    const candidate = mapCandidate([snapshot(), second]);

    expect(candidate.supportedSnapshots).toBe(false);
    expect(candidate.payrollRunId).toBeNull();
    expect(candidate.values).toEqual({});
  });
});
