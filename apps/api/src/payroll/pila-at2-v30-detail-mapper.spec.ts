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
      98: { value: riskActivityCode },
    });
    expect(candidate.values[46]).toBeUndefined();
    expect(candidate.values[8]).toBeUndefined();
    expect(
      candidate.unresolvedFields.map(({ fieldNumber }) => fieldNumber),
    ).toEqual(expect.arrayContaining([8, 46, 47, 48, 61, 63, 76, 96, 97]));
  });

  it.each(['CC', 'TI'])(
    'does not flag document type %s as foreign, but keeps residence abroad unresolved',
    (documentType) => {
      const input = snapshot();
      payloadOf(input).employee.tipoDocumento = documentType;

      const candidate = mapPilaAt2V30DetailCandidate(input);

      expect(candidate.values[7]).toEqual({ value: null, emptyAs: 'spaces' });
      expect(candidate.values[8]).toBeUndefined();
    },
  );

  it.each(['CE', 'PA'])(
    'keeps the foreign pension exemption unresolved for document type %s',
    (documentType) => {
      const input = snapshot();
      payloadOf(input).employee.tipoDocumento = documentType;

      const candidate = mapPilaAt2V30DetailCandidate(input);

      expect(candidate.values[7]).toBeUndefined();
      expect(candidate.values[8]).toEqual({ value: null, emptyAs: 'spaces' });
    },
  );

  it.each(['CC', 'TI'])(
    'maps the explicit exterior declaration for %s as X or blank',
    (documentType) => {
      const abroad = snapshot();
      payloadOf(abroad).employee.tipoDocumento = documentType;
      payloadOf(abroad).affiliations[0].colombianoEnElExterior = true;

      const abroadCandidate = mapPilaAt2V30DetailCandidate(abroad);
      expect(abroadCandidate.values[8]).toEqual({ value: 'X' });
      expect(abroadCandidate.unresolvedFields).not.toContainEqual(
        expect.objectContaining({ fieldNumber: 8 }),
      );

      payloadOf(abroad).affiliations[0].colombianoEnElExterior = false;
      const domesticCandidate = mapPilaAt2V30DetailCandidate(abroad);
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

      const exemptCandidate = mapPilaAt2V30DetailCandidate(foreign);
      expect(exemptCandidate.values[7]).toEqual({ value: 'X' });
      expect(exemptCandidate.unresolvedFields).not.toContainEqual(
        expect.objectContaining({ fieldNumber: 7 }),
      );

      payloadOf(foreign).affiliations[0].extranjeroNoObligadoPension = false;
      const obligatedCandidate = mapPilaAt2V30DetailCandidate(foreign);
      expect(obligatedCandidate.values[7]).toEqual({
        value: null,
        emptyAs: 'spaces',
      });
    },
  );

  it('blocks declarations that conflict with the employee document type', () => {
    const input = snapshot();
    payloadOf(input).affiliations[0].extranjeroNoObligadoPension = true;

    const candidate = mapPilaAt2V30DetailCandidate(input);

    expect(candidate.values[7]).toBeUndefined();
    expect(candidate.unresolvedFields).toContainEqual(
      expect.objectContaining({ fieldNumber: 7 }),
    );
  });

  it('keeps both flags unresolved for unsupported document types', () => {
    const input = snapshot();
    payloadOf(input).employee.tipoDocumento = 'ZZ';

    const candidate = mapPilaAt2V30DetailCandidate(input);

    expect(candidate.values[7]).toBeUndefined();
    expect(candidate.values[8]).toBeUndefined();
  });

  it('does not map days or affiliations for a nonstandard cotizante', () => {
    const input = snapshot();
    payloadOf(input).affiliations[0].tipoCotizanteCodigo = '02';

    const candidate = mapPilaAt2V30DetailCandidate(input);

    expect(candidate.values[1]).toBeUndefined();
    expect(candidate.values[5]).toBeUndefined();
    expect(candidate.values[31]).toBeUndefined();
    expect(candidate.values[36]).toBeUndefined();
    expect(candidate.values[7]).toBeUndefined();
    expect(candidate.values[8]).toBeUndefined();
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

    const candidate = mapPilaAt2V30DetailCandidate(input);

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

      const candidate = mapPilaAt2V30DetailCandidate(input);

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

      const candidate = mapPilaAt2V30DetailCandidate(input);

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

      const candidate = mapPilaAt2V30DetailCandidate(input);

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

    const candidate = mapPilaAt2V30DetailCandidate(input);

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

    const candidate = mapPilaAt2V30DetailCandidate(input);

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

    const candidate = mapPilaAt2V30DetailCandidate(input);

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

    const candidate = mapPilaAt2V30DetailCandidate(input);

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

    const candidate = mapPilaAt2V30DetailCandidate(input);

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

    const candidate = mapPilaAt2V30DetailCandidate(input);

    for (const fieldNumber of [66, 67, 68, 69]) {
      expect(candidate.values[fieldNumber]).toBeUndefined();
      expect(
        candidate.unresolvedFields.find(
          (field) => field.fieldNumber === fieldNumber,
        )?.reason,
      ).toContain('declaración expresa y coherente de no exoneración');
    }
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

      const candidate = mapPilaAt2V30DetailCandidate(input);

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

    const candidate = mapPilaAt2V30DetailCandidate(input);

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

    const candidate = mapPilaAt2V30DetailCandidate(input);

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

    const candidate = mapPilaAt2V30DetailCandidate(input);

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

    const candidate = mapPilaAt2V30DetailCandidate(input);

    expect(candidate.values[63]).toBeUndefined();
    expect(
      candidate.unresolvedFields.find(({ fieldNumber }) => fieldNumber === 63)
        ?.reason,
    ).toContain('sin novedades');
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
