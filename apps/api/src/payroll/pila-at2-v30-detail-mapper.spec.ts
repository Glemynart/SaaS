import {
  PILA_RISK_ACTIVITY_CATALOG_VERSION,
  PILA_RISK_ACTIVITY_CODES,
} from './pila-risk-activity-catalog';
import { PILA_AT2_V30_RECORD_LAYOUTS } from './pila-at2-v30-record-serializer';
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
          indicadorTarifaEspecialPensiones: '',
          epsCodigo: 'EPS001',
          cajaCompensacionCodigo: 'CCF001',
          cajaCompensacionDepartamentoCodigo: '11',
          arlCodigo: 'ARL001',
          arlClaseRiesgo: '2',
          extranjeroNoObligadoPension: null,
          colombianoEnElExterior: null,
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
      pilaEvents: [],
      payroll: {
        pilaEvents: [],
        novelties: [],
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
    employer: {
      aportesExonerados?: unknown;
      pila: Record<string, unknown>;
    };
    employee: Record<string, unknown>;
    payroll: {
      ibcPorSubsistema: Record<string, Record<string, unknown>>;
      concepts?: Array<Record<string, unknown>>;
      [key: string]: unknown;
    };
    pilaRiskAssignments: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
}

function setStandardPensionInputs(
  snapshotInput: PilaSnapshotPreparationInput,
  overrides: {
    employeeType?: string;
    base?: number;
    employeeFactor?: number;
    employeeAmount?: number;
    employerFactor?: number;
    employerAmount?: number;
    paymentDate?: string | null;
    employerNature?: string;
    employerType?: string;
    foreignExemption?: boolean | null;
    exteriorDeclaration?: boolean | null;
  } = {},
) {
  const payload = payloadOf(snapshotInput);
  const base = overrides.base ?? 2_000_000;
  payload.employee.tipoDocumento = overrides.employeeType ?? 'CC';
  payload.affiliations[0].colombianoEnElExterior =
    overrides.exteriorDeclaration === undefined
      ? false
      : overrides.exteriorDeclaration;
  payload.affiliations[0].extranjeroNoObligadoPension =
    overrides.foreignExemption ?? null;
  Object.assign(payload.employer.pila, {
    tipoAportante: overrides.employerType ?? '1',
    naturalezaJuridica: overrides.employerNature ?? '2',
  });
  Object.assign(payload.payroll.ibcPorSubsistema.pension, { valor: base });
  Object.assign(payload.payroll, {
    fechaPrevistaPagoPila:
      overrides.paymentDate === undefined
        ? '2026-11-06'
        : overrides.paymentDate,
    concepts: [
      {
        codigo: 'PENSION_EMP',
        tipo: 'DEDUCTION',
        base,
        factor: overrides.employeeFactor ?? 0.04,
        valor: overrides.employeeAmount ?? 80_000,
      },
      {
        codigo: 'PENSION_PAT',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base,
        factor: overrides.employerFactor ?? 0.12,
        valor: overrides.employerAmount ?? 240_000,
      },
    ],
  });
}

function setVoluntaryPensionDeclaration(
  snapshotInput: PilaSnapshotPreparationInput,
  options: {
    status?: string;
    declaredAt?: string | null;
    declaredById?: string | null;
    paymentDate?: string | null;
  } = {},
) {
  const payload = payloadOf(snapshotInput);
  snapshotInput.payloadVersion = 8;
  payload.schemaVersion = 8;
  Object.assign(payload.payroll, {
    fechaPrevistaPagoPila:
      options.paymentDate === undefined ? '2026-11-06' : options.paymentDate,
    voluntaryPensionDeclaration: {
      status: options.status ?? 'NONE_CONFIRMED',
      declaredAt:
        options.declaredAt === undefined
          ? '2026-11-04T12:00:00.000Z'
          : options.declaredAt,
      declaredById:
        options.declaredById === undefined
          ? 'payroll-user-1'
          : options.declaredById,
    },
  });
}

function setStandardHealthInputs(
  snapshotInput: PilaSnapshotPreparationInput,
  overrides: {
    base?: number;
    employeeDocument?: string;
    employeeFactor?: number;
    employeeAmount?: number;
    employerFactor?: number;
    employerAmount?: number;
    employerExemption?: boolean | null;
    employerConfirmation?: boolean | null;
    employerNature?: string;
    exteriorDeclaration?: boolean | null;
  } = {},
) {
  const payload = payloadOf(snapshotInput);
  const base = overrides.base ?? 2_000_000;
  payload.employee.tipoDocumento = overrides.employeeDocument ?? 'CC';
  payload.affiliations[0].colombianoEnElExterior =
    overrides.exteriorDeclaration === undefined
      ? false
      : overrides.exteriorDeclaration;
  payload.affiliations[0].extranjeroNoObligadoPension = null;
  payload.employer.aportesExonerados =
    overrides.employerExemption === undefined
      ? false
      : overrides.employerExemption;
  Object.assign(payload.employer.pila, {
    tipoAportante: '1',
    naturalezaJuridica: overrides.employerNature ?? '2',
    aportesExoneradosConfirmado:
      overrides.employerConfirmation === undefined
        ? false
        : overrides.employerConfirmation,
  });
  Object.assign(payload.payroll.ibcPorSubsistema.salud, { valor: base });
  Object.assign(payload.payroll, {
    concepts: [
      {
        codigo: 'SALUD_EMP',
        tipo: 'DEDUCTION',
        base,
        factor: overrides.employeeFactor ?? 0.04,
        valor: overrides.employeeAmount ?? 80_000,
      },
      {
        codigo: 'SALUD_PAT',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base,
        factor: overrides.employerFactor ?? 0.085,
        valor: overrides.employerAmount ?? 170_000,
      },
    ],
  });
}

function setStandardFspSubaccounts(
  snapshotInput: PilaSnapshotPreparationInput,
  overrides: {
    sourceScope?: string;
    status?: string;
    solidarity?: number;
    subsistence?: number;
    payrollFspAmount?: number;
    ibcPensionalAgregado?: number;
    blocker?: string | null;
  } = {},
) {
  const payload = payloadOf(snapshotInput);
  Object.assign(payload.payroll, {
    fspSubaccounts: {
      sourceScope: overrides.sourceScope ?? 'SINGLE_SOURCE_CONFIRMED',
      sourceScopeUpdatedAt: '2026-11-03T12:00:00.000Z',
      sourceScopeUpdatedById: 'payroll-user-1',
      status: overrides.status ?? 'READY',
      blocker: overrides.blocker ?? null,
      ruleVersion: 'CO_FSP_SUBACCOUNTS_DEC1833_PRE_2027_04_01_V1',
      roundingRuleVersion:
        'CO_PILA_CONTRIBUTION_ROUND_UP_100_DEC1990_ART3_2_1_5_V1',
      ibcPensionalAgregado: overrides.ibcPensionalAgregado ?? 4_000_000,
      smmlv: 1_000_000,
      solidaridad: overrides.solidarity ?? 20_000,
      subsistencia: overrides.subsistence ?? 20_000,
      payrollFspAmount: overrides.payrollFspAmount ?? 40_000,
    },
  });
}

function setHistoricalPilaPeriod(snapshotInput: PilaSnapshotPreparationInput) {
  const payload = payloadOf(snapshotInput);
  Object.assign(payload.period as Record<string, unknown>, {
    fechaInicio: '2025-06-01',
    fechaFin: '2025-06-30',
  });
  payload.employee.fechaIngreso = '2025-01-01';
  Object.assign(payload.contract as Record<string, unknown>, {
    fechaInicio: '2025-01-01',
  });
  for (const affiliation of payload.affiliations) {
    affiliation.vigenteDesde = '2025-01-01';
  }
  for (const assignment of payload.pilaRiskAssignments) {
    assignment.vigenteDesde = '2025-01-01';
  }
}

function setStandardCcfEmployer(
  snapshotInput: PilaSnapshotPreparationInput,
  overrides: {
    claseAportante?: string;
    beneficioLey1429?: boolean | null;
    beneficioCcfLey1429?: boolean | null;
    naturalezaJuridica?: string;
    tipoAportante?: string;
  } = {},
) {
  const payload = snapshotInput.payload as {
    employer: { pila: Record<string, unknown> };
  };
  Object.assign(payload.employer.pila, {
    claseAportante: overrides.claseAportante ?? 'B',
    beneficioLey1429:
      overrides.beneficioLey1429 === undefined
        ? false
        : overrides.beneficioLey1429,
    beneficioCcfLey1429:
      overrides.beneficioCcfLey1429 === undefined
        ? false
        : overrides.beneficioCcfLey1429,
    naturalezaJuridica: overrides.naturalezaJuridica ?? '2',
    tipoAportante: overrides.tipoAportante ?? '1',
  });
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
function mapCandidate(
  input: PilaSnapshotPreparationInput,
  planillaType: string | null = 'E',
  periodStart = '2026-10-01',
  periodEnd = '2026-10-31',
) {
  return mapPilaAt2V30DetailCandidate(input, {
    expectedTenantId: 'tenant-1',
    planillaType,
    period: {
      id: 'period-1',
      fechaInicio: new Date(`${periodStart}T00:00:00.000Z`),
      fechaFin: new Date(`${periodEnd}T00:00:00.000Z`),
    },
  });
}

describe('mapPilaAt2V30DetailCandidate', () => {
  it('accepts a PILA v4 snapshot for the candidates supported by its source data', () => {
    const input = snapshot();
    input.payloadVersion = 4;
    (input.payload as { schemaVersion: number }).schemaVersion = 4;

    const candidate = mapCandidate(input);

    expect(candidate.supportedSnapshot).toBe(true);
    expect(candidate.values[1]).toBeDefined();
  });

  it('leaves detail sequence pending until the complete file scope is known', () => {
    const candidate = mapCandidate(snapshot());

    expect(candidate.values[1]).toEqual({ value: '02' });
    expect(candidate.values[2]).toBeUndefined();
    expect(candidate.normativeRuleVersions.detailRecordSequence).toBeNull();
    expect(candidate.unresolvedFields).toContainEqual({
      fieldNumber: 2,
      reason:
        'La secuencia se asigna al conjunto completo de registros tipo 2, no a cada empleado por separado.',
    });
  });

  it('accepts a PILA v5 snapshot with versioned FSP boundary semantics', () => {
    const input = snapshot();
    input.payloadVersion = 5;
    (input.payload as { schemaVersion: number }).schemaVersion = 5;

    const candidate = mapCandidate(input);

    expect(candidate.supportedSnapshot).toBe(true);
  });

  it('maps FSP subaccounts from a v6 snapshot after source and amount reconciliation', () => {
    const input = snapshot();
    setHistoricalPilaPeriod(input);
    input.payloadVersion = 6;
    (input.payload as { schemaVersion: number }).schemaVersion = 6;
    setStandardPensionInputs(input, {
      base: 4_000_000,
      employeeAmount: 160_000,
      employerAmount: 480_000,
      paymentDate: '2025-07-01',
    });
    const payload = payloadOf(input);
    payload.payroll.concepts?.push({
      codigo: 'FSP',
      tipo: 'DEDUCTION',
      base: 4_000_000,
      factor: 0.01,
      valor: 40_000,
    });
    setStandardFspSubaccounts(input);

    const candidate = mapCandidate(input, 'E', '2025-06-01', '2025-06-30');

    expect(candidate.values[51]).toEqual({ value: 20_000 });
    expect(candidate.values[52]).toEqual({ value: 20_000 });
    expect(candidate.normativeRuleVersions.fspSubaccounts).toBe(
      'CO_FSP_SUBACCOUNTS_DEC1833_PRE_2027_04_01_V1',
    );
  });

  it.each([
    ['source scope is unconfirmed', { sourceScope: 'UNCONFIRMED' }],
    [
      'source scope has multiple income sources',
      { sourceScope: 'MULTIPLE_SOURCES' },
    ],
    ['frozen IBC does not match', { ibcPensionalAgregado: 4_100_000 }],
    ['subaccounts do not reconcile', { payrollFspAmount: 41_000 }],
  ])('keeps FSP fields blocked when %s', (_case, overrides) => {
    const input = snapshot();
    setHistoricalPilaPeriod(input);
    input.payloadVersion = 6;
    (input.payload as { schemaVersion: number }).schemaVersion = 6;
    setStandardPensionInputs(input, {
      base: 4_000_000,
      employeeAmount: 160_000,
      employerAmount: 480_000,
      paymentDate: '2025-07-01',
    });
    const payload = payloadOf(input);
    payload.payroll.concepts?.push({
      codigo: 'FSP',
      tipo: 'DEDUCTION',
      base: 4_000_000,
      factor: 0.01,
      valor: 40_000,
    });
    setStandardFspSubaccounts(input, overrides);

    const candidate = mapCandidate(input, 'E', '2025-06-01', '2025-06-30');

    expect(candidate.values[51]).toBeUndefined();
    expect(candidate.values[52]).toBeUndefined();
    expect(
      candidate.unresolvedFields.map(({ fieldNumber }) => fieldNumber),
    ).toEqual(expect.arrayContaining([51, 52]));
  });

  it('maps READY FSP snapshots in July 2025 under the suspended Resolution 467 amendments', () => {
    const input = snapshot();
    setHistoricalPilaPeriod(input);
    input.payloadVersion = 6;
    (input.payload as { schemaVersion: number }).schemaVersion = 6;
    setStandardPensionInputs(input, {
      base: 4_000_000,
      employeeAmount: 160_000,
      employerAmount: 480_000,
      paymentDate: '2025-08-01',
    });
    const payload = payloadOf(input);
    (payload.period as Record<string, unknown>).fechaInicio = '2025-07-01';
    (payload.period as Record<string, unknown>).fechaFin = '2025-07-31';
    payload.employee.fechaIngreso = '2025-01-01';
    (payload.contract as Record<string, unknown>).fechaInicio = '2025-01-01';
    payload.affiliations[0].vigenteDesde = '2025-01-01';
    payload.payroll.concepts?.push({
      codigo: 'FSP',
      tipo: 'DEDUCTION',
      base: 4_000_000,
      factor: 0.01,
      valor: 40_000,
    });
    setStandardFspSubaccounts(input);

    const candidate = mapCandidate(input, 'E', '2025-07-01', '2025-07-31');
    const fspBlockers = candidate.unresolvedFields.filter(({ fieldNumber }) =>
      [51, 52].includes(fieldNumber),
    );

    expect(candidate.values[51]).toEqual({ value: 20_000 });
    expect(candidate.values[52]).toEqual({ value: 20_000 });
    expect(fspBlockers).toHaveLength(0);
  });

  it('keeps READY FSP snapshots blocked when the period reaches the new regime', () => {
    const input = snapshot();
    input.payloadVersion = 6;
    (input.payload as { schemaVersion: number }).schemaVersion = 6;
    setStandardPensionInputs(input, {
      base: 4_000_000,
      employeeAmount: 160_000,
      employerAmount: 480_000,
      paymentDate: '2027-04-01',
    });
    const payload = payloadOf(input);
    (payload.period as Record<string, unknown>).fechaInicio = '2027-03-01';
    (payload.period as Record<string, unknown>).fechaFin = '2027-03-31';
    payload.payroll.concepts?.push({
      codigo: 'FSP',
      tipo: 'DEDUCTION',
      base: 4_000_000,
      factor: 0.01,
      valor: 40_000,
    });
    setStandardFspSubaccounts(input);

    const candidate = mapCandidate(input, 'E', '2027-03-01', '2027-03-31');
    const fspBlockers = candidate.unresolvedFields.filter(({ fieldNumber }) =>
      [51, 52].includes(fieldNumber),
    );

    expect(candidate.values[51]).toBeUndefined();
    expect(candidate.values[52]).toBeUndefined();
    expect(fspBlockers).toHaveLength(2);
    expect(fspBlockers[0].reason).toContain('2027-04-01');
  });

  it('accounts for every AT2 detail field as a candidate or an explicit blocker', () => {
    const candidate = mapCandidate(snapshot());
    const layoutFields =
      PILA_AT2_V30_RECORD_LAYOUTS.contributorDetailType2.fields
        .map(({ fieldNumber }) => fieldNumber)
        .sort((left, right) => left - right);
    const candidateFields = Object.keys(candidate.values)
      .map(Number)
      .sort((left, right) => left - right);
    const unresolvedFields = candidate.unresolvedFields
      .map(({ fieldNumber }) => fieldNumber)
      .sort((left, right) => left - right);

    expect(new Set(candidateFields).size).toBe(candidateFields.length);
    expect(new Set(unresolvedFields).size).toBe(unresolvedFields.length);
    expect(
      candidateFields.filter((field) => unresolvedFields.includes(field)),
    ).toEqual([]);
    expect(
      [...candidateFields, ...unresolvedFields].sort(
        (left, right) => left - right,
      ),
    ).toEqual(layoutFields);
  });

  it('withholds detail candidates that cannot fit the AT2 field layout', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    payload.employee.primerApellido = 'A'.repeat(21);
    payload.affiliations[0].fondoPensionCodigo = 'AFP0001';

    const candidate = mapCandidate(input);
    const unresolvedReasonByField = new Map(
      candidate.unresolvedFields.map(({ fieldNumber, reason }) => [
        fieldNumber,
        reason,
      ]),
    );

    expect(candidate.values[11]).toBeUndefined();
    expect(candidate.values[31]).toBeUndefined();
    expect(unresolvedReasonByField.get(11)).toContain(
      'supera la longitud de 20 posiciones',
    );
    expect(unresolvedReasonByField.get(31)).toContain(
      'supera la longitud de 6 posiciones',
    );
    expect(candidate.values[13]).toEqual({ value: 'Ana' });
  });

  it('keeps every AT2 detail field blocked for an unsupported snapshot', () => {
    const input = snapshot();
    input.payloadVersion = 1;

    const candidate = mapCandidate(input);
    const layoutFields =
      PILA_AT2_V30_RECORD_LAYOUTS.contributorDetailType2.fields
        .map(({ fieldNumber }) => fieldNumber)
        .sort((left, right) => left - right);

    expect(Object.keys(candidate.values)).toEqual([]);
    expect(
      candidate.unresolvedFields.map(({ fieldNumber }) => fieldNumber),
    ).toEqual(layoutFields);
  });

  it('leaves field 56 blank for a standard dependent because AT2 reserves it for cotizante 40', () => {
    const input = snapshot();
    const candidate = mapCandidate(input);

    expect(candidate.values[56]).toEqual({ value: null, emptyAs: 'spaces' });
    expect(
      candidate.unresolvedFields.some(({ fieldNumber }) => fieldNumber === 56),
    ).toBe(false);
  });

  it.each(['40', '69'])(
    'keeps field 56 unresolved for cotizante %s outside the MVP',
    (tipoCotizanteCodigo) => {
      const input = snapshot();
      payloadOf(input).affiliations[0].tipoCotizanteCodigo =
        tipoCotizanteCodigo;

      const candidate = mapCandidate(input);
      const field56 = candidate.unresolvedFields.find(
        ({ fieldNumber }) => fieldNumber === 56,
      );

      expect(candidate.values[56]).toBeUndefined();
      expect(field56?.reason).toContain(
        'reserva el campo 56 para cotizantes tipo 40',
      );
      expect(field56?.reason).toContain('fuera de alcance');
    },
  );

  it('maps fields 9 and 10 when the frozen work municipality matches the CCF department', () => {
    const input = snapshot();
    input.payloadVersion = 3;
    const payload = payloadOf(input) as {
      [key: string]: unknown;
      schemaVersion?: number;
      pilaWorkLocations?: unknown[];
    };
    payload.schemaVersion = 3;
    payload.pilaWorkLocations = [
      {
        assignmentId: 'work-location-1',
        tenantId: 'tenant-1',
        municipioId: 'municipality-1',
        municipio: {
          id: 'municipality-1',
          codigo: '11001',
          nombre: 'Bogotá, D.C.',
          departamento: 'Bogotá, D.C.',
        },
        vigenteDesde: '2026-01-01',
        vigenteHasta: null,
      },
    ];

    const candidate = mapCandidate(input);

    expect(candidate.supportedSnapshot).toBe(true);
    expect(candidate.values[9]).toEqual({ value: '11' });
    expect(candidate.values[10]).toEqual({ value: '001' });
    expect(candidate.unresolvedFields).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldNumber: 9 }),
        expect.objectContaining({ fieldNumber: 10 }),
      ]),
    );
  });

  it('blocks fields 9 and 10 when the frozen CCF department differs from the work municipality', () => {
    const input = snapshot();
    input.payloadVersion = 3;
    const payload = payloadOf(input) as {
      schemaVersion?: number;
      affiliations: Array<Record<string, unknown>>;
      pilaWorkLocations?: unknown[];
    };
    payload.schemaVersion = 3;
    payload.affiliations[0].cajaCompensacionDepartamentoCodigo = '08';
    payload.pilaWorkLocations = [
      {
        assignmentId: 'work-location-1',
        tenantId: 'tenant-1',
        municipioId: 'municipality-1',
        municipio: {
          id: 'municipality-1',
          codigo: '11001',
          nombre: 'Bogotá, D.C.',
          departamento: 'Bogotá, D.C.',
        },
        vigenteDesde: '2026-01-01',
        vigenteHasta: null,
      },
    ];

    const candidate = mapCandidate(input);

    expect(candidate.values[9]).toBeUndefined();
    expect(candidate.values[10]).toBeUndefined();
    expect(
      candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 9)
        ?.reason,
    ).toContain('no coincide con el departamento de la CCF afiliada');
  });

  it('keeps fields 9 and 10 blocked when the approved snapshot has no CCF department', () => {
    const input = snapshot();
    input.payloadVersion = 3;
    const payload = payloadOf(input) as {
      schemaVersion?: number;
      affiliations: Array<Record<string, unknown>>;
      pilaWorkLocations?: unknown[];
    };
    payload.schemaVersion = 3;
    payload.affiliations[0].cajaCompensacionDepartamentoCodigo = null;
    payload.pilaWorkLocations = [
      {
        assignmentId: 'work-location-1',
        tenantId: 'tenant-1',
        municipioId: 'municipality-1',
        municipio: { id: 'municipality-1', codigo: '11001' },
        vigenteDesde: '2026-01-01',
        vigenteHasta: null,
      },
    ];

    const candidate = mapCandidate(input);

    expect(candidate.values[9]).toBeUndefined();
    expect(candidate.values[10]).toBeUndefined();
    expect(
      candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 9)
        ?.reason,
    ).toContain('no conserva un departamento DIVIPOLA válido');
  });

  it('does not use a current worksite to fill fields 9 and 10 of historical v2 snapshots', () => {
    const candidate = mapCandidate(snapshot());

    expect(candidate.values[9]).toBeUndefined();
    expect(candidate.values[10]).toBeUndefined();
    expect(
      candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 9)
        ?.reason,
    ).toContain('no se completa desde la sede');
  });

  it('lists supported snapshot versions when the frozen work location is malformed', () => {
    const input = snapshot();
    input.payloadVersion = 7;
    const payload = payloadOf(input) as {
      schemaVersion?: number;
      pilaWorkLocations?: unknown[];
    };
    payload.schemaVersion = 7;
    delete payload.pilaWorkLocations;

    const candidate = mapCandidate(input);
    const reason = candidate.unresolvedFields.find(
      ({ fieldNumber }) => fieldNumber === 9,
    )?.reason;

    expect(candidate.supportedSnapshot).toBe(true);
    expect(candidate.values[9]).toBeUndefined();
    expect(reason).toContain('snapshot v3 a v8');
  });

  it('blocks a v3 work location that does not cover the whole period', () => {
    const input = snapshot();
    input.payloadVersion = 3;
    const payload = payloadOf(input) as {
      schemaVersion?: number;
      pilaWorkLocations?: unknown[];
    };
    payload.schemaVersion = 3;
    payload.pilaWorkLocations = [
      {
        assignmentId: 'work-location-1',
        tenantId: 'tenant-1',
        municipioId: 'municipality-1',
        municipio: { id: 'municipality-1', codigo: '11001' },
        vigenteDesde: '2026-10-02',
        vigenteHasta: null,
      },
    ];

    const candidate = mapCandidate(input);

    expect(candidate.values[9]).toBeUndefined();
    expect(
      candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 9)
        ?.reason,
    ).toContain('vigencia completos');
  });

  it.each(['tenant', 'employee id', 'period id', 'period dates'] as const)(
    'blocks every detail candidate when the snapshot %s differs from the approved scope',
    (mismatch) => {
      const input = snapshot();
      const payload = input.payload as {
        employer: { tenantId: string };
        employee: { employeeId: string };
        period: {
          payrollPeriodId: string;
          fechaInicio: string;
          fechaFin: string;
        };
      };
      if (mismatch === 'tenant') {
        payload.employer.tenantId = 'tenant-foreign';
      } else if (mismatch === 'employee id') {
        payload.employee.employeeId = 'employee-foreign';
      } else if (mismatch === 'period id') {
        payload.period.payrollPeriodId = 'period-foreign';
      } else {
        payload.period.fechaInicio = '2026-11-01';
        payload.period.fechaFin = '2026-11-30';
      }

      const candidate = mapPilaAt2V30DetailCandidate(input, {
        expectedTenantId: 'tenant-1',
        planillaType: 'E',
        period: {
          id: 'period-1',
          fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
          fechaFin: new Date('2026-10-31T00:00:00.000Z'),
        },
      });

      expect(candidate.supportedSnapshot).toBe(false);
      expect(candidate.scopeMismatch).toBe(true);
      if (mismatch === 'employee id') {
        expect(candidate.tenantId).toBe('tenant-1');
        expect(candidate.payrollPeriodId).toBe('period-1');
      } else {
        expect(candidate.tenantId).toBeNull();
        expect(candidate.payrollPeriodId).toBeNull();
      }
      expect(candidate.values).toEqual({});
      expect(candidate.unresolvedFields).toHaveLength(98);
      expect(candidate.unresolvedFields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fieldNumber: 1 }),
          expect.objectContaining({ fieldNumber: 98 }),
        ]),
      );
    },
  );

  it('maps fixed incapacity and maternity fields for a complete snapshot without events', () => {
    const candidate = mapCandidate(snapshot());

    expect(candidate.values).toMatchObject({
      57: { value: null, emptyAs: 'spaces' },
      58: { value: 0 },
      59: { value: null, emptyAs: 'spaces' },
      60: { value: 0 },
    });
    expect(candidate.normativeRuleVersions.noBenefitEventFields).toBe(
      'AT2_V30_NO_IGE_LMA_FIXED_FIELDS_V1',
    );
  });

  it('maps no-event novelty fields but leaves AVP unresolved without its source', () => {
    const candidate = mapCandidate(snapshot());
    const blankFields = [
      15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 29, 80, 81, 82, 83, 84,
      85, 86, 87, 88, 89, 90, 91, 92, 93, 94,
    ];

    for (const fieldNumber of blankFields) {
      expect(candidate.values[fieldNumber]).toEqual({
        value: null,
        emptyAs: 'spaces',
      });
    }
    expect(candidate.values[30]).toEqual({ value: 0 });
    expect(candidate.values[22]).toEqual({ value: null, emptyAs: 'spaces' });
    expect(candidate.values[28]).toBeUndefined();
    expect(candidate.unresolvedFields).toEqual(
      expect.arrayContaining([expect.objectContaining({ fieldNumber: 28 })]),
    );
    expect(candidate.unresolvedFields).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ fieldNumber: 22 })]),
    );
    expect(candidate.normativeRuleVersions.planillaEField22).toBe(
      'AT2_V30_PLANILLA_E_FIELD_22_BLANK_V1',
    );
    expect(candidate.normativeRuleVersions.noEventNoveltyFields).toBe(
      'AT2_V30_NO_EVENT_NOVELTY_FIELDS_V1',
    );
  });

  it('maps fixed blank destinations and non-cotizante-40 fields for a standard dependent', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    payload.pilaEvents = [{ codigo: 'VSP' }];
    payload.payroll.pilaEvents = [{ codigo: 'VSP' }];

    const candidate = mapCandidate(input);

    for (const fieldNumber of [32, 34, 74, 75]) {
      expect(candidate.values[fieldNumber]).toEqual({
        value: null,
        emptyAs: 'spaces',
      });
    }
    expect(candidate.normativeRuleVersions.noTransferDestinationFields).toBe(
      'AT2_V30_NO_TRANSFER_DESTINATION_FIELDS_V1',
    );
    expect(candidate.normativeRuleVersions.nonCotizante40PrincipalFields).toBe(
      'AT2_V30_NON_COTIZANTE40_PRINCIPAL_FIELDS_V1',
    );
  });

  it('maps field 76 as non-exempt only when the frozen employer declarations agree', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    payload.employer.aportesExonerados = false;
    payload.employer.pila.aportesExoneradosConfirmado = false;

    const candidate = mapCandidate(input);

    expect(candidate.values[76]).toEqual({ value: 'N' });
    expect(candidate.normativeRuleVersions.confirmedNonExemptCotizante).toBe(
      'AT2_V30_CONFIRMED_NON_EXEMPT_COTIZANTE_V1',
    );
  });

  it.each([
    [false, null],
    [true, true],
    [true, false],
    [false, true],
  ])(
    'leaves field 76 unresolved for employer exemption state %s / confirmation %s',
    (employerExempt, confirmation) => {
      const input = snapshot();
      const payload = payloadOf(input);
      payload.employer.aportesExonerados = employerExempt;
      payload.employer.pila.aportesExoneradosConfirmado = confirmation;

      const candidate = mapCandidate(input);

      expect(candidate.values[76]).toBeUndefined();
      expect(candidate.unresolvedFields).toContainEqual(
        expect.objectContaining({ fieldNumber: 76 }),
      );
      expect(candidate.normativeRuleVersions.confirmedNonExemptCotizante).toBe(
        null,
      );
    },
  );

  it('maps ESAP and MEN zero fields for a standard private employer with IBC 95', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    payload.employer.pila.tipoAportante = '1';
    payload.employer.pila.naturalezaJuridica = '2';

    const candidate = mapCandidate(input);

    expect(candidate.values[70]).toEqual({ value: '0.00000' });
    expect(candidate.values[71]).toEqual({ value: 0 });
    expect(candidate.values[72]).toEqual({ value: '0.00000' });
    expect(candidate.values[73]).toEqual({ value: 0 });
    expect(candidate.normativeRuleVersions.privateEmployerEsapMen).toBe(
      'AT2_V30_PRIVATE_EMPLOYER_NO_ESAP_MEN_V1',
    );
  });

  it.each([
    ['public', '1', '1'],
    ['unknown nature', '1', null],
    ['unsupported employer type', '5', '2'],
  ])(
    'leaves ESAP and MEN fields pending for %s employers',
    (_label, employerType, employerNature) => {
      const input = snapshot();
      const payload = payloadOf(input);
      payload.employer.pila.tipoAportante = employerType;
      payload.employer.pila.naturalezaJuridica = employerNature;

      const candidate = mapCandidate(input);

      for (const fieldNumber of [70, 71, 72, 73]) {
        expect(candidate.values[fieldNumber]).toBeUndefined();
        expect(candidate.unresolvedFields).toContainEqual(
          expect.objectContaining({ fieldNumber }),
        );
      }
      expect(candidate.normativeRuleVersions.privateEmployerEsapMen).toBeNull();
    },
  );

  it('keeps ESAP and MEN amount candidates pending when field 95 is unavailable', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    payload.employer.pila.tipoAportante = '1';
    payload.employer.pila.naturalezaJuridica = '2';
    payload.payroll.ibcPorSubsistema.otrosParafiscales = {
      valor: null,
      reglaVersion: 'CO_PARAFISCAL_BASE_V1',
      bloqueos: ['IBC_NO_DISPONIBLE'],
    };

    const candidate = mapCandidate(input);

    expect(candidate.values[70]).toEqual({ value: '0.00000' });
    expect(candidate.values[72]).toEqual({ value: '0.00000' });
    expect(candidate.values[71]).toBeUndefined();
    expect(candidate.values[73]).toBeUndefined();
    expect(candidate.unresolvedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldNumber: 71 }),
        expect.objectContaining({ fieldNumber: 73 }),
      ]),
    );
  });

  it.each([
    'ING',
    'RET',
    'VSP',
    'VST',
    'SLN',
    'IGE',
    'LMA',
    'VAC_LR',
    'IRL',
    'VCT',
  ])('keeps no-event novelty fields unresolved when %s exists', (codigo) => {
    const input = snapshot();
    const payload = payloadOf(input);
    const event = { codigo, fechaInicio: '2026-10-12' };
    payload.pilaEvents = [event];
    payload.payroll.pilaEvents = [event];

    const candidate = mapCandidate(input);

    for (const fieldNumber of [
      15, 16, 21, 23, 24, 25, 26, 27, 29, 30, 80, 94,
    ]) {
      expect(candidate.values[fieldNumber]).toBeUndefined();
    }
    expect(candidate.values[22]).toEqual({ value: null, emptyAs: 'spaces' });
    expect(candidate.normativeRuleVersions.noEventNoveltyFields).toBeNull();
  });

  it('maps no-AVP declaration for July 2025 under the suspended cutoff rule', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    payload.employee.fechaIngreso = '2025-07-01';
    (payload.contract as Record<string, unknown>).fechaInicio = '2025-07-01';
    payload.affiliations[0].vigenteDesde = '2025-07-01';
    (payload.period as Record<string, unknown>).fechaInicio = '2025-07-01';
    (payload.period as Record<string, unknown>).fechaFin = '2025-07-31';
    setVoluntaryPensionDeclaration(input, {
      declaredAt: '2025-07-31T12:00:00.000Z',
      paymentDate: '2025-08-06',
    });
    setStandardPensionInputs(input, { paymentDate: '2025-08-06' });
    const candidate = mapCandidate(input, 'E', '2025-07-01', '2025-07-31');

    expect(candidate.values[22]).toEqual({ value: null, emptyAs: 'spaces' });
    expect(candidate.values[28]).toEqual({ value: null, emptyAs: 'spaces' });
    expect(candidate.values[48]).toEqual({ value: 0 });
    expect(candidate.values[49]).toEqual({ value: 0 });
    expect(candidate.values[50]).toEqual({ value: 320_000 });
    expect(candidate.values[53]).toEqual({ value: null, emptyAs: 'spaces' });
    expect(candidate.normativeRuleVersions.voluntaryPensionDeclaration).toBe(
      'AT2_V30_AVP_NONE_DECLARED_PRE_2027_04_01_V1',
    );
  });

  it('keeps voluntary fields unresolved when the declaration is missing or unaudited', () => {
    for (const options of [
      { status: 'UNCONFIRMED' },
      { status: 'NONE_CONFIRMED', declaredAt: null },
      { status: 'NONE_CONFIRMED', declaredById: null },
    ]) {
      const input = snapshot();
      setVoluntaryPensionDeclaration(input, options);
      const candidate = mapCandidate(input);

      for (const fieldNumber of [28, 48, 49, 53]) {
        expect(candidate.values[fieldNumber]).toBeUndefined();
      }
      expect(candidate.values[50]).toBeUndefined();
      expect(
        candidate.normativeRuleVersions.voluntaryPensionDeclaration,
      ).toBeNull();
      expect(
        candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 28)
          ?.reason,
      ).toContain('no se infiere su ausencia');
    }
  });

  it('keeps voluntary fields blocked when AVP exists or the new pension system is effective', () => {
    const withContributions = snapshot();
    setVoluntaryPensionDeclaration(withContributions, { status: 'PRESENT' });
    const withContributionsCandidate = mapCandidate(withContributions);
    for (const fieldNumber of [28, 48, 49, 53]) {
      expect(withContributionsCandidate.values[fieldNumber]).toBeUndefined();
    }

    const atNewSystemCutoff = snapshot();
    const cutoffPayload = payloadOf(atNewSystemCutoff);
    Object.assign(cutoffPayload.period as Record<string, unknown>, {
      fechaInicio: '2027-04-01',
      fechaFin: '2027-04-30',
    });
    setVoluntaryPensionDeclaration(atNewSystemCutoff, {
      paymentDate: '2027-05-06',
    });
    const cutoffCandidate = mapCandidate(
      atNewSystemCutoff,
      'E',
      '2027-04-01',
      '2027-04-30',
    );
    for (const fieldNumber of [28, 48, 49, 53]) {
      expect(cutoffCandidate.values[fieldNumber]).toBeUndefined();
    }
    expect(
      cutoffCandidate.unresolvedFields.find(
        ({ fieldNumber }) => fieldNumber === 28,
      )?.reason,
    ).toContain('alcanza el 2027-04-01');
  });

  it('keeps historical voluntary pension fields blocked without frozen Payroll sources', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    (payload.period as Record<string, unknown>).fechaInicio = '2025-06-01';
    (payload.period as Record<string, unknown>).fechaFin = '2025-06-30';

    const candidate = mapCandidate(input, 'E', '2025-06-01', '2025-06-30');

    for (const fieldNumber of [28, 48, 49, 53]) {
      expect(candidate.values[fieldNumber]).toBeUndefined();
      expect(
        candidate.unresolvedFields.find(
          (field) => field.fieldNumber === fieldNumber,
        )?.reason,
      ).toBeTruthy();
    }
    expect(candidate.values[50]).toBeUndefined();
  });

  it('keeps voluntary fields pending for a period that crosses the published cutoff', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    (payload.period as Record<string, unknown>).fechaInicio = '2025-06-15';
    (payload.period as Record<string, unknown>).fechaFin = '2025-07-15';

    const candidate = mapCandidate(input, 'E', '2025-06-15', '2025-07-15');

    for (const fieldNumber of [28, 48, 49, 53]) {
      expect(candidate.values[fieldNumber]).toBeUndefined();
      expect(
        candidate.unresolvedFields.find(
          (field) => field.fieldNumber === fieldNumber,
        )?.reason,
      ).toBeTruthy();
    }
    expect(candidate.values[50]).toBeUndefined();
    expect(
      candidate.normativeRuleVersions.voluntaryPensionDeclaration,
    ).toBeNull();
  });

  it('blocks voluntary pension fields for an inverted payroll period', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    (payload.period as Record<string, unknown>).fechaInicio = '2025-07-31';
    (payload.period as Record<string, unknown>).fechaFin = '2025-07-01';

    const candidate = mapCandidate(input, 'E', '2025-07-31', '2025-07-01');

    for (const fieldNumber of [28, 48, 49, 53]) {
      expect(candidate.values[fieldNumber]).toBeUndefined();
      expect(
        candidate.unresolvedFields.find(
          (field) => field.fieldNumber === fieldNumber,
        )?.reason,
      ).toContain('intervalo invertido');
    }
  });

  it('keeps voluntary fields blocked for unsupported planilla types', () => {
    const candidate = mapCandidate(snapshot(), 'N');

    for (const fieldNumber of [28, 48, 49, 53]) {
      expect(candidate.values[fieldNumber]).toBeUndefined();
      expect(
        candidate.unresolvedFields.find(
          (field) => field.fieldNumber === fieldNumber,
        )?.reason,
      ).toContain('otros tipos de planilla no están soportados');
    }
    expect(
      candidate.normativeRuleVersions.voluntaryPensionDeclaration,
    ).toBeNull();
  });

  it('does not propose a correction field for unsupported planilla types', () => {
    const candidate = mapCandidate(snapshot(), 'N');

    expect(candidate.values[22]).toBeUndefined();
    expect(
      candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 22)
        ?.reason,
    ).toContain('tipo N de correcciones no se genera');
    expect(candidate.normativeRuleVersions.planillaEField22).toBeNull();
  });

  it('keeps historical voluntary and FSP amounts pending with source reasons', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    setStandardPensionInputs(input, { paymentDate: '2025-07-10' });
    payload.payroll.voluntaryPensionDeclaration = {
      status: 'NONE_CONFIRMED',
      declaredAt: '2025-06-30T12:00:00.000Z',
      declaredById: 'payroll-user-1',
    };
    payload.employee.fechaIngreso = '2025-06-01';
    (payload.contract as Record<string, unknown>).fechaInicio = '2025-06-01';
    payload.affiliations[0].vigenteDesde = '2025-06-01';
    (payload.period as Record<string, unknown>).fechaInicio = '2025-06-01';
    (payload.period as Record<string, unknown>).fechaFin = '2025-06-30';
    const candidate = mapCandidate(input, 'E', '2025-06-01', '2025-06-30');
    const reasonFor = (fieldNumber: number) =>
      candidate.unresolvedFields.find(
        (field) => field.fieldNumber === fieldNumber,
      )?.reason;

    for (const fieldNumber of [48, 49, 51, 52, 53]) {
      expect(candidate.values[fieldNumber]).toBeUndefined();
    }
    expect(reasonFor(48)).toContain('histórico anterior a v8');
    expect(reasonFor(49)).toContain('histórico anterior a v8');
    expect(reasonFor(51)).toContain('agregar el IBC pensional por cotizante');
    expect(reasonFor(52)).toContain('regla vigente por régimen');
    expect(reasonFor(53)).toContain('histórico anterior a v8');
  });

  it('keeps fixed incapacity and maternity fields unresolved when a PILA event exists', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    payload.pilaEvents = [{ codigo: 'IGE' }];
    payload.payroll.pilaEvents = [{ codigo: 'IGE' }];

    const candidate = mapCandidate(input);

    for (const fieldNumber of [57, 58, 59, 60]) {
      expect(candidate.values[fieldNumber]).toBeUndefined();
      expect(
        candidate.unresolvedFields.find(
          (field) => field.fieldNumber === fieldNumber,
        )?.reason,
      ).toContain('sin novedades ni eventos PILA');
    }
    expect(candidate.normativeRuleVersions.noBenefitEventFields).toBeNull();
  });

  it('does not infer absent incapacity or maternity events from incomplete event data', () => {
    for (const incompleteSource of [
      'rootEventList',
      'payrollEventList',
      'payrollNovelty',
    ] as const) {
      const input = snapshot();
      const payload = payloadOf(input);
      if (incompleteSource === 'rootEventList') {
        payload.pilaEvents = undefined;
      } else if (incompleteSource === 'payrollEventList') {
        payload.payroll.pilaEvents = undefined;
      } else {
        payload.payroll.novelties = [{ tipo: 'SICKNESS' }];
      }

      const candidate = mapCandidate(input);

      for (const fieldNumber of [57, 58, 59, 60]) {
        expect(candidate.values[fieldNumber]).toBeUndefined();
      }
      for (const fieldNumber of [15, 30, 80, 94]) {
        expect(candidate.values[fieldNumber]).toBeUndefined();
      }
      expect(candidate.normativeRuleVersions.noBenefitEventFields).toBeNull();
      expect(candidate.normativeRuleVersions.noEventNoveltyFields).toBeNull();
    }
  });

  it('maps direct identity, affiliation, days, bases, salary and ARL snapshot values', () => {
    const candidate = mapCandidate(snapshot());

    expect(candidate).toMatchObject({
      supportedSnapshot: true,
      tenantId: 'tenant-1',
      payrollPeriodId: 'period-1',
    });
    expect(candidate.values).toMatchObject({
      1: { value: '02' },
      3: { value: 'CC' },
      4: { value: '0012345678' },
      5: { value: '01' },
      6: { value: '00' },
      7: { value: null, emptyAs: 'spaces' },
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
      96: { value: null, emptyAs: 'spaces' },
      98: { value: riskActivityCode },
    });
    expect(candidate.values[2]).toBeUndefined();
    expect(candidate.values[46]).toBeUndefined();
    expect(candidate.values[8]).toBeUndefined();
    expect(
      candidate.unresolvedFields.map(({ fieldNumber }) => fieldNumber),
    ).toEqual(expect.arrayContaining([8, 46, 47, 61, 63, 76, 97]));
  });

  it('omits optional hours and only omits the foreign residence date after explicit confirmation', () => {
    const domestic = snapshot();
    const domesticPayload = payloadOf(domestic);
    domesticPayload.affiliations[0].colombianoEnElExterior = false;

    const domesticCandidate = mapCandidate(domestic);

    expect(domesticCandidate.values[96]).toEqual({
      value: null,
      emptyAs: 'spaces',
    });
    expect(domesticCandidate.normativeRuleVersions.optionalHoursField96).toBe(
      'AT2_V30_FIELD_96_OPTIONAL_BLANK_FOR_DEPENDENT_V1',
    );
    expect(domesticCandidate.values[97]).toEqual({
      value: null,
      emptyAs: 'spaces',
    });

    const abroad = snapshot();
    payloadOf(abroad).affiliations[0].colombianoEnElExterior = true;
    const abroadCandidate = mapCandidate(abroad);

    expect(abroadCandidate.values[97]).toBeUndefined();
    expect(
      abroadCandidate.unresolvedFields.find(
        ({ fieldNumber }) => fieldNumber === 97,
      )?.reason,
    ).toContain('fecha de radicación congelada');
  });
  it('maps the standard pension rate and blocks the total while voluntary amounts are unresolved', () => {
    const input = snapshot();
    setStandardPensionInputs(input);

    const candidate = mapCandidate(input);

    expect(candidate.values).toMatchObject({
      46: { value: '0.16000' },
      47: { value: 320_000 },
    });
    expect(candidate.values[48]).toBeUndefined();
    expect(candidate.values[49]).toBeUndefined();
    expect(candidate.values[50]).toBeUndefined();
    expect(candidate.normativeRuleVersions.pensionRate).toBe(
      'CO_PENSION_STANDARD_RATE_L797_ART7_DEC1833_2_2_3_1_13_V1',
    );
    expect(candidate.normativeRuleVersions.pensionTotalField50).toBe(
      'AT2_V30_PENSION_TOTAL_FIELD_50_SUM_47_49_V1',
    );
    expect(candidate.values[79]).toEqual({ value: null, emptyAs: 'spaces' });
    expect(candidate.normativeRuleVersions.normalPensionTariffField79).toBe(
      'AT2_V30_CONFIRMED_NORMAL_PENSION_TARIFF_FIELD_79_V1',
    );
    expect(candidate.unresolvedFields).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldNumber: 46 }),
        expect.objectContaining({ fieldNumber: 47 }),
      ]),
    );
    expect(
      candidate.unresolvedFields.map(({ fieldNumber }) => fieldNumber),
    ).toEqual(expect.arrayContaining([48, 49, 50]));
  });

  it('does not infer the normal pension tariff when field 79 is absent from the approved snapshot', () => {
    const input = snapshot();
    setStandardPensionInputs(input);
    delete payloadOf(input).affiliations[0].indicadorTarifaEspecialPensiones;

    const candidate = mapCandidate(input);

    expect(candidate.values[79]).toBeUndefined();
    expect(candidate.values[46]).toBeUndefined();
    expect(candidate.values[47]).toBeUndefined();
    expect(candidate.unresolvedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldNumber: 79 }),
        expect.objectContaining({ fieldNumber: 46 }),
        expect.objectContaining({ fieldNumber: 47 }),
      ]),
    );
    expect(
      candidate.normativeRuleVersions.normalPensionTariffField79,
    ).toBeNull();
  });

  it.each(['1', '2', '3', '4'] as const)(
    'keeps special pension tariff %s outside the standard 01/00 MVP',
    (indicator) => {
      const input = snapshot();
      setStandardPensionInputs(input);
      payloadOf(input).affiliations[0].indicadorTarifaEspecialPensiones =
        indicator;

      const candidate = mapCandidate(input);

      expect(candidate.values[79]).toBeUndefined();
      expect(candidate.values[46]).toBeUndefined();
      expect(candidate.values[47]).toBeUndefined();
      expect(
        candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 79)
          ?.reason,
      ).toContain('fuera del MVP');
      expect(
        candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 46)
          ?.reason,
      ).toContain('fuera del MVP');
    },
  );

  it('keeps AT2 field 50 unresolved when a source contribution is unresolved', () => {
    const input = snapshot();
    setStandardPensionInputs(input, { employeeAmount: 80_100 });

    const candidate = mapCandidate(input);

    expect(candidate.values[47]).toBeUndefined();
    expect(candidate.values[48]).toBeUndefined();
    expect(candidate.values[49]).toBeUndefined();
    expect(candidate.values[50]).toBeUndefined();
    expect(
      candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 50)
        ?.reason,
    ).toContain('47–49');
  });

  it('maps an explicit CE/PA declaration that the foreign worker is obligated', () => {
    const input = snapshot();
    setStandardPensionInputs(input, {
      employeeType: 'CE',
      foreignExemption: false,
      exteriorDeclaration: null,
    });

    const candidate = mapCandidate(input);

    expect(candidate.values[46]).toEqual({ value: '0.16000' });
    expect(candidate.values[47]).toEqual({ value: 320_000 });
  });

  it('blocks a total that differs after independently rounding frozen employee and employer amounts', () => {
    const input = snapshot();
    setStandardPensionInputs(input, {
      base: 1_000,
      employeeAmount: 100,
      employerAmount: 200,
    });

    const candidate = mapCandidate(input);

    expect(candidate.values[46]).toBeUndefined();
    expect(candidate.values[47]).toBeUndefined();
    expect(
      candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 47)
        ?.reason,
    ).toContain('La suma congelada');
  });

  it.each([
    ['employee tariff mismatch', { employeeFactor: 0.05 }, 'factores'],
    ['employer tariff mismatch', { employerFactor: 0.11 }, 'factores'],
    ['employee amount mismatch', { employeeAmount: 80_100 }, 'importes'],
    ['employer amount mismatch', { employerAmount: 240_100 }, 'importes'],
    ['new-system payment date', { paymentDate: '2027-04-01' }, '2027-04-01'],
    ['unconfirmed residence', { exteriorDeclaration: null }, 'CC/TI'],
    [
      'foreign exemption flag on a domestic document',
      { foreignExemption: true },
      'incompatible con el documento CC/TI',
    ],
    [
      'Colombian abroad flag on a foreign document',
      {
        employeeType: 'CE',
        foreignExemption: false,
        exteriorDeclaration: true,
      },
      'incompatible con el documento CE/PA',
    ],
    ['public employer', { employerNature: '1' }, 'empleadores privados'],
  ] as const)(
    'leaves both pension fields unresolved for %s',
    (_description, overrides, expectedReason) => {
      const input = snapshot();
      setStandardPensionInputs(input, overrides);

      const candidate = mapCandidate(input);

      expect(candidate.values[46]).toBeUndefined();
      expect(candidate.values[47]).toBeUndefined();
      expect(
        candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 46)
          ?.reason,
      ).toContain(expectedReason);
    },
  );

  it('does not infer a zero pension rate for an exempt foreign worker', () => {
    const input = snapshot();
    setStandardPensionInputs(input, {
      employeeType: 'PA',
      foreignExemption: true,
      exteriorDeclaration: null,
    });

    const candidate = mapCandidate(input);

    expect(candidate.values[46]).toBeUndefined();
    expect(candidate.values[47]).toBeUndefined();
    expect(
      candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 46)
        ?.reason,
    ).toContain('obligado a cotizar');
  });

  it('maps standard health rate and aggregates only rounded snapshot amounts', () => {
    const input = snapshot();
    setStandardHealthInputs(input);

    const candidate = mapCandidate(input);

    expect(candidate.values).toMatchObject({
      54: { value: '0.12500' },
      55: { value: 250_000 },
    });
    expect(candidate.normativeRuleVersions.healthRate).toBe(
      'CO_HEALTH_STANDARD_RATE_L1122_ART10_V1',
    );
  });

  it('blocks health mapping without explicit employer non-exemption', () => {
    const input = snapshot();
    setStandardHealthInputs(input, { employerExemption: true });

    const candidate = mapCandidate(input);

    expect(candidate.values[54]).toBeUndefined();
    expect(candidate.values[55]).toBeUndefined();
    expect(
      candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 54)
        ?.reason,
    ).toContain('no exoneración');
  });

  it('blocks health mapping if individually rounded source amounts do not match the combined rate', () => {
    const input = snapshot();
    setStandardHealthInputs(input, {
      base: 500,
      employeeAmount: 100,
      employerAmount: 100,
    });

    const candidate = mapCandidate(input);

    expect(candidate.values[54]).toBeUndefined();
    expect(candidate.values[55]).toBeUndefined();
    expect(
      candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 55)
        ?.reason,
    ).toContain('La suma congelada');
  });

  it.each([
    ['employee factor mismatch', { employeeFactor: 0.05 }, 'SALUD_EMP'],
    ['employer factor mismatch', { employerFactor: 0.09 }, 'SALUD_PAT'],
    [
      'unconfirmed non-exemption',
      { employerConfirmation: null },
      'no exoneración',
    ],
    ['public employer', { employerNature: '1' }, 'empleadores privados'],
    [
      'unconfirmed worker location',
      { exteriorDeclaration: null },
      'confirmación expresa',
    ],
  ] as const)(
    'leaves health fields unresolved for %s',
    (_description, overrides, expectedReason) => {
      const input = snapshot();
      setStandardHealthInputs(input, overrides);

      const candidate = mapCandidate(input);

      expect(candidate.values[54]).toBeUndefined();
      expect(candidate.values[55]).toBeUndefined();
      expect(
        candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 54)
          ?.reason,
      ).toContain(expectedReason);
    },
  );

  it.each(['CC', 'TI'])(
    'does not flag document type %s as foreign, but keeps residence abroad unresolved',
    (documentType) => {
      const input = snapshot();
      payloadOf(input).employee.tipoDocumento = documentType;

      const candidate = mapCandidate(input);

      expect(candidate.values[7]).toEqual({ value: null, emptyAs: 'spaces' });
      expect(candidate.values[8]).toBeUndefined();
    },
  );

  it.each(['CE', 'PA'])(
    'keeps the foreign pension exemption unresolved for document type %s',
    (documentType) => {
      const input = snapshot();
      payloadOf(input).employee.tipoDocumento = documentType;

      const candidate = mapCandidate(input);

      expect(candidate.values[7]).toBeUndefined();
      expect(candidate.values[8]).toEqual({ value: null, emptyAs: 'spaces' });
    },
  );

  it.each([
    ['CC', '0012345678'],
    ['CE', '0123456'],
    ['TI', '00123456789'],
    ['PA', 'A123456789012345'],
    ['PC', '12345678'],
  ])(
    'maps approved identity %s without changing its number',
    (type, number) => {
      const input = snapshot();
      payloadOf(input).employee.tipoDocumento = type;
      payloadOf(input).employee.cedula = number;

      const candidate = mapCandidate(input);

      expect(candidate.values[3]).toEqual({ value: type });
      expect(candidate.values[4]).toEqual({ value: number });
      expect(candidate.unresolvedFields).not.toContainEqual(
        expect.objectContaining({ fieldNumber: 3 }),
      );
      expect(candidate.unresolvedFields).not.toContainEqual(
        expect.objectContaining({ fieldNumber: 4 }),
      );
    },
  );

  it.each([
    ['CC', '12345678901'],
    ['CE', '12345678'],
    ['TI', '123456789012'],
    ['PA', 'a123'],
    ['PA', 'A1234567890123456'],
    ['PC', '123456'],
    ['PC', '123456789'],
    ['CC', ' 1234'],
  ])(
    'blocks an invalid %s document number without changing it',
    (type, number) => {
      const input = snapshot();
      payloadOf(input).employee.tipoDocumento = type;
      payloadOf(input).employee.cedula = number;

      const candidate = mapCandidate(input);

      expect(candidate.values[3]).toEqual({ value: type });
      expect(candidate.values[4]).toBeUndefined();
      expect(
        candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 4)
          ?.reason,
      ).toContain('no se corrige ni se trunca');
    },
  );

  it.each(['PEP', 'PPT', 'RC', 'CD', 'SC', 'PE', 'PT', 'ZZ'])(
    'keeps unsupported document type %s out of identity candidates',
    (type) => {
      const input = snapshot();
      payloadOf(input).employee.tipoDocumento = type;

      const candidate = mapCandidate(input);

      expect(candidate.values[3]).toBeUndefined();
      expect(candidate.values[4]).toBeUndefined();
      expect(candidate.unresolvedFields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fieldNumber: 3 }),
          expect.objectContaining({ fieldNumber: 4 }),
        ]),
      );
    },
  );

  it('maps PEP-TUTOR identity while leaving its pension classification unresolved', () => {
    const input = snapshot();
    payloadOf(input).employee.tipoDocumento = 'PC';
    payloadOf(input).employee.cedula = '12345678';

    const candidate = mapCandidate(input);

    expect(candidate.values[3]).toEqual({ value: 'PC' });
    expect(candidate.values[4]).toEqual({ value: '12345678' });
    expect(candidate.values[7]).toBeUndefined();
    expect(candidate.values[8]).toBeUndefined();
    expect(candidate.values[46]).toBeUndefined();
    expect(candidate.values[47]).toBeUndefined();
    expect(
      candidate.unresolvedFields.some(
        ({ fieldNumber, reason }) =>
          fieldNumber === 7 && reason.includes('PEP-TUTOR'),
      ),
    ).toBe(true);
    expect(
      candidate.unresolvedFields.some(
        ({ fieldNumber, reason }) =>
          fieldNumber === 8 && reason.includes('PEP-TUTOR'),
      ),
    ).toBe(true);
    expect(
      candidate.unresolvedFields.some(({ fieldNumber }) => fieldNumber === 46),
    ).toBe(true);
    expect(
      candidate.unresolvedFields.some(({ fieldNumber }) => fieldNumber === 47),
    ).toBe(true);
  });

  it.each(['CC', 'TI'])(
    'maps the explicit exterior declaration for %s as X or blank',
    (documentType) => {
      const abroad = snapshot();
      payloadOf(abroad).employee.tipoDocumento = documentType;
      payloadOf(abroad).affiliations[0].colombianoEnElExterior = true;

      const abroadCandidate = mapCandidate(abroad);
      expect(abroadCandidate.values[8]).toEqual({ value: 'X' });
      expect(abroadCandidate.unresolvedFields).not.toContainEqual(
        expect.objectContaining({ fieldNumber: 8 }),
      );

      payloadOf(abroad).affiliations[0].colombianoEnElExterior = false;
      const domesticCandidate = mapCandidate(abroad);
      expect(domesticCandidate.values[8]).toEqual({
        value: null,
        emptyAs: 'spaces',
      });
    },
  );

  it.each(['CE', 'PA'])(
    'maps the explicit foreign pension exemption for %s as X or blank',
    (documentType) => {
      const foreign = snapshot();
      payloadOf(foreign).employee.tipoDocumento = documentType;
      payloadOf(foreign).affiliations[0].extranjeroNoObligadoPension = true;

      const exemptCandidate = mapCandidate(foreign);
      expect(exemptCandidate.values[7]).toEqual({ value: 'X' });
      expect(exemptCandidate.unresolvedFields).not.toContainEqual(
        expect.objectContaining({ fieldNumber: 7 }),
      );

      payloadOf(foreign).affiliations[0].extranjeroNoObligadoPension = false;
      const obligatedCandidate = mapCandidate(foreign);
      expect(obligatedCandidate.values[7]).toEqual({
        value: null,
        emptyAs: 'spaces',
      });
    },
  );

  it('blocks declarations that conflict with the employee document type', () => {
    const input = snapshot();
    payloadOf(input).affiliations[0].extranjeroNoObligadoPension = true;

    const candidate = mapCandidate(input);

    expect(candidate.values[7]).toBeUndefined();
    expect(candidate.unresolvedFields).toContainEqual(
      expect.objectContaining({ fieldNumber: 7 }),
    );
  });

  it('keeps both flags unresolved for unsupported document types', () => {
    const input = snapshot();
    payloadOf(input).employee.tipoDocumento = 'ZZ';

    const candidate = mapCandidate(input);

    expect(candidate.values[7]).toBeUndefined();
    expect(candidate.values[8]).toBeUndefined();
  });

  it.each(['02', '75'])(
    'does not map days or affiliations for nonstandard cotizante %s',
    (tipoCotizanteCodigo) => {
      const input = snapshot();
      payloadOf(input).affiliations[0].tipoCotizanteCodigo =
        tipoCotizanteCodigo;

      const candidate = mapCandidate(input);

      expect(candidate.values[1]).toBeUndefined();
      expect(candidate.values[5]).toBeUndefined();
      expect(candidate.values[31]).toBeUndefined();
      expect(candidate.values[36]).toBeUndefined();
      expect(candidate.values[7]).toBeUndefined();
      expect(candidate.values[8]).toBeUndefined();
      for (const fieldNumber of [32, 34, 74, 75]) {
        expect(candidate.values[fieldNumber]).toBeUndefined();
      }
      expect(
        candidate.normativeRuleVersions.noTransferDestinationFields,
      ).toBeNull();
      expect(
        candidate.normativeRuleVersions.nonCotizante40PrincipalFields,
      ).toBeNull();
    },
  );

  it('preserves numeric identifier and work center leading zeros', () => {
    const candidate = mapCandidate(snapshot());

    expect(candidate.values[4]).toEqual({ value: '0012345678' });
    expect(candidate.values[62]).toEqual({ value: '00012' });
  });

  it('leaves IBC candidate unresolved when more than one concept supplied it', () => {
    const input = snapshot();
    payloadOf(input).payroll.ibcPorSubsistema.pension.sourceCount = 2;

    const candidate = mapCandidate(input);

    expect(candidate.values[42]).toBeUndefined();
    expect(candidate.unresolvedFields).toEqual(
      expect.arrayContaining([expect.objectContaining({ fieldNumber: 42 })]),
    );
  });

  it('maps the versioned ARL tariff and direct contribution amounts as candidates', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    const employer = (input.payload as { employer: Record<string, unknown> })
      .employer;
    employer.aportesExonerados = false;
    setStandardCcfEmployer(input);
    (employer.pila as Record<string, unknown>).aportesExoneradosConfirmado =
      false;
    payload.payroll.concepts = [
      {
        codigo: 'ARL',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.01044,
        valor: 20_900,
      },
      {
        codigo: 'CAJA',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.04,
        valor: 80_000,
      },
      {
        codigo: 'SENA',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.02,
        valor: 40_000,
      },
      {
        codigo: 'ICBF',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.03,
        valor: 60_000,
      },
    ];

    const candidate = mapCandidate(input);

    expect(candidate.values).toMatchObject({
      61: { value: '0.0104400' },
      64: { value: '0.04000' },
      63: { value: 20_900 },
      65: { value: 80_000 },
      66: { value: '0.02000' },
      67: { value: 40_000 },
      68: { value: '0.03000' },
      69: { value: 60_000 },
    });
    expect(candidate.normativeRuleVersions.arlInitialRate).toBe(
      'CO_ARL_INITIAL_RATE_DEC1772_ART13_V1',
    );
    expect(candidate.normativeRuleVersions.contributionRounding).toBe(
      'CO_PILA_CONTRIBUTION_ROUND_UP_100_DEC1990_ART3_2_1_5_V1',
    );
    expect(candidate.normativeRuleVersions.ccfRate).toBe(
      'CO_CCF_STANDARD_RATE_L21_ART11_12_V1',
    );
    expect(candidate.normativeRuleVersions.senaRate).toBe(
      'CO_SENA_STANDARD_RATE_L21_ART12_V1',
    );
    expect(candidate.normativeRuleVersions.icbfRate).toBe(
      'CO_ICBF_STANDARD_RATE_L89_ART1_V1',
    );
  });

  it.each(['A', 'B'])(
    'maps the standard CCF rate only for an explicit non-beneficiary class %s employer',
    (claseAportante) => {
      const input = snapshot();
      setStandardCcfEmployer(input, { claseAportante });
      payloadOf(input).payroll.concepts = [
        {
          codigo: 'CAJA',
          tipo: 'EMPLOYER_CONTRIBUTION',
          base: 2_000_000,
          factor: 0.04,
          valor: 80_000,
        },
      ];

      const candidate = mapCandidate(input);

      expect(candidate.values[64]).toEqual({ value: '0.04000' });
      expect(candidate.values[65]).toEqual({ value: 80_000 });
    },
  );

  it.each([
    ['class C', { claseAportante: 'C' }, 0.04, 'clase A/B'],
    ['class D', { claseAportante: 'D' }, 0.04, 'clase A/B'],
    [
      'declared Law 1429 benefit',
      { claseAportante: 'B', beneficioCcfLey1429: true },
      0.01,
      'beneficio CCF de Ley 1429',
    ],
    [
      'missing Law 1429 declaration',
      { claseAportante: 'B', beneficioCcfLey1429: null },
      0.04,
      'declaración explícita',
    ],
    [
      'non-standard frozen factor',
      { claseAportante: 'B', beneficioCcfLey1429: false },
      0.03,
      'no coincide con la tarifa CCF estándar versionada',
    ],
  ] as const)(
    'blocks the CCF tariff for %s',
    (_case, employerOverrides, factor, expectedReason) => {
      const input = snapshot();
      setStandardCcfEmployer(input, employerOverrides);
      payloadOf(input).payroll.concepts = [
        {
          codigo: 'CAJA',
          tipo: 'EMPLOYER_CONTRIBUTION',
          base: 2_000_000,
          factor,
          valor: factor === 0.04 ? 80_000 : 60_000,
        },
      ];

      const candidate = mapCandidate(input);

      expect(candidate.values[64]).toBeUndefined();
      expect(
        candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 64)
          ?.reason,
      ).toContain(expectedReason);
      expect(candidate.values[65]).toBeUndefined();
    },
  );

  it.each([
    ['1', 0.00522, '0.0052200', 10_500],
    ['2', 0.01044, '0.0104400', 20_900],
    ['3', 0.02436, '0.0243600', 48_800],
    ['4', 0.0435, '0.0435000', 87_000],
    ['5', 0.0696, '0.0696000', 139_200],
  ])(
    'maps initial ARL tariff for risk class %s from the approved snapshot',
    (riskClass, factor, fieldValue, amount) => {
      const input = snapshot();
      const payload = payloadOf(input);
      payload.affiliations[0].arlClaseRiesgo = riskClass;
      payload.pilaRiskAssignments[0].codigoActividadEconomica = [
        ...PILA_RISK_ACTIVITY_CODES,
      ].find((code) => code[0] === riskClass);
      payload.payroll.concepts = [
        {
          codigo: 'ARL',
          tipo: 'EMPLOYER_CONTRIBUTION',
          base: 2_000_000,
          factor,
          valor: amount,
        },
      ];

      const candidate = mapCandidate(input);

      expect(candidate.values[61]).toEqual({ value: fieldValue });
      expect(candidate.values[63]).toEqual({ value: amount });
    },
  );

  it('keeps the ARL rate candidate but blocks a frozen contribution not rounded for PILA', () => {
    const input = snapshot();
    payloadOf(input).payroll.concepts = [
      {
        codigo: 'ARL',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.01044,
        valor: 20_880,
      },
    ];

    const candidate = mapCandidate(input);

    expect(candidate.values[61]).toEqual({ value: '0.0104400' });
    expect(candidate.values[63]).toBeUndefined();
    const field63 = candidate.unresolvedFields.find(
      ({ fieldNumber }) => fieldNumber === 63,
    );
    expect(field63?.reason).toContain('múltiplo de 100 superior');
  });

  it('blocks CCF, SENA and ICBF candidates when frozen amounts are not rounded for PILA', () => {
    const input = snapshot();
    const root = input.payload as { employer: Record<string, unknown> };
    root.employer.aportesExonerados = false;
    setStandardCcfEmployer(input);
    (
      root.employer.pila as Record<string, unknown>
    ).aportesExoneradosConfirmado = false;
    payloadOf(input).payroll.concepts = [
      {
        codigo: 'CAJA',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.04,
        valor: 80_010,
      },
      {
        codigo: 'SENA',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.02,
        valor: 40_010,
      },
      {
        codigo: 'ICBF',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.03,
        valor: 60_099,
      },
    ];

    const candidate = mapCandidate(input);

    expect(candidate.values[66]).toEqual({ value: '0.02000' });
    expect(candidate.values[68]).toEqual({ value: '0.03000' });
    for (const fieldNumber of [65, 67, 69]) {
      expect(candidate.values[fieldNumber]).toBeUndefined();
      expect(
        candidate.unresolvedFields.find(
          (field) => field.fieldNumber === fieldNumber,
        )?.reason,
      ).toContain('múltiplo de 100 superior');
    }
  });

  it('blocks the ARL tariff and contribution when snapshot factor disagrees with risk class', () => {
    const input = snapshot();
    payloadOf(input).payroll.concepts = [
      {
        codigo: 'ARL',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.00522,
        valor: 10_440,
      },
    ];

    const candidate = mapCandidate(input);

    expect(candidate.values[61]).toBeUndefined();
    expect(candidate.values[63]).toBeUndefined();
    expect(
      candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 63)
        ?.reason,
    ).toContain('no coincide con la tarifa inicial');
    expect(
      candidate.unresolvedFields.some(({ fieldNumber }) => fieldNumber === 61),
    ).toBe(true);
  });

  it('does not infer zero contributions or map concepts with ambiguous or mismatched bases', () => {
    const input = snapshot();
    payloadOf(input).payroll.concepts = [
      {
        codigo: 'ARL',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.00522,
        valor: 10_440,
      },
      {
        codigo: 'ARL',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.00522,
        valor: 10_440,
      },
      {
        codigo: 'CAJA',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 1_900_000,
        factor: 0.04,
        valor: 76_000,
      },
    ];

    const candidate = mapCandidate(input);

    expect(candidate.values[63]).toBeUndefined();
    expect(candidate.values[65]).toBeUndefined();
    expect(candidate.values[67]).toBeUndefined();
    expect(candidate.values[69]).toBeUndefined();
    expect(candidate.unresolvedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldNumber: 63 }),
        expect.objectContaining({ fieldNumber: 65 }),
      ]),
    );
  });

  it('keeps SENA and ICBF blocked for an exempt employer, including a high-salary employee', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    const employer = (input.payload as { employer: Record<string, unknown> })
      .employer;
    payload.employee.salario = 20_000_000;
    employer.aportesExonerados = true;
    (employer.pila as Record<string, unknown>).aportesExoneradosConfirmado =
      true;
    payload.payroll.concepts = [
      {
        codigo: 'SENA',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.02,
        valor: 40_000,
      },
      {
        codigo: 'ICBF',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.03,
        valor: 60_000,
      },
    ];

    const candidate = mapCandidate(input);

    expect(candidate.values[67]).toBeUndefined();
    expect(candidate.values[69]).toBeUndefined();
    expect(candidate.values[66]).toBeUndefined();
    expect(candidate.values[68]).toBeUndefined();
  });

  it('does not map SENA or ICBF candidates without an explicit non-exemption declaration', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    const employer = (input.payload as { employer: Record<string, unknown> })
      .employer;
    employer.aportesExonerados = false;
    setStandardCcfEmployer(input);
    payload.payroll.concepts = [
      {
        codigo: 'SENA',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.02,
        valor: 40_000,
      },
      {
        codigo: 'ICBF',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.03,
        valor: 60_000,
      },
    ];

    const candidate = mapCandidate(input);

    for (const fieldNumber of [66, 67, 68, 69]) {
      expect(candidate.values[fieldNumber]).toBeUndefined();
      expect(
        candidate.unresolvedFields.find(
          (field) => field.fieldNumber === fieldNumber,
        )?.reason,
      ).toContain('declaración expresa y coherente de no exoneración');
    }
    expect(candidate.values[76]).toBeUndefined();
    expect(
      candidate.unresolvedFields.find((field) => field.fieldNumber === 76)
        ?.reason,
    ).toContain('confirmación explícita y coherente de no exoneración');
  });

  it.each([
    ['class C', { claseAportante: 'C' }, 'clase A/B'],
    ['class D', { claseAportante: 'D' }, 'clase A/B'],
    [
      'declared Law 1429 benefit',
      { claseAportante: 'B', beneficioLey1429: true },
      'Ley 1429',
    ],
    [
      'missing Law 1429 declaration',
      { claseAportante: 'B', beneficioLey1429: null },
      'declarar explícitamente',
    ],
    [
      'missing employer type',
      { claseAportante: 'B', tipoAportante: '' },
      'aportante empleador',
    ],
    [
      'public employer',
      { claseAportante: 'B', naturalezaJuridica: '1' },
      'empleadores privados',
    ],
    [
      'mixed employer',
      { claseAportante: 'B', naturalezaJuridica: '3' },
      'empleadores privados',
    ],
  ] as const)(
    'blocks standard SENA and ICBF rates for %s',
    (_case, employerOverrides, expectedReason) => {
      const input = snapshot();
      const payload = payloadOf(input);
      const employer = (input.payload as { employer: Record<string, unknown> })
        .employer;
      employer.aportesExonerados = false;
      setStandardCcfEmployer(input, employerOverrides);
      (employer.pila as Record<string, unknown>).aportesExoneradosConfirmado =
        false;
      payload.payroll.concepts = [
        {
          codigo: 'SENA',
          tipo: 'EMPLOYER_CONTRIBUTION',
          base: 2_000_000,
          factor: 0.02,
          valor: 40_000,
        },
        {
          codigo: 'ICBF',
          tipo: 'EMPLOYER_CONTRIBUTION',
          base: 2_000_000,
          factor: 0.03,
          valor: 60_000,
        },
      ];

      const candidate = mapCandidate(input);

      for (const fieldNumber of [66, 67, 68, 69]) {
        expect(candidate.values[fieldNumber]).toBeUndefined();
        expect(
          candidate.unresolvedFields.find(
            (field) => field.fieldNumber === fieldNumber,
          )?.reason,
        ).toContain(expectedReason);
      }
    },
  );

  it('blocks SENA and ICBF rates and amounts when Payroll factors differ from the standard rates', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    const employer = (input.payload as { employer: Record<string, unknown> })
      .employer;
    employer.aportesExonerados = false;
    setStandardCcfEmployer(input);
    (employer.pila as Record<string, unknown>).aportesExoneradosConfirmado =
      false;
    payload.payroll.concepts = [
      {
        codigo: 'SENA',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.01,
        valor: 20_000,
      },
      {
        codigo: 'ICBF',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.02,
        valor: 40_000,
      },
    ];

    const candidate = mapCandidate(input);

    for (const fieldNumber of [66, 67, 68, 69]) {
      expect(candidate.values[fieldNumber]).toBeUndefined();
      expect(
        candidate.unresolvedFields.find(
          (field) => field.fieldNumber === fieldNumber,
        )?.reason,
      ).toContain('no coincide con la tarifa estándar versionada');
    }
  });

  it('does not map SENA or ICBF when employer exemption conflicts with PILA confirmation', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    const root = input.payload as { employer: Record<string, unknown> };
    setStandardCcfEmployer(input);
    root.employer.aportesExonerados = true;
    (
      root.employer.pila as Record<string, unknown>
    ).aportesExoneradosConfirmado = false;
    payload.payroll.concepts = [
      {
        codigo: 'SENA',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.02,
        valor: 40_000,
      },
      {
        codigo: 'ICBF',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.03,
        valor: 60_000,
      },
    ];

    const candidate = mapCandidate(input);

    expect(candidate.values[67]).toBeUndefined();
    expect(candidate.values[69]).toBeUndefined();
    const parafiscalBlockers = candidate.unresolvedFields.filter(
      ({ fieldNumber }) => fieldNumber === 67 || fieldNumber === 69,
    );
    expect(parafiscalBlockers.map(({ fieldNumber }) => fieldNumber)).toEqual([
      67, 69,
    ]);
    expect(
      parafiscalBlockers.every(({ reason }) => reason.includes('coherente')),
    ).toBe(true);
  });

  it('does not map a contribution amount with a zero factor', () => {
    const input = snapshot();
    payloadOf(input).payroll.concepts = [
      {
        codigo: 'ARL',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0,
        valor: 0,
      },
    ];

    const candidate = mapCandidate(input);

    expect(candidate.values[63]).toBeUndefined();
  });

  it('does not map contribution candidates when the frozen snapshot has novelty events', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    payload.payroll.concepts = [
      {
        codigo: 'ARL',
        tipo: 'EMPLOYER_CONTRIBUTION',
        base: 2_000_000,
        factor: 0.00522,
        valor: 10_440,
      },
    ];
    payload.payroll.novelties = [{ tipo: 'SICKNESS' }];

    const candidate = mapCandidate(input);

    expect(candidate.values[63]).toBeUndefined();
    expect(
      candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 63)
        ?.reason,
    ).toContain('sin novedades');
  });

  it('does not map a work center assigned to another tenant', () => {
    const input = snapshot();
    payloadOf(input).pilaRiskAssignments[0].tenantId = 'tenant-2';

    const candidate = mapCandidate(input);

    expect(candidate.values[62]).toBeUndefined();
    expect(candidate.values[98]).toBeUndefined();
  });

  it.each(invalidRiskAssignmentCases)(
    'leaves ARL fields unresolved when the $name',
    ({ mutate }) => {
      const input = snapshot();
      mutate(payloadOf(input).pilaRiskAssignments[0]);

      const candidate = mapCandidate(input);

      expect(candidate.values[62]).toBeUndefined();
      expect(candidate.values[98]).toBeUndefined();
    },
  );

  it('leaves only the work center field unresolved when its code is not numeric', () => {
    const input = snapshot();
    const center = payloadOf(input).pilaRiskAssignments[0]
      .centroTrabajo as Record<string, unknown>;
    center.codigoCentro = 'ARL-CENTER-12';

    const candidate = mapCandidate(input);

    expect(candidate.values[62]).toBeUndefined();
    expect(candidate.values[98]).toEqual({ value: riskActivityCode });
  });

  it('does not map ARL fields when activity class differs from the affiliation', () => {
    const input = snapshot();
    payloadOf(input).affiliations[0].arlClaseRiesgo = '3';

    const candidate = mapCandidate(input);

    expect(candidate.values[62]).toBeUndefined();
    expect(candidate.values[98]).toBeUndefined();
  });

  it('does not map unsupported snapshot versions', () => {
    const input = snapshot();
    input.payloadVersion = 1;

    const candidate = mapCandidate(input);

    expect(candidate.supportedSnapshot).toBe(false);
    expect(candidate.values).toEqual({});
    expect(candidate.unresolvedFields).toHaveLength(98);
    expect(candidate.unresolvedFields[0]?.reason).toContain('PILA v2 a v9');
  });
});
