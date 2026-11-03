import { PilaEventCode } from '@prisma/client';
import {
  buildPilaSourceContext,
  buildPilaSourceSnapshot,
  PilaSourceContextInput,
} from './pila-source-snapshot';

const contextInput: PilaSourceContextInput = {
  capturedAt: new Date('2026-11-02T15:00:00.000Z'),
  tenant: {
    id: 'tenant-1',
    razonSocial: 'Demo S.A.S.',
    nit: '900123456',
    digitoVerif: '7',
    direccion: 'Carrera 1 # 2-3',
    telefono: null,
    email: 'nomina@example.test',
    representanteLegal: null,
    aportesExonerados: false,
    pilaClaseAportante: null,
    pilaTipoDocumentoAportante: null,
    pilaNaturalezaJuridica: null,
    pilaTipoPersona: null,
    pilaFormaPresentacion: null,
    pilaCodigoSucursal: null,
    pilaNombreSucursal: null,
    pilaCodigoActividadEconomica: null,
    pilaCodigoArlAportante: null,
    pilaTipoAportante: null,
    pilaFax: null,
    pilaRepresentanteTipoDocumento: null,
    pilaRepresentanteNumeroDocumento: null,
    pilaRepresentantePrimerApellido: null,
    pilaRepresentanteSegundoApellido: null,
    pilaRepresentantePrimerNombre: null,
    pilaRepresentanteSegundoNombre: null,
    pilaFechaMatriculaMercantil: null,
    pilaBeneficioLey1429: null,
    pilaBeneficioCcfLey1429: null,
    pilaAportesExoneradosConfirmado: null,
    pilaSinAccionEspecial: null,
    municipio: {
      id: 'municipality-1',
      codigo: '08001',
      nombre: 'Barranquilla',
      departamento: 'Atlántico',
    },
  },
  employee: {
    id: 'employee-1',
    tipoDocumento: 'CC',
    cedula: '1000000001',
    primerNombre: 'Ana',
    segundoNombre: null,
    primerApellido: 'Pérez',
    segundoApellido: null,
    fechaNacimiento: null,
    fechaIngreso: new Date('2026-01-05T00:00:00.000Z'),
    fechaRetiro: null,
    tipoSalarioPila: null,
  },
  period: {
    id: 'period-1',
    fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
    fechaFin: new Date('2026-10-31T00:00:00.000Z'),
  },
  contract: {
    id: 'contract-1',
    tipo: 'TERMINO_FIJO',
    estado: 'VIGENTE',
    fechaInicio: new Date('2026-01-05T00:00:00.000Z'),
    fechaFin: null,
    salario: 2_000_000,
    sedeId: 'site-1',
    claseRiesgoArl: 2,
  },
  worksite: {
    id: 'site-1',
    nombre: 'Sede Barranquilla',
    direccion: 'Calle 10 # 20-30',
    municipio: {
      id: 'municipality-1',
      codigo: '08001',
      nombre: 'Barranquilla',
      departamento: 'Atlántico',
    },
  },
  affiliations: [
    {
      id: 'affiliation-1',
      tipoCotizanteCodigo: '01',
      subtipoCotizanteCodigo: '00',
      epsCodigo: 'EPS001',
      epsNombre: 'EPS de prueba',
      fondoPensionCodigo: 'AFP001',
      fondoPensionNombre: 'Fondo de prueba',
      arlCodigo: 'ARL001',
      arlNombre: 'ARL de prueba',
      arlClaseRiesgo: '2',
      cajaCompensacionCodigo: 'CCF001',
      cajaCompensacionNombre: 'Caja de prueba',
      cajaCompensacionDepartamentoCodigo: '08',
      extranjeroNoObligadoPension: null,
      colombianoEnElExterior: false,
      vigenteDesde: new Date('2026-01-01T00:00:00.000Z'),
      vigenteHasta: null,
      versionCaptura: 'PILA_AFFILIATION_CAPTURE_V1',
    },
  ],
  pilaEvents: [],
};

type PilaPayrollInput = Parameters<
  typeof buildPilaSourceSnapshot
>[0]['payroll'];

function buildField95TestSnapshot(
  options: {
    salary?: number;
    integral?: boolean;
    exonerated?: boolean;
    declaredSalaryType?: 'X' | 'F' | 'V' | null;
    sharedIbc?: number;
    extraConcepts?: PilaPayrollInput['concepts'];
    novelties?: PilaPayrollInput['novelties'];
  } = {},
) {
  const salary = options.salary ?? 2_000_000;
  const integral = options.integral ?? false;
  const context = buildPilaSourceContext({
    ...contextInput,
    tenant: {
      ...contextInput.tenant,
      aportesExonerados: options.exonerated ?? false,
    },
    employee: {
      ...contextInput.employee,
      tipoSalarioPila: options.declaredSalaryType ?? (integral ? 'X' : 'F'),
    },
    contract: contextInput.contract
      ? { ...contextInput.contract, salario: salary }
      : null,
  });

  return buildPilaSourceSnapshot({
    context,
    payroll: {
      runId: 'run-field-95',
      fechaPrevistaPagoPila: null,
      salarioBasico: salary,
      salarioIntegral: integral,
      ibc: options.sharedIbc ?? salary,
      concepts: [
        {
          id: 'salary-concept',
          codigo: 'SALARIO_BASE',
          tipo: 'EARNING',
          base: null,
          factor: null,
          valor: salary,
        },
        ...(options.extraConcepts ?? []),
      ],
      novelties: options.novelties ?? [],
    },
  });
}

describe('PILA source snapshot builders', () => {
  it('freezes the employer-confirmed work location with tenant and effective dates', () => {
    const context = buildPilaSourceContext({
      ...contextInput,
      pilaWorkLocations: [
        {
          id: 'work-location-1',
          tenantId: 'tenant-1',
          municipioId: 'municipality-2',
          municipio: {
            id: 'municipality-2',
            codigo: '11001',
            nombre: 'Bogotá, D.C.',
            departamento: 'Bogotá, D.C.',
          },
          vigenteDesde: new Date('2026-10-01T00:00:00.000Z'),
          vigenteHasta: null,
        },
      ],
    });
    const snapshot = buildPilaSourceSnapshot({
      context,
      payroll: {
        runId: 'run-1',
        fechaPrevistaPagoPila: null,
        salarioBasico: 2_000_000,
        salarioIntegral: false,
        ibc: 2_000_000,
        concepts: [],
        novelties: [],
      },
    });

    expect(context.schemaVersion).toBe(3);
    expect(snapshot.schemaVersion).toBe(4);
    expect(snapshot.pilaWorkLocations).toEqual([
      {
        assignmentId: 'work-location-1',
        tenantId: 'tenant-1',
        municipioId: 'municipality-2',
        municipio: {
          id: 'municipality-2',
          codigo: '11001',
          nombre: 'Bogotá, D.C.',
          departamento: 'Bogotá, D.C.',
        },
        vigenteDesde: '2026-10-01',
        vigenteHasta: null,
      },
    ]);
  });

  it('freezes the current employer PILA profile into the source context', () => {
    const context = buildPilaSourceContext({
      ...contextInput,
      tenant: {
        ...contextInput.tenant,
        pilaClaseAportante: 'B',
        pilaTipoDocumentoAportante: 'NI',
        pilaNaturalezaJuridica: '2',
        pilaTipoPersona: 'J',
        pilaFormaPresentacion: 'U',
        pilaCodigoSucursal: null,
        pilaNombreSucursal: null,
        pilaCodigoActividadEconomica: '8513',
        pilaCodigoArlAportante: 'ARL001',
        pilaTipoAportante: '1',
        pilaFax: null,
        pilaRepresentanteTipoDocumento: 'CC',
        pilaRepresentanteNumeroDocumento: '123456789',
        pilaRepresentantePrimerApellido: 'Pérez',
        pilaRepresentanteSegundoApellido: null,
        pilaRepresentantePrimerNombre: 'Ana',
        pilaRepresentanteSegundoNombre: null,
        pilaFechaMatriculaMercantil: new Date('2020-02-29T00:00:00.000Z'),
        pilaBeneficioLey1429: false,
        pilaBeneficioCcfLey1429: false,
        pilaAportesExoneradosConfirmado: false,
        pilaSinAccionEspecial: true,
      },
    });

    expect(context.employer.pila).toEqual({
      claseAportante: 'B',
      tipoDocumentoAportante: 'NI',
      naturalezaJuridica: '2',
      tipoPersona: 'J',
      formaPresentacion: 'U',
      codigoSucursal: null,
      nombreSucursal: null,
      codigoActividadEconomica: '8513',
      codigoArlAportante: 'ARL001',
      tipoAportante: '1',
      fax: null,
      representanteTipoDocumento: 'CC',
      representanteNumeroDocumento: '123456789',
      representantePrimerApellido: 'Pérez',
      representanteSegundoApellido: null,
      representantePrimerNombre: 'Ana',
      representanteSegundoNombre: null,
      fechaMatriculaMercantil: '2020-02-29',
      beneficioLey1429: false,
      beneficioCcfLey1429: false,
      aportesExoneradosConfirmado: false,
      sinAccionEspecial: true,
    });
  });

  it('freezes the Payroll FSP calculation inputs without treating them as PILA rules', () => {
    const snapshot = buildPilaSourceSnapshot({
      context: buildPilaSourceContext(contextInput),
      payroll: {
        runId: 'run-fsp-inputs',
        parametroLegalId: 'legal-2026',
        legalParameters: {
          smmlv: 1_423_500,
          fspTramos: [
            { desdeSmmlv: 0, hastaSmmlv: 4, pct: 0 },
            { desdeSmmlv: 4, hastaSmmlv: 16, pct: 0.01 },
          ],
        },
        fechaPrevistaPagoPila: null,
        salarioBasico: 2_000_000,
        salarioIntegral: false,
        ibc: 2_000_000,
        concepts: [],
        novelties: [],
      },
    });

    expect(snapshot.schemaVersion).toBe(4);
    expect(snapshot.payroll.payrollCalculationParameters).toEqual({
      sourceVersion: 'PAYROLL_LEGAL_PARAMETERS_V1',
      parametroLegalId: 'legal-2026',
      smmlv: 1_423_500,
      fspTramos: [
        { desdeSmmlv: 0, hastaSmmlv: 4, pct: 0 },
        { desdeSmmlv: 4, hastaSmmlv: 16, pct: 0.01 },
      ],
    });
  });

  it('keeps malformed Payroll FSP inputs unresolved instead of inferring values', () => {
    const snapshot = buildPilaSourceSnapshot({
      context: buildPilaSourceContext(contextInput),
      payroll: {
        runId: 'run-malformed-fsp-inputs',
        parametroLegalId: 'legal-2026',
        legalParameters: {
          smmlv: '1423500',
          fspTramos: [{ desdeSmmlv: 4, hastaSmmlv: 16, pct: -0.01 }],
        },
        fechaPrevistaPagoPila: null,
        salarioBasico: 2_000_000,
        salarioIntegral: false,
        ibc: 2_000_000,
        concepts: [],
        novelties: [],
      },
    });

    expect(snapshot.payroll.payrollCalculationParameters).toMatchObject({
      parametroLegalId: 'legal-2026',
      smmlv: null,
      fspTramos: null,
    });
  });

  it('freezes declared sources and approved payroll values without deriving fields', () => {
    const context = buildPilaSourceContext(contextInput);
    const result = buildPilaSourceSnapshot({
      context,
      payroll: {
        runId: 'run-1',
        fechaPrevistaPagoPila: new Date('2026-11-05T00:00:00.000Z'),
        salarioBasico: 2_000_000,
        salarioIntegral: false,
        ibc: 2_000_000,
        concepts: [
          {
            id: 'concept-health-employer',
            codigo: 'SALUD_PAT',
            tipo: 'EMPLOYER_CONTRIBUTION',
            base: 2_000_000,
            factor: 0.085,
            valor: 170_000,
          },
          {
            id: 'concept-pension-employee',
            codigo: 'PENSION_EMP',
            tipo: 'DEDUCTION',
            base: 2_000_000,
            factor: 0.04,
            valor: 80_000,
          },
          {
            id: 'concept-health-employee',
            codigo: 'SALUD_EMP',
            tipo: 'DEDUCTION',
            base: 2_000_000,
            factor: 0.04,
            valor: 80_000,
          },
          {
            id: 'concept-risk',
            codigo: 'ARL',
            tipo: 'EMPLOYER_CONTRIBUTION',
            base: 1_950_000,
            factor: 0.01,
            valor: 19_500,
          },
          {
            id: 'concept-ccf',
            codigo: 'CAJA',
            tipo: 'EMPLOYER_CONTRIBUTION',
            base: 1_900_000,
            factor: 0.04,
            valor: 76_000,
          },
        ],
        novelties: [
          {
            noveltyId: 'novelty-1',
            tipo: 'VACATION',
            descripcion: 'Vacaciones registradas',
            fecha: '2026-10-15',
            valor: null,
          },
        ],
      },
    });

    expect(result.schemaVersion).toBe(4);
    expect(result.capturedAt).toBe('2026-11-02T15:00:00.000Z');
    expect(result.employee.fechaIngreso).toBe('2026-01-05');
    expect(result.employee.fechaNacimiento).toBeNull();
    expect(result.affiliations[0].vigenteDesde).toBe('2026-01-01');
    expect(result.affiliations[0]).toMatchObject({
      extranjeroNoObligadoPension: null,
      colombianoEnElExterior: false,
      cajaCompensacionDepartamentoCodigo: '08',
    });
    expect(result.payroll.fechaPrevistaPagoPila).toBe('2026-11-05');
    expect(result.payroll.salarioBasico).toBe(2_000_000);
    expect(result.payroll.salarioBasicoCampo40).toEqual({
      valor: 2_000_000,
      bloqueos: [],
    });
    expect(result.payroll.tipoSalario).toBeNull();
    expect(result.payroll.tipoSalarioBloqueos).toEqual([
      'TIPO_SALARIO_PILA_SIN_DECLARAR',
    ]);
    expect(result.payroll.concepts[0].valor).toBe(170_000);
    expect(result.payroll.ibcPorSubsistema).toMatchObject({
      pension: {
        valor: 2_000_000,
        sourceCount: 1,
        conceptIds: ['concept-pension-employee'],
      },
      salud: {
        valor: 2_000_000,
        sourceCount: 1,
        conceptIds: ['concept-health-employee'],
      },
      riesgos: {
        valor: 1_950_000,
        sourceCount: 1,
        conceptIds: ['concept-risk'],
      },
      cajaCompensacion: {
        valor: 1_900_000,
        sourceCount: 1,
        conceptIds: ['concept-ccf'],
      },
    });
    const field95 = result.payroll.ibcPorSubsistema.otrosParafiscales;
    expect(field95).toMatchObject({
      valor: null,
      sourceCount: 0,
      conceptIds: [],
      reglaVersion: 'CO_PARAFISCAL_BASE_V1',
    });
    expect(field95.bloqueos).toContain(
      'IBC_OTROS_PARAFISCALES_SALARIO_BASE_AUSENTE_O_AMBIGUO',
    );
    expect(field95.bloqueos).toContain(
      'IBC_OTROS_PARAFISCALES_NOVEDAD_SIN_BASE_APROBADA',
    );
    expect(field95.bloqueos).toContain(
      'IBC_OTROS_PARAFISCALES_TIPO_SALARIO_FUERA_DE_REGLA',
    );
    expect(result.payroll.novelties[0]).toEqual({
      noveltyId: 'novelty-1',
      tipo: 'VACATION',
      descripcion: 'Vacaciones registradas',
      fecha: '2026-10-15',
      valor: null,
    });
    for (const days of Object.values(
      result.payroll.diasCotizadosPorSubsistema,
    )) {
      expect(days).toMatchObject({
        valor: null,
        reglaVersion: 'PILA_FULL_MONTH_DAYS_V1',
        bloqueos: ['HAY_NOVEDADES_SIN_SEGMENTACION_PILA'],
      });
    }
    expect(result.employee).not.toHaveProperty('email');
  });

  it('congela el centro ARL, su tenant, actividad y vigencias en el payload', () => {
    const input = {
      ...contextInput,
      riskAssignments: [
        {
          id: 'risk-assignment-1',
          tenantId: 'tenant-1',
          codigoActividadEconomica: '1110101',
          formatoNormativoVersion: 'DECRETO_768_2022',
          vigenteDesde: new Date('2026-01-01T00:00:00.000Z'),
          vigenteHasta: null,
          centroTrabajo: {
            id: 'pila-center-1',
            tenantId: 'tenant-1',
            sedeId: 'site-1',
            arlCodigo: 'ARL001',
            codigoCentro: '0001',
            nombre: 'Centro Barranquilla',
          },
        },
      ],
    };
    const result = buildPilaSourceContext(input);

    expect(result.pilaRiskAssignments).toEqual([
      {
        assignmentId: 'risk-assignment-1',
        tenantId: 'tenant-1',
        codigoActividadEconomica: '1110101',
        formatoNormativoVersion: 'DECRETO_768_2022',
        vigenteDesde: '2026-01-01',
        vigenteHasta: null,
        centroTrabajo: {
          centroTrabajoId: 'pila-center-1',
          tenantId: 'tenant-1',
          sedeId: 'site-1',
          arlCodigo: 'ARL001',
          codigoCentro: '0001',
          nombre: 'Centro Barranquilla',
        },
      },
    ]);
  });

  it('captures 30 days per subsystem for a full-month standard dependent', () => {
    const context = buildPilaSourceContext(contextInput);
    const result = buildPilaSourceSnapshot({
      context,
      payroll: {
        runId: 'run-standard-full-month',
        fechaPrevistaPagoPila: new Date('2026-11-05T00:00:00.000Z'),
        salarioBasico: 2_000_000,
        salarioIntegral: false,
        ibc: 2_000_000,
        concepts: [],
        novelties: [],
      },
    });

    for (const days of Object.values(
      result.payroll.diasCotizadosPorSubsistema,
    )) {
      expect(days).toMatchObject({
        valor: 30,
        reglaVersion: 'PILA_FULL_MONTH_DAYS_V1',
        fundamento: 'COBERTURA_COMPLETA_MES_CALENDARIO_DEPENDIENTE',
        bloqueos: [],
      });
    }
  });

  it.each([
    ['February with 28 days', '2026-02-01', '2026-02-28'],
    ['leap February with 29 days', '2024-02-01', '2024-02-29'],
    ['a 30-day month', '2026-04-01', '2026-04-30'],
    ['a 31-day month', '2026-01-01', '2026-01-31'],
  ])('records 30 PILA days for %s', (_label, start, end) => {
    const hiredBeforePeriod = new Date('2020-01-01T00:00:00.000Z');
    const context = buildPilaSourceContext({
      ...contextInput,
      employee: {
        ...contextInput.employee,
        fechaIngreso: hiredBeforePeriod,
      },
      period: {
        ...contextInput.period,
        fechaInicio: new Date(`${start}T00:00:00.000Z`),
        fechaFin: new Date(`${end}T00:00:00.000Z`),
      },
      contract: {
        ...contextInput.contract!,
        fechaInicio: hiredBeforePeriod,
        fechaFin: null,
      },
      affiliations: contextInput.affiliations.map((affiliation) => ({
        ...affiliation,
        vigenteDesde: hiredBeforePeriod,
        vigenteHasta: null,
      })),
    });
    const result = buildPilaSourceSnapshot({
      context,
      payroll: {
        runId: `run-${start}`,
        fechaPrevistaPagoPila: null,
        salarioBasico: 2_000_000,
        salarioIntegral: false,
        ibc: 2_000_000,
        concepts: [],
        novelties: [],
      },
    });

    expect(
      Object.values(result.payroll.diasCotizadosPorSubsistema).map(
        ({ valor, bloqueos }) => ({ valor, bloqueos }),
      ),
    ).toEqual([
      { valor: 30, bloqueos: [] },
      { valor: 30, bloqueos: [] },
      { valor: 30, bloqueos: [] },
      { valor: 30, bloqueos: [] },
    ]);
  });

  it('does not infer 30 days for a partial calendar month', () => {
    const context = buildPilaSourceContext({
      ...contextInput,
      period: {
        ...contextInput.period,
        fechaInicio: new Date('2026-10-02T00:00:00.000Z'),
        fechaFin: new Date('2026-10-31T00:00:00.000Z'),
      },
    });
    const result = buildPilaSourceSnapshot({
      context,
      payroll: {
        runId: 'run-partial-month',
        fechaPrevistaPagoPila: null,
        salarioBasico: 2_000_000,
        salarioIntegral: false,
        ibc: 2_000_000,
        concepts: [],
        novelties: [],
      },
    });

    for (const days of Object.values(
      result.payroll.diasCotizadosPorSubsistema,
    )) {
      expect(days.valor).toBeNull();
      expect(days.bloqueos).toContain('PERIODO_NO_ES_MES_CALENDARIO_COMPLETO');
    }
  });

  it.each([
    ['missing', null, 'SUBTIPO_COTIZANTE_SIN_CONFIRMAR'],
    ['special', '01', 'COTIZANTE_FUERA_DEL_MVP_ESTANDAR'],
  ] as const)(
    'blocks full-month day candidates when the standard subtype is %s',
    (_, subtype, blocker) => {
      const standardContext = buildPilaSourceContext(contextInput);
      const context = {
        ...standardContext,
        affiliations: standardContext.affiliations.map((affiliation) => ({
          ...affiliation,
          subtipoCotizanteCodigo: subtype,
        })),
      };
      const result = buildPilaSourceSnapshot({
        context,
        payroll: {
          runId: 'run-subtype-not-standard',
          fechaPrevistaPagoPila: null,
          salarioBasico: 2_000_000,
          salarioIntegral: false,
          ibc: 2_000_000,
          concepts: [],
          novelties: [],
        },
      });

      for (const days of Object.values(
        result.payroll.diasCotizadosPorSubsistema,
      )) {
        expect(days.valor).toBeNull();
        expect(days.bloqueos).toContain(blocker);
      }
    },
  );

  it('freezes PILA events and blocks day values until approved segmentation exists', () => {
    const context = buildPilaSourceContext({
      ...contextInput,
      pilaEvents: [
        {
          id: 'pila-event-1',
          codigo: PilaEventCode.IGE,
          fechaInicio: new Date('2026-10-12T00:00:00.000Z'),
          fechaFin: new Date('2026-10-14T00:00:00.000Z'),
          dias: null,
        },
      ],
    });
    const snapshot = buildPilaSourceSnapshot({
      context,
      payroll: {
        runId: 'run-with-pila-event',
        fechaPrevistaPagoPila: null,
        salarioBasico: 2_000_000,
        salarioIntegral: false,
        ibc: 2_000_000,
        concepts: [],
        novelties: [],
      },
    });

    expect(snapshot.pilaEvents).toEqual([
      {
        eventId: 'pila-event-1',
        codigo: 'IGE',
        fechaInicio: '2026-10-12',
        fechaFin: '2026-10-14',
        dias: null,
      },
    ]);
    for (const days of Object.values(
      snapshot.payroll.diasCotizadosPorSubsistema,
    )) {
      expect(days).toMatchObject({
        valor: null,
        bloqueos: ['HAY_EVENTOS_PILA_SIN_SEGMENTACION'],
      });
    }
  });

  it.each([
    ['fixed', 'F'],
    ['variable', 'V'],
  ] as const)(
    'captures an explicitly declared %s salary type',
    (_, declared) => {
      const context = buildPilaSourceContext({
        ...contextInput,
        employee: { ...contextInput.employee, tipoSalarioPila: declared },
      });
      const result = buildPilaSourceSnapshot({
        context,
        payroll: {
          runId: 'run-salary-type',
          fechaPrevistaPagoPila: null,
          salarioBasico: 2_000_000,
          salarioIntegral: false,
          ibc: 2_000_000,
          concepts: [],
          novelties: [],
        },
      });

      expect(result.employee.tipoSalarioPila).toBe(declared);
      expect(result.payroll.tipoSalario).toBe(declared);
      expect(result.payroll.tipoSalarioBloqueos).toEqual([]);
    },
  );

  it('blocks contradictory salary type declarations', () => {
    const context = buildPilaSourceContext({
      ...contextInput,
      employee: { ...contextInput.employee, tipoSalarioPila: 'F' },
    });
    const result = buildPilaSourceSnapshot({
      context,
      payroll: {
        runId: 'run-conflicting-salary-type',
        fechaPrevistaPagoPila: null,
        salarioBasico: 2_000_000,
        salarioIntegral: true,
        ibc: 2_000_000,
        concepts: [],
        novelties: [],
      },
    });

    expect(result.payroll.tipoSalario).toBeNull();
    expect(result.payroll.tipoSalarioBloqueos).toEqual([
      'TIPO_SALARIO_PILA_CONTRADICTORIO',
    ]);
  });

  it('keeps fractional salary but blocks AT2 field 40 without rounding', () => {
    const context = buildPilaSourceContext(contextInput);
    const result = buildPilaSourceSnapshot({
      context,
      payroll: {
        runId: 'run-fractional-basic-salary',
        fechaPrevistaPagoPila: null,
        salarioBasico: 2_000_000.25,
        salarioIntegral: false,
        ibc: 2_000_000.25,
        concepts: [],
        novelties: [],
      },
    });

    expect(result.payroll.salarioBasico).toBe(2_000_000.25);
    expect(result.payroll.salarioBasicoCampo40).toEqual({
      valor: null,
      bloqueos: ['SALARIO_BASICO_CAMPO_40_NO_VALIDO'],
    });
  });

  it('does not infer fixed salary from an absent declaration', () => {
    const context = buildPilaSourceContext({
      ...contextInput,
      employee: { ...contextInput.employee, tipoSalarioPila: null },
    });
    const result = buildPilaSourceSnapshot({
      context,
      payroll: {
        runId: 'run-undeclared-salary-type',
        fechaPrevistaPagoPila: null,
        salarioBasico: 2_000_000,
        salarioIntegral: false,
        ibc: 2_000_000,
        concepts: [],
        novelties: [],
      },
    });

    expect(result.payroll.tipoSalario).toBeNull();
    expect(result.payroll.tipoSalarioBloqueos).toEqual([
      'TIPO_SALARIO_PILA_SIN_DECLARAR',
    ]);
  });

  it('preserves missing worksite, contract and affiliation data as missing', () => {
    const context = buildPilaSourceContext({
      ...contextInput,
      tenant: { ...contextInput.tenant, municipio: null },
      contract: null,
      worksite: null,
      affiliations: [],
    });
    const result = buildPilaSourceSnapshot({
      context,
      payroll: {
        runId: 'run-1',
        fechaPrevistaPagoPila: null,
        salarioBasico: null,
        salarioIntegral: false,
        ibc: 2_000_000,
        concepts: [],
        novelties: [],
      },
    });

    expect(result.worksite).toBeNull();
    expect(result.contract).toBeNull();
    expect(result.employer.municipio).toBeNull();
    expect(result.affiliations).toEqual([]);
    expect(result.payroll.fechaPrevistaPagoPila).toBeNull();
    expect(result.payroll.salarioBasico).toBeNull();
    expect(result.payroll.salarioBasicoCampo40).toEqual({
      valor: null,
      bloqueos: ['SALARIO_BASICO_CAMPO_40_NO_VALIDO'],
    });
    expect(result.payroll.tipoSalario).toBeNull();
    expect(result.payroll.novelties).toEqual([]);
    expect(result.payroll.ibcPorSubsistema).toMatchObject({
      pension: { valor: null, sourceCount: 0, conceptIds: [] },
      salud: { valor: null, sourceCount: 0, conceptIds: [] },
      riesgos: { valor: null, sourceCount: 0, conceptIds: [] },
      cajaCompensacion: { valor: null, sourceCount: 0, conceptIds: [] },
    });
    const field95 = result.payroll.ibcPorSubsistema.otrosParafiscales;
    expect(field95).toMatchObject({
      valor: null,
      sourceCount: 0,
      conceptIds: [],
      reglaVersion: 'CO_PARAFISCAL_BASE_V1',
    });
    expect(field95.bloqueos).toContain(
      'IBC_OTROS_PARAFISCALES_SALARIO_BASE_AUSENTE_O_AMBIGUO',
    );
    expect(field95.bloqueos).toContain(
      'IBC_OTROS_PARAFISCALES_TIPO_SALARIO_FUERA_DE_REGLA',
    );
  });

  it('marks a subsystem base unresolved when multiple payroll concepts match', () => {
    const context = buildPilaSourceContext(contextInput);
    const result = buildPilaSourceSnapshot({
      context,
      payroll: {
        runId: 'run-ambiguous-bases',
        fechaPrevistaPagoPila: null,
        salarioBasico: 2_000_000,
        salarioIntegral: false,
        ibc: 2_100_000,
        concepts: [
          {
            id: 'pension-concept-1',
            codigo: 'PENSION_EMP',
            tipo: 'DEDUCTION',
            base: 2_100_000,
            factor: 0.04,
            valor: 84_000,
          },
          {
            id: 'pension-concept-2',
            codigo: 'PENSION_EMP',
            tipo: 'DEDUCTION',
            base: 2_000_000,
            factor: 0.04,
            valor: 80_000,
          },
        ],
        novelties: [],
      },
    });

    expect(result.payroll.ibcPorSubsistema.pension).toEqual({
      valor: null,
      sourceCount: 2,
      conceptIds: ['pension-concept-1', 'pension-concept-2'],
    });
  });

  it('derives field 95 from salary and excludes transport allowance', () => {
    const result = buildField95TestSnapshot({
      extraConcepts: [
        {
          id: 'transport-concept',
          codigo: 'AUX_TRANSP',
          tipo: 'EARNING',
          base: null,
          factor: null,
          valor: 249_095,
        },
      ],
    });

    expect(result.payroll.ibcPorSubsistema.otrosParafiscales).toMatchObject({
      valor: 2_000_000,
      sourceCount: 1,
      conceptIds: ['salary-concept'],
      reglaVersion: 'CO_PARAFISCAL_BASE_V1',
      bloqueos: [],
    });
  });

  it('derives field 95 even when employer exoneration omits ICBF and SENA concepts', () => {
    const result = buildField95TestSnapshot({ exonerated: true });

    expect(result.payroll.ibcPorSubsistema.otrosParafiscales).toMatchObject({
      valor: 2_000_000,
      conceptIds: ['salary-concept'],
      bloqueos: [],
    });
  });

  it('applies the 70 percent integral-salary factor to the accepted salary base', () => {
    const result = buildField95TestSnapshot({
      salary: 15_000_000,
      integral: true,
      sharedIbc: 7_000_000,
    });

    expect(result.payroll.ibcPorSubsistema.otrosParafiscales).toMatchObject({
      valor: 10_500_000,
      conceptIds: ['salary-concept'],
      bloqueos: [],
    });
  });

  it('includes approved overtime and keeps monthly days when its source matches', () => {
    const result = buildField95TestSnapshot({
      extraConcepts: [
        {
          id: 'overtime-concept',
          codigo: 'OVERTIME',
          tipo: 'EARNING',
          base: null,
          factor: null,
          valor: 200_000,
        },
      ],
      novelties: [
        {
          noveltyId: 'overtime-novelty',
          tipo: 'OVERTIME',
          descripcion: 'Horas extra aprobadas',
          fecha: '2026-10-15',
          valor: 200_000,
        },
      ],
    });

    expect(result.payroll.ibcPorSubsistema.otrosParafiscales).toMatchObject({
      valor: 2_200_000,
      sourceCount: 2,
      conceptIds: ['salary-concept', 'overtime-concept'],
      bloqueos: [],
    });
    expect(
      Object.values(result.payroll.diasCotizadosPorSubsistema).map(
        ({ valor }) => valor,
      ),
    ).toEqual([30, 30, 30, 30]);
  });

  it('blocks invalid overtime amounts even when the concept and novelty match', () => {
    const result = buildField95TestSnapshot({
      extraConcepts: [
        {
          id: 'overtime-concept',
          codigo: 'OVERTIME',
          tipo: 'EARNING',
          base: null,
          factor: null,
          valor: -50_000,
        },
      ],
      novelties: [
        {
          noveltyId: 'overtime-novelty',
          tipo: 'OVERTIME',
          descripcion: 'Horas extra con valor inválido',
          fecha: '2026-10-15',
          valor: -50_000,
        },
      ],
    });

    const field95 = result.payroll.ibcPorSubsistema.otrosParafiscales;
    expect(field95.valor).toBeNull();
    expect(field95.bloqueos).toContain(
      'IBC_OTROS_PARAFISCALES_HORAS_EXTRA_SIN_VALOR',
    );
  });

  it('blocks variable salary until a versioned base rule is approved', () => {
    const result = buildField95TestSnapshot({ declaredSalaryType: 'V' });

    const field95 = result.payroll.ibcPorSubsistema.otrosParafiscales;
    expect(field95.valor).toBeNull();
    expect(field95.bloqueos).toContain(
      'IBC_OTROS_PARAFISCALES_TIPO_SALARIO_FUERA_DE_REGLA',
    );
  });

  it('blocks bonuses until their wage nature is represented and reviewed', () => {
    const result = buildField95TestSnapshot({
      extraConcepts: [
        {
          id: 'bonus-concept',
          codigo: 'BONUS',
          tipo: 'EARNING',
          base: null,
          factor: null,
          valor: 100_000,
        },
      ],
      novelties: [
        {
          noveltyId: 'bonus-novelty',
          tipo: 'BONUS',
          descripcion: 'Bonificación sin naturaleza clasificada',
          fecha: '2026-10-15',
          valor: 100_000,
        },
      ],
    });

    const field95 = result.payroll.ibcPorSubsistema.otrosParafiscales;
    expect(field95.valor).toBeNull();
    expect(field95.bloqueos).toContain(
      'IBC_OTROS_PARAFISCALES_DEVENGO_SIN_CLASIFICAR',
    );
    expect(field95.bloqueos).toContain(
      'IBC_OTROS_PARAFISCALES_BONUS_SIN_NATURALEZA',
    );
  });

  it('blocks vacation amounts until Payroll stores a traceable paid-rest concept', () => {
    const result = buildField95TestSnapshot({
      novelties: [
        {
          noveltyId: 'vacation-novelty',
          tipo: 'VACATION',
          descripcion: 'Vacaciones registradas sin concepto pagado',
          fecha: '2026-10-15',
          valor: 100_000,
        },
      ],
    });

    const field95 = result.payroll.ibcPorSubsistema.otrosParafiscales;
    expect(field95.valor).toBeNull();
    expect(field95.bloqueos).toContain(
      'IBC_OTROS_PARAFISCALES_REQUIERE_MES_COMPLETO',
    );
    expect(field95.bloqueos).toContain(
      'IBC_OTROS_PARAFISCALES_NOVEDAD_SIN_BASE_APROBADA',
    );
  });

  it('deja el tipo salarial sin resolver sin clasificación fija explícita', () => {
    const context = buildPilaSourceContext(contextInput);
    const result = buildPilaSourceSnapshot({
      context,
      payroll: {
        runId: 'run-variable',
        fechaPrevistaPagoPila: null,
        salarioBasico: 2_000_000,
        salarioIntegral: false,
        ibc: 2_100_000,
        concepts: [
          {
            codigo: 'SALARIO_BASE',
            tipo: 'EARNING',
            base: null,
            factor: null,
            valor: 2_000_000,
          },
          {
            codigo: 'OVERTIME',
            tipo: 'EARNING',
            base: null,
            factor: null,
            valor: 100_000,
          },
        ],
        novelties: [],
      },
    });

    expect(result.payroll.tipoSalario).toBeNull();
  });

  it('prioriza la clasificación de salario integral', () => {
    const context = buildPilaSourceContext(contextInput);
    const result = buildPilaSourceSnapshot({
      context,
      payroll: {
        runId: 'run-integral',
        fechaPrevistaPagoPila: null,
        salarioBasico: 10_000_000,
        salarioIntegral: true,
        ibc: 7_000_000,
        concepts: [
          {
            codigo: 'OVERTIME',
            tipo: 'EARNING',
            base: null,
            factor: null,
            valor: 100_000,
          },
        ],
        novelties: [],
      },
    });

    expect(result.payroll.tipoSalario).toBe('X');
  });
});
