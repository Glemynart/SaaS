import {
  PILA_RISK_ACTIVITY_CATALOG_VERSION,
  PILA_RISK_ACTIVITY_CODES,
} from './pila-risk-activity-catalog';
import type { PilaSnapshotPreparationInput } from './pila-preparation';
import { mapPilaAt2V30DetailCandidate } from './pila-at2-v30-detail-mapper';

const riskActivityCode = [...PILA_RISK_ACTIVITY_CODES].find(
  (code) => code[0] === '2',
);

function snapshot(): PilaSnapshotPreparationInput {
  return {
    employeeId: 'employee-1',
    payloadVersion: 2,
    payload: {
      schemaVersion: 2,
      period: {
        payrollPeriodId: 'period-1',
        fechaInicio: '2026-10-01',
        fechaFin: '2026-10-31',
      },
      employer: { tenantId: 'tenant-1', pila: {} },
      employee: {
        employeeId: 'employee-1',
        tipoDocumento: 'CC',
        cedula: '0012345678',
        fechaIngreso: '2026-01-01',
        fechaRetiro: null,
        primerNombre: 'Ana',
        segundoNombre: null,
        primerApellido: 'Pérez',
        segundoApellido: null,
      },
      contract: {
        contractId: 'contract-1',
        fechaInicio: '2026-01-01',
        fechaFin: null,
      },
      affiliations: [
        {
          tipoCotizanteCodigo: '01',
          subtipoCotizanteCodigo: '00',
          fondoPensionCodigo: 'AFP001',
          epsCodigo: 'EPS001',
          cajaCompensacionCodigo: 'CCF001',
          arlCodigo: 'ARL001',
          arlClaseRiesgo: '2',
          vigenteDesde: '2026-01-01',
          vigenteHasta: null,
        },
      ],
      pilaRiskAssignments: [
        {
          tenantId: 'tenant-1',
          codigoActividadEconomica: riskActivityCode,
          formatoNormativoVersion: PILA_RISK_ACTIVITY_CATALOG_VERSION,
          vigenteDesde: '2026-01-01',
          vigenteHasta: null,
          centroTrabajo: {
            tenantId: 'tenant-1',
            arlCodigo: 'ARL001',
            codigoCentro: '00012',
          },
        },
      ],
      payroll: {
        diasCotizadosPorSubsistema: {
          pension: {
            valor: 30,
            reglaVersion: 'PILA_FULL_MONTH_DAYS_V1',
            bloqueos: [],
          },
          salud: {
            valor: 30,
            reglaVersion: 'PILA_FULL_MONTH_DAYS_V1',
            bloqueos: [],
          },
          riesgos: {
            valor: 30,
            reglaVersion: 'PILA_FULL_MONTH_DAYS_V1',
            bloqueos: [],
          },
          cajaCompensacion: {
            valor: 30,
            reglaVersion: 'PILA_FULL_MONTH_DAYS_V1',
            bloqueos: [],
          },
        },
        salarioBasicoCampo40: { valor: 2_000_000, bloqueos: [] },
        tipoSalario: 'F',
        tipoSalarioBloqueos: [],
        ibcPorSubsistema: {
          pension: { valor: 2_000_000, sourceCount: 1 },
          salud: { valor: 2_000_000, sourceCount: 1 },
          riesgos: { valor: 2_000_000, sourceCount: 1 },
          cajaCompensacion: { valor: 2_000_000, sourceCount: 1 },
          otrosParafiscales: {
            valor: 2_000_000,
            reglaVersion: 'CO_PARAFISCAL_BASE_V1',
            bloqueos: [],
          },
        },
      },
    },
  };
}

function payloadOf(snapshotInput: PilaSnapshotPreparationInput) {
  return snapshotInput.payload as {
    affiliations: Array<Record<string, unknown>>;
    employee: Record<string, unknown>;
    payroll: {
      ibcPorSubsistema: Record<string, Record<string, unknown>>;
    };
    pilaRiskAssignments: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
}

const invalidRiskAssignmentCases: Array<{
  name: string;
  mutate: (assignment: Record<string, unknown>) => void;
}> = [
  {
    name: 'center belongs to another tenant',
    mutate: (assignment) => {
      (assignment.centroTrabajo as Record<string, unknown>).tenantId =
        'tenant-2';
    },
  },
  {
    name: 'center ARL differs from the employee affiliation',
    mutate: (assignment) => {
      (assignment.centroTrabajo as Record<string, unknown>).arlCodigo =
        'ARL002';
    },
  },
  {
    name: 'assignment starts after the period begins',
    mutate: (assignment) => {
      assignment.vigenteDesde = '2026-10-02';
    },
  },
  {
    name: 'assignment ends before the period ends',
    mutate: (assignment) => {
      assignment.vigenteHasta = '2026-10-30';
    },
  },
  {
    name: 'activity catalog version is unsupported',
    mutate: (assignment) => {
      assignment.formatoNormativoVersion = 'DECRETO_768_2022_OLD';
    },
  },
  {
    name: 'activity code is outside the catalog',
    mutate: (assignment) => {
      assignment.codigoActividadEconomica = 'INVALID';
    },
  },
];

describe('mapPilaAt2V30DetailCandidate', () => {
  it('maps direct identity, affiliation, days, bases, salary and ARL snapshot values', () => {
    const candidate = mapPilaAt2V30DetailCandidate(snapshot());

    expect(candidate).toMatchObject({
      supportedSnapshot: true,
      tenantId: 'tenant-1',
      payrollPeriodId: 'period-1',
    });
    expect(candidate.values).toMatchObject({
      1: { value: '02' },
      2: { value: '1' },
      3: { value: 'CC' },
      4: { value: '0012345678' },
      5: { value: '01' },
      6: { value: '00' },
      11: { value: 'Pérez' },
      12: { value: null, emptyAs: 'spaces' },
      13: { value: 'Ana' },
      14: { value: null, emptyAs: 'spaces' },
      31: { value: 'AFP001' },
      33: { value: 'EPS001' },
      35: { value: 'CCF001' },
      36: { value: 30 },
      37: { value: 30 },
      38: { value: 30 },
      39: { value: 30 },
      40: { value: 2_000_000 },
      41: { value: 'F' },
      42: { value: 2_000_000 },
      43: { value: 2_000_000 },
      44: { value: 2_000_000 },
      45: { value: 2_000_000 },
      62: { value: '00012' },
      77: { value: 'ARL001' },
      78: { value: '2' },
      95: { value: 2_000_000 },
      98: { value: riskActivityCode },
    });
    expect(candidate.values[46]).toBeUndefined();
    expect(
      candidate.unresolvedFields.map(({ fieldNumber }) => fieldNumber),
    ).toEqual(expect.arrayContaining([46, 47, 48, 76, 96, 97]));
  });

  it('does not map days or affiliations for a nonstandard cotizante', () => {
    const input = snapshot();
    payloadOf(input).affiliations[0].tipoCotizanteCodigo = '02';

    const candidate = mapPilaAt2V30DetailCandidate(input);

    expect(candidate.values[1]).toBeUndefined();
    expect(candidate.values[5]).toBeUndefined();
    expect(candidate.values[31]).toBeUndefined();
    expect(candidate.values[36]).toBeUndefined();
  });

  it('preserves numeric identifier and work center leading zeros', () => {
    const candidate = mapPilaAt2V30DetailCandidate(snapshot());

    expect(candidate.values[4]).toEqual({ value: '0012345678' });
    expect(candidate.values[62]).toEqual({ value: '00012' });
  });

  it('leaves IBC candidate unresolved when more than one concept supplied it', () => {
    const input = snapshot();
    payloadOf(input).payroll.ibcPorSubsistema.pension.sourceCount = 2;

    const candidate = mapPilaAt2V30DetailCandidate(input);

    expect(candidate.values[42]).toBeUndefined();
    expect(candidate.unresolvedFields).toEqual(
      expect.arrayContaining([expect.objectContaining({ fieldNumber: 42 })]),
    );
  });

  it('does not map a work center assigned to another tenant', () => {
    const input = snapshot();
    payloadOf(input).pilaRiskAssignments[0].tenantId = 'tenant-2';

    const candidate = mapPilaAt2V30DetailCandidate(input);

    expect(candidate.values[62]).toBeUndefined();
    expect(candidate.values[98]).toBeUndefined();
  });

  it.each(invalidRiskAssignmentCases)(
    'leaves ARL fields unresolved when the $name',
    ({ mutate }) => {
      const input = snapshot();
      mutate(payloadOf(input).pilaRiskAssignments[0]);

      const candidate = mapPilaAt2V30DetailCandidate(input);

      expect(candidate.values[62]).toBeUndefined();
      expect(candidate.values[98]).toBeUndefined();
    },
  );

  it('leaves only the work center field unresolved when its code is not numeric', () => {
    const input = snapshot();
    const center = payloadOf(input).pilaRiskAssignments[0]
      .centroTrabajo as Record<string, unknown>;
    center.codigoCentro = 'ARL-CENTER-12';

    const candidate = mapPilaAt2V30DetailCandidate(input);

    expect(candidate.values[62]).toBeUndefined();
    expect(candidate.values[98]).toEqual({ value: riskActivityCode });
  });

  it('does not map ARL fields when activity class differs from the affiliation', () => {
    const input = snapshot();
    payloadOf(input).affiliations[0].arlClaseRiesgo = '3';

    const candidate = mapPilaAt2V30DetailCandidate(input);

    expect(candidate.values[62]).toBeUndefined();
    expect(candidate.values[98]).toBeUndefined();
  });

  it('does not map unsupported snapshot versions', () => {
    const input = snapshot();
    input.payloadVersion = 1;

    const candidate = mapPilaAt2V30DetailCandidate(input);

    expect(candidate.supportedSnapshot).toBe(false);
    expect(candidate.values).toEqual({});
    expect(candidate.unresolvedFields).toHaveLength(98);
  });
});
