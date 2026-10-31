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
    ).toEqual(expect.arrayContaining([8, 46, 47, 48, 76, 96, 97]));
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

  it('maps direct ARL, CCF and non-exempt parafiscal concept amounts as candidates', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    const employer = (input.payload as { employer: Record<string, unknown> })
      .employer;
    employer.aportesExonerados = false;
    (employer.pila as Record<string, unknown>).aportesExoneradosConfirmado =
      false;
    payload.payroll.concepts = [
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
      63: { value: 10_440 },
      65: { value: 80_000 },
      67: { value: 40_000 },
      69: { value: 60_000 },
    });
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

  it('does not map SENA or ICBF amounts when employer exemption is declared', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    const employer = (input.payload as { employer: Record<string, unknown> })
      .employer;
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
  });

  it('does not map SENA or ICBF when employer exemption conflicts with PILA confirmation', () => {
    const input = snapshot();
    const payload = payloadOf(input);
    const root = input.payload as { employer: Record<string, unknown> };
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

  it('does not map a work center across tenants or an activity outside its catalog version', () => {
    const input = snapshot();
    payloadOf(input).pilaRiskAssignments[0].tenantId = 'tenant-2';

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
