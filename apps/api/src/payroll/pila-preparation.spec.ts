import {
  buildPilaPreparationReport,
  inspectPilaSnapshotPreparation,
  type PilaSnapshotPreparationInput,
} from './pila-preparation';

function payload() {
  return {
    schemaVersion: 1,
    period: { fechaInicio: '2026-10-01', fechaFin: '2026-10-31' },
    employer: {
      tenantId: 'tenant-1',
      razonSocial: 'Empresa Demo SAS',
      nit: '900123456',
      digitoVerif: '7',
      direccion: 'Calle Demo 10',
      email: '',
      telefono: '6011234567',
      aportesExonerados: false,
      municipio: { codigo: '11001' },
      pila: {
        tipoDocumentoAportante: 'NI',
        naturalezaJuridica: '2',
        tipoPersona: 'J',
        formaPresentacion: 'U',
        claseAportante: 'B',
        codigoActividadEconomica: '1234',
        codigoArlAportante: '123456',
        tipoAportante: '1',
        codigoSucursal: '',
        nombreSucursal: '',
        fax: '',
        aportesExoneradosConfirmado: false,
        beneficioCcfLey1429: false,
        beneficioLey1429: false,
        sinAccionEspecial: true,
        representanteNumeroDocumento: '900123456',
        representanteTipoDocumento: 'CC',
        representantePrimerApellido: 'Demo',
        representanteSegundoApellido: '',
        representantePrimerNombre: 'Ana',
        representanteSegundoNombre: '',
      },
    },
    employee: {
      tipoDocumento: 'CC',
      cedula: '1234567890',
      primerNombre: 'Ana',
      segundoNombre: '',
      primerApellido: 'Demo',
      segundoApellido: '',
    },
    contract: { contractId: 'contract-1' },
    worksite: { municipio: { codigo: '11001' } },
    affiliations: [
      {
        tipoCotizanteCodigo: '01',
        subtipoCotizanteCodigo: '00',
        epsCodigo: 'EPS001',
        fondoPensionCodigo: 'AFP001',
        arlCodigo: 'ARL001',
        arlClaseRiesgo: '1',
        cajaCompensacionCodigo: 'CCF001',
        vigenteDesde: '2026-01-01',
        vigenteHasta: null,
      },
    ],
    payroll: {
      fechaPrevistaPagoPila: '2026-11-06' as string | null,
      salarioBasicoCampo40: { valor: 3000000, bloqueos: [] },
      tipoSalario: 'F',
      diasCotizadosPorSubsistema: {
        pension: { valor: 30 },
        salud: { valor: 30 },
        riesgos: { valor: 30 },
        cajaCompensacion: { valor: 30 },
      },
      ibcPorSubsistema: {
        pension: { valor: 3000000 },
        salud: { valor: 3000000 },
        riesgos: { valor: 3000000 },
        cajaCompensacion: { valor: 3000000 },
        otrosParafiscales: {
          valor: 3000000,
          bloqueos: [],
          reglaVersion: 'CO_PARAFISCAL_BASE_V1',
        },
      },
    },
  };
}

function payloadV2() {
  const source = payload();
  return {
    ...source,
    schemaVersion: 2,
    payroll: {
      ...source.payroll,
      concepts: [
        {
          conceptId: 'pension-employee',
          codigo: 'PENSION_EMP',
          tipo: 'DEDUCTION',
          base: 3_000_000,
          factor: 0.04,
          valor: 120_000,
        },
        {
          conceptId: 'pension-employer',
          codigo: 'PENSION_PAT',
          tipo: 'EMPLOYER_CONTRIBUTION',
          base: 3_000_000,
          factor: 0.12,
          valor: 360_000,
        },
        {
          conceptId: 'health-employee',
          codigo: 'SALUD_EMP',
          tipo: 'DEDUCTION',
          base: 3_000_000,
          factor: 0.04,
          valor: 120_000,
        },
        {
          conceptId: 'health-employer',
          codigo: 'SALUD_PAT',
          tipo: 'EMPLOYER_CONTRIBUTION',
          base: 3_000_000,
          factor: 0.085,
          valor: 255_000,
        },
        {
          conceptId: 'risk',
          codigo: 'ARL',
          tipo: 'EMPLOYER_CONTRIBUTION',
          base: 3_000_000,
          factor: 0.00522,
          valor: 15_660,
        },
        {
          conceptId: 'compensation-fund',
          codigo: 'CAJA',
          tipo: 'EMPLOYER_CONTRIBUTION',
          base: 3_000_000,
          factor: 0.04,
          valor: 120_000,
        },
        {
          conceptId: 'sena',
          codigo: 'SENA',
          tipo: 'EMPLOYER_CONTRIBUTION',
          base: 3_000_000,
          factor: 0.02,
          valor: 60_000,
        },
        {
          conceptId: 'icbf',
          codigo: 'ICBF',
          tipo: 'EMPLOYER_CONTRIBUTION',
          base: 3_000_000,
          factor: 0.03,
          valor: 90_000,
        },
      ],
    },
  };
}

function detailCandidateSnapshot(
  employeeId: string,
  employeeName: string,
  arlAmount = 15_700,
): PilaSnapshotPreparationInput {
  const source = payloadV2();
  Object.assign(source.period, {
    payrollPeriodId: 'period-1',
  });
  Object.assign(source.employee, {
    employeeId,
    fechaIngreso: '2026-01-01',
    fechaRetiro: null,
    primerNombre: employeeName,
  });
  Object.assign(source.contract, {
    fechaInicio: '2026-01-01',
    fechaFin: null,
  });
  for (const days of Object.values(source.payroll.diasCotizadosPorSubsistema)) {
    Object.assign(days, {
      reglaVersion: 'PILA_FULL_MONTH_DAYS_V1',
      bloqueos: [],
    });
  }
  for (const base of Object.values(source.payroll.ibcPorSubsistema)) {
    Object.assign(base, { sourceCount: 1 });
  }
  Object.assign(source.payroll, { pilaEvents: [], novelties: [] });
  Object.assign(source.affiliations[0], { colombianoEnElExterior: false });
  Object.assign(source, {
    pilaEvents: [],
    pilaRiskAssignments: [
      {
        tenantId: 'tenant-1',
        codigoActividadEconomica: '1131202',
        formatoNormativoVersion: 'DECRETO_768_2022',
        vigenteDesde: '2026-01-01',
        vigenteHasta: null,
        centroTrabajo: {
          tenantId: 'tenant-1',
          arlCodigo: 'ARL001',
          codigoCentro: '00012',
        },
      },
    ],
  });
  const arlConcept = source.payroll.concepts.find(
    ({ codigo }) => codigo === 'ARL',
  );
  if (arlConcept) arlConcept.valor = arlAmount;

  return {
    employeeId,
    payloadVersion: 2,
    payload: source,
  };
}

function snapshot(
  employeeId: string,
  employeeName: string,
  overrides: Partial<PilaSnapshotPreparationInput> = {},
): PilaSnapshotPreparationInput {
  const source = payload();
  source.employee.primerNombre = employeeName;
  return {
    employeeId,
    payloadVersion: 1,
    payload: source,
    totalCotizantes: 1,
    ...overrides,
  };
}

describe('inspectPilaSnapshotPreparation', () => {
  it('bloquea un snapshot PILA histórico o ausente sin completar desde el maestro', () => {
    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: null,
      payload: null,
    });

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'PILA_SNAPSHOT_VERSION_NO_SOPORTADA',
        record: 'SNAPSHOT',
      }),
    ]);
  });

  it('acepta fuentes de conceptos PILA completas y coherentes en snapshots v2', () => {
    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 2,
      payload: payloadV2(),
    });

    expect(
      result.issues.filter(({ code }) => code.includes('FUENTE_CONCEPTO')),
    ).toEqual([]);
  });

  it('bloquea la fuente obligatoria de aporte ausente en snapshot v2', () => {
    const source = payloadV2();
    source.payroll.concepts = source.payroll.concepts.filter(
      ({ codigo }) => codigo !== 'ARL',
    );

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 2,
      payload: source,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        fieldNumber: 63,
        code: 'CAMPO_63_FUENTE_CONCEPTO_NO_DISPONIBLE',
      }),
    );
  });

  it('bloquea filas de conceptos malformadas en snapshot v2', () => {
    const source = payloadV2();
    (source.payroll.concepts as unknown[]).push(null);

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 2,
      payload: source,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        record: 'SNAPSHOT',
        code: 'PILA_CONCEPTO_FILA_NO_VALIDA',
      }),
    );
  });

  it('bloquea fuentes de conceptos duplicadas en snapshots v2', () => {
    const source = payloadV2();
    const caja = source.payroll.concepts.find(
      ({ codigo }) => codigo === 'CAJA',
    )!;
    caja.base = 2_900_000;
    source.payroll.concepts.push({ ...caja });

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 2,
      payload: source,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        fieldNumber: 65,
        code: 'CAMPO_65_FUENTE_CONCEPTO_DUPLICADA',
      }),
    );
  });

  it('bloquea la base del concepto cuando no coincide con el IBC del subsistema', () => {
    const source = payloadV2();
    const pension = source.payroll.concepts.find(
      ({ codigo }) => codigo === 'PENSION_EMP',
    )!;
    pension.base = 2_900_000;

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 2,
      payload: source,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        fieldNumber: 42,
        code: 'CAMPO_42_FUENTE_CONCEPTO_BASE_NO_COINCIDE',
      }),
    );
  });

  it('bloquea tipo o valores candidatos inválidos en el concepto de aporte', () => {
    const source = payloadV2();
    const arl = source.payroll.concepts.find(({ codigo }) => codigo === 'ARL')!;
    arl.tipo = 'DEDUCTION';
    arl.factor = -0.1;
    arl.valor = 1_000_000_000;

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 2,
      payload: source,
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldNumber: 63,
          code: 'CAMPO_63_FUENTE_CONCEPTO_TIPO_INVALIDO',
        }),
        expect.objectContaining({
          fieldNumber: 63,
          code: 'CAMPO_63_FUENTE_CONCEPTO_VALOR_INVALIDO',
        }),
      ]),
    );
  });

  it('bloquea ubicación PILA basada solo en sede y detecta centro y actividad ARL pendientes', () => {
    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana'),
    );

    expect(result.employeeName).toBe('Ana Demo');
    expect(
      result.issues.map(({ fieldNumber, code }) => ({ fieldNumber, code })),
    ).toEqual([
      {
        fieldNumber: 9,
        code: 'UBICACION_LABORAL_PILA_SIN_FUENTE_CONFIRMADA',
      },
      {
        fieldNumber: 10,
        code: 'UBICACION_LABORAL_PILA_SIN_FUENTE_CONFIRMADA',
      },
      {
        fieldNumber: 62,
        code: 'CENTRO_TRABAJO_SIN_CODIGO_PILA',
      },
      {
        fieldNumber: 98,
        code: 'ACTIVIDAD_ARL_SIN_VIGENCIA_PILA',
      },
    ]);
  });

  it('bloquea salario e IBC que desbordan los campos numéricos AT2 de 9 posiciones', () => {
    const source = payload();
    source.payroll.salarioBasicoCampo40.valor = 1_000_000_000;
    source.payroll.ibcPorSubsistema.pension.valor = 1_000_000_000;
    source.payroll.ibcPorSubsistema.salud.valor = 1_000_000_000;
    source.payroll.ibcPorSubsistema.riesgos.valor = 1_000_000_000;
    source.payroll.ibcPorSubsistema.cajaCompensacion.valor = 1_000_000_000;
    source.payroll.ibcPorSubsistema.otrosParafiscales.valor = 1_000_000_000;

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(
      result.issues
        .filter(({ code }) => code.includes('SUPERA_LONGITUD'))
        .map(({ fieldNumber, code }) => ({ fieldNumber, code })),
    ).toEqual([
      { fieldNumber: 40, code: 'CAMPO_40_SALARIO_BASICO_SUPERA_LONGITUD' },
      { fieldNumber: 42, code: 'CAMPO_42_IBC_SUPERA_LONGITUD' },
      { fieldNumber: 43, code: 'CAMPO_43_IBC_SUPERA_LONGITUD' },
      { fieldNumber: 44, code: 'CAMPO_44_IBC_SUPERA_LONGITUD' },
      { fieldNumber: 45, code: 'CAMPO_45_IBC_SUPERA_LONGITUD' },
      { fieldNumber: 95, code: 'CAMPO_95_IBC_SUPERA_LONGITUD' },
    ]);
  });

  it('acepta el mayor valor representable en un campo numérico de 9 posiciones', () => {
    const source = payload();
    source.payroll.salarioBasicoCampo40.valor = 999_999_999;
    source.payroll.ibcPorSubsistema.pension.valor = 999_999_999;
    source.payroll.ibcPorSubsistema.salud.valor = 999_999_999;
    source.payroll.ibcPorSubsistema.riesgos.valor = 999_999_999;
    source.payroll.ibcPorSubsistema.cajaCompensacion.valor = 999_999_999;
    source.payroll.ibcPorSubsistema.otrosParafiscales.valor = 999_999_999;

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(
      result.issues.filter(({ code }) => code.includes('SUPERA_LONGITUD')),
    ).toEqual([]);
  });

  it('bloquea datos del aportante y representante que exceden las longitudes AT2', () => {
    const source = payload();
    source.employer.razonSocial = 'R'.repeat(201);
    source.employer.direccion = 'D'.repeat(41);
    source.employer.email = 'e'.repeat(61);
    source.employer.pila.formaPresentacion = 'S';
    source.employer.pila.codigoSucursal = 'S'.repeat(11);
    source.employer.pila.nombreSucursal = 'N'.repeat(41);
    source.employer.pila.fax = '1'.repeat(11);
    source.employer.pila.representanteNumeroDocumento = '1'.repeat(17);
    source.employer.pila.representantePrimerApellido = 'A'.repeat(21);
    source.employer.pila.representanteSegundoApellido = 'B'.repeat(31);
    source.employer.pila.representantePrimerNombre = 'C'.repeat(21);
    source.employer.pila.representanteSegundoNombre = 'D'.repeat(31);

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(
      result.issues
        .filter(
          ({ record, code }) =>
            record === 'APORTANTE_TIPO_1' && code.includes('LONGITUD_SUPERADA'),
        )
        .map(({ fieldNumber, code }) => ({ fieldNumber, code })),
    ).toEqual([
      { fieldNumber: 1, code: 'CAMPO_1_LONGITUD_SUPERADA' },
      { fieldNumber: 5, code: 'CAMPO_5_LONGITUD_SUPERADA' },
      { fieldNumber: 6, code: 'CAMPO_6_LONGITUD_SUPERADA' },
      { fieldNumber: 11, code: 'CAMPO_11_LONGITUD_SUPERADA' },
      { fieldNumber: 16, code: 'CAMPO_16_LONGITUD_SUPERADA' },
      { fieldNumber: 17, code: 'CAMPO_17_LONGITUD_SUPERADA' },
      { fieldNumber: 18, code: 'CAMPO_18_LONGITUD_SUPERADA' },
      { fieldNumber: 21, code: 'CAMPO_21_LONGITUD_SUPERADA' },
      { fieldNumber: 22, code: 'CAMPO_22_LONGITUD_SUPERADA' },
      { fieldNumber: 23, code: 'CAMPO_23_LONGITUD_SUPERADA' },
      { fieldNumber: 24, code: 'CAMPO_24_LONGITUD_SUPERADA' },
    ]);
  });

  it('acepta las longitudes máximas de los datos de aportante y representante', () => {
    const source = payload();
    source.employer.razonSocial = 'R'.repeat(200);
    source.employer.direccion = 'D'.repeat(40);
    source.employer.email = `${'a'.repeat(54)}@b.com`;
    source.employer.pila.formaPresentacion = 'S';
    source.employer.pila.codigoSucursal = 'S'.repeat(10);
    source.employer.pila.nombreSucursal = 'N'.repeat(40);
    source.employer.pila.fax = '1'.repeat(10);
    source.employer.pila.representanteTipoDocumento = 'PA';
    source.employer.pila.representanteNumeroDocumento = 'A'.repeat(16);
    source.employer.pila.representantePrimerApellido = 'A'.repeat(20);
    source.employer.pila.representanteSegundoApellido = 'B'.repeat(30);
    source.employer.pila.representantePrimerNombre = 'C'.repeat(20);
    source.employer.pila.representanteSegundoNombre = 'D'.repeat(30);

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(
      result.issues.filter(
        ({ record, code }) =>
          record === 'APORTANTE_TIPO_1' && code.includes('LONGITUD_SUPERADA'),
      ),
    ).toEqual([]);
  });

  it('permite usar el código PILA como nombre de sucursal cuando no hay nombre', () => {
    const source = payload();
    source.employer.pila.formaPresentacion = 'S';
    source.employer.pila.codigoSucursal = 'BR01';
    source.employer.pila.nombreSucursal = '';

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(
      result.issues.filter(
        ({ record, fieldNumber }) =>
          record === 'APORTANTE_TIPO_1' && [5, 6].includes(fieldNumber ?? -1),
      ),
    ).toEqual([]);
  });

  it('bloquea el código de sucursal si la presentación es única', () => {
    const source = payload();
    source.employer.pila.formaPresentacion = 'U';
    source.employer.pila.codigoSucursal = 'BR01';

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        record: 'APORTANTE_TIPO_1',
        fieldNumber: 5,
        code: 'CAMPO_5_CODIGO_SUCURSAL_NO_PERMITIDO_EN_PRESENTACION_UNICA',
      }),
    );
  });

  it('bloquea fax no numérico y correo que incumple el formato AT2', () => {
    const source = payload();
    source.employer.email = 'Ana@-dominio.co';
    source.employer.pila.fax = '601-123';

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(
      result.issues
        .filter(
          ({ record, code }) =>
            record === 'APORTANTE_TIPO_1' && code.endsWith('NO_VALIDO'),
        )
        .map(({ fieldNumber, code }) => ({ fieldNumber, code })),
    ).toEqual([
      { fieldNumber: 16, code: 'CAMPO_16_FAX_NO_VALIDO' },
      { fieldNumber: 17, code: 'CAMPO_17_CORREO_NO_VALIDO' },
    ]);
  });

  it('valida el documento del representante según el tipo declarado', () => {
    const source = payload();
    source.employer.pila.representanteNumeroDocumento = 'ABC123';

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        record: 'APORTANTE_TIPO_1',
        fieldNumber: 18,
        code: 'CAMPO_18_IDENTIFICACION_REPRESENTANTE_NO_VALIDA',
      }),
    );
  });

  it('bloquea un tipo de identificación no permitido para el representante', () => {
    const source = payload();
    source.employer.pila.representanteTipoDocumento = 'TI';

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        record: 'APORTANTE_TIPO_1',
        fieldNumber: 20,
        code: 'CAMPO_20_DOCUMENTO_REPRESENTANTE_NO_VALIDO',
      }),
    );
  });

  it('permite omitir la identificación del representante para persona natural', () => {
    const source = payload();
    source.employer.pila.tipoPersona = 'N';
    source.employer.pila.tipoDocumentoAportante = 'CC';
    source.employer.digitoVerif = '0';
    source.employer.pila.representanteTipoDocumento = '';
    source.employer.pila.representanteNumeroDocumento = '';

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(
      result.issues.filter(
        ({ record, fieldNumber }) =>
          record === 'APORTANTE_TIPO_1' &&
          [4, 18, 20].includes(fieldNumber ?? -1),
      ),
    ).toEqual([]);
  });

  it('requiere dígito de verificación cero para persona natural', () => {
    const source = payload();
    source.employer.pila.tipoPersona = 'N';
    source.employer.pila.tipoDocumentoAportante = 'CC';
    source.employer.digitoVerif = '7';
    source.employer.pila.representanteTipoDocumento = '';
    source.employer.pila.representanteNumeroDocumento = '';

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        record: 'APORTANTE_TIPO_1',
        fieldNumber: 4,
        code: 'CAMPO_4_DV_PERSONA_NATURAL_DEBE_SER_CERO',
      }),
    );
  });

  it.each([
    ['CC', '1234567890'],
    ['CE', '1234567'],
    ['TI', '12345678901'],
    ['PA', 'A123456789012345'],
    ['CD', 'A1234567890'],
    ['NI', '90012345678'],
    ['SC', '12345678'],
    ['PE', '123456789012345'],
    ['PT', '12345678'],
    ['PC', '12345678'],
  ])('acepta identificación %s en el límite AT2 del aportante', (type, id) => {
    const source = payload();
    source.employer.pila.tipoDocumentoAportante = type;
    source.employer.nit = id;

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(
      result.issues.filter(
        ({ record, fieldNumber }) =>
          record === 'APORTANTE_TIPO_1' && fieldNumber === 3,
      ),
    ).toEqual([]);
  });

  it.each([
    ['CC', '12345678901'],
    ['CE', '12345678'],
    ['TI', '123456789012'],
    ['NI', '900ABC'],
    ['SC', '123456789'],
    ['PE', '12345678901234'],
    ['PT', 'A1234567'],
    ['PC', '1234-567'],
    ['CD', 'A123456789012'],
  ])(
    'bloquea identificación %s que no cumple AT2 para el aportante',
    (type, id) => {
      const source = payload();
      source.employer.pila.tipoDocumentoAportante = type;
      source.employer.nit = id;

      const result = inspectPilaSnapshotPreparation(
        snapshot('employee-1', 'Ana', { payload: source }),
      );

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          record: 'APORTANTE_TIPO_1',
          fieldNumber: 3,
          code: 'CAMPO_3_IDENTIFICACION_APORTANTE_NO_VALIDA',
        }),
      );
    },
  );

  it.each([
    ['CC', '1234567890'],
    ['CE', '1234567'],
    ['PA', 'A123456789012345'],
    ['CD', 'A1234567890'],
  ])(
    'acepta identificación %s de representante en su límite oficial',
    (tipoDocumento, numeroDocumento) => {
      const source = payload();
      source.employer.pila.representanteTipoDocumento = tipoDocumento;
      source.employer.pila.representanteNumeroDocumento = numeroDocumento;

      const result = inspectPilaSnapshotPreparation(
        snapshot('employee-1', 'Ana', { payload: source }),
      );

      expect(
        result.issues.filter(
          ({ record, fieldNumber }) =>
            record === 'APORTANTE_TIPO_1' && fieldNumber === 18,
        ),
      ).toEqual([]);
    },
  );

  it.each([
    ['CC', '1'.repeat(10)],
    ['CE', '1'.repeat(7)],
    ['TI', '1'.repeat(11)],
    ['NI', '1'.repeat(11)],
    ['PA', 'A'.repeat(16)],
    ['CD', 'A'.repeat(11)],
    ['SC', '1'.repeat(8)],
    ['PE', '1'.repeat(15)],
    ['PT', '1'.repeat(8)],
    ['PC', '1'.repeat(8)],
  ])('acepta identificación AT2 máxima del aportante %s', (type, value) => {
    const source = payload();
    source.employer.pila.tipoDocumentoAportante = type;
    source.employer.nit = value;

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(
      result.issues.filter(
        ({ record, fieldNumber }) =>
          record === 'APORTANTE_TIPO_1' && fieldNumber === 3,
      ),
    ).toEqual([]);
  });

  it.each([
    ['CC', '12345678901'],
    ['CE', '12345678'],
    ['TI', '123456789012'],
    ['NI', '123456789012'],
    ['PA', 'A'.repeat(17)],
    ['CD', 'A'.repeat(12)],
    ['SC', '123456789'],
    ['PE', '1234567890123456'],
    ['PT', '123456789'],
    ['PC', '123456789'],
    ['CC', 'A123'],
    ['PA', 'AB-123'],
  ])(
    'bloquea el documento del aportante %s que excede o incumple la regla AT2',
    (type, identification) => {
      const source = payload();
      source.employer.pila.tipoDocumentoAportante = type;
      source.employer.nit = identification;

      const result = inspectPilaSnapshotPreparation(
        snapshot('employee-1', 'Ana', { payload: source }),
      );

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          record: 'APORTANTE_TIPO_1',
          fieldNumber: 3,
          code: 'CAMPO_3_IDENTIFICACION_APORTANTE_NO_VALIDA',
        }),
      );
    },
  );

  it.each([
    ['CC', '1'.repeat(10)],
    ['CE', '1'.repeat(7)],
    ['PA', 'A'.repeat(16)],
    ['CD', 'A'.repeat(11)],
  ])('acepta identificación AT2 máxima del representante %s', (type, value) => {
    const source = payload();
    source.employer.pila.representanteTipoDocumento = type;
    source.employer.pila.representanteNumeroDocumento = value;

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(
      result.issues.filter(
        ({ record, fieldNumber }) =>
          record === 'APORTANTE_TIPO_1' && fieldNumber === 18,
      ),
    ).toEqual([]);
  });

  it.each([
    ['CC', '12345678901'],
    ['CE', '12345678'],
    ['CD', 'A'.repeat(12)],
    ['CC', 'A123'],
  ])(
    'bloquea el documento del representante %s que incumple la regla AT2',
    (type, identification) => {
      const source = payload();
      source.employer.pila.representanteTipoDocumento = type;
      source.employer.pila.representanteNumeroDocumento = identification;

      const result = inspectPilaSnapshotPreparation(
        snapshot('employee-1', 'Ana', { payload: source }),
      );

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          record: 'APORTANTE_TIPO_1',
          fieldNumber: 18,
          code: 'CAMPO_18_IDENTIFICACION_REPRESENTANTE_NO_VALIDA',
        }),
      );
    },
  );

  it.each([
    ['CC', '12345678901'],
    ['CE', '12345678'],
    ['TI', '123456789012'],
    ['PA', 'A1234567890123456'],
    ['CC', 'A234567890'],
    ['PA', 'AB-123'],
  ])(
    'bloquea una identificación %s que no cumple los caracteres o longitud AT2',
    (type, identification) => {
      const source = payload();
      source.employee.tipoDocumento = type;
      source.employee.cedula = identification;

      const result = inspectPilaSnapshotPreparation(
        snapshot('employee-1', 'Ana', { payload: source }),
      );

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          fieldNumber: 4,
          code: 'CAMPO_4_IDENTIFICACION_NO_VALIDA',
        }),
      );
    },
  );

  it.each([
    ['CC', '1234567890'],
    ['CE', '1234567'],
    ['TI', '12345678901'],
    ['PA', 'A123456789012345'],
  ])('acepta la longitud máxima AT2 para identificación %s', (type, value) => {
    const source = payload();
    source.employee.tipoDocumento = type;
    source.employee.cedula = value;

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(
      result.issues.filter(({ fieldNumber }) => fieldNumber === 4),
    ).toEqual([]);
  });

  it('bloquea nombres superiores a las longitudes de los campos AT2', () => {
    const source = payload();
    source.employee.primerApellido = 'A'.repeat(21);
    source.employee.segundoApellido = 'B'.repeat(31);
    source.employee.primerNombre = 'C'.repeat(21);
    source.employee.segundoNombre = 'D'.repeat(31);

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(
      result.issues
        .filter(({ code }) => code.includes('LONGITUD_SUPERADA'))
        .map(({ fieldNumber, code }) => ({ fieldNumber, code })),
    ).toEqual([
      { fieldNumber: 11, code: 'CAMPO_11_LONGITUD_SUPERADA' },
      { fieldNumber: 12, code: 'CAMPO_12_LONGITUD_SUPERADA' },
      { fieldNumber: 13, code: 'CAMPO_13_LONGITUD_SUPERADA' },
      { fieldNumber: 14, code: 'CAMPO_14_LONGITUD_SUPERADA' },
    ]);
  });

  it('acepta las longitudes máximas de los cuatro campos de nombres AT2', () => {
    const source = payload();
    source.employee.primerApellido = 'A'.repeat(20);
    source.employee.segundoApellido = 'B'.repeat(30);
    source.employee.primerNombre = 'C'.repeat(20);
    source.employee.segundoNombre = 'D'.repeat(30);

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(
      result.issues.filter(({ code }) => code.includes('LONGITUD_SUPERADA')),
    ).toEqual([]);
  });

  it('bloquea el código ARL del aportante que excede las seis posiciones AT2', () => {
    const source = payload();
    source.employer.pila.codigoArlAportante = 'A'.repeat(7);

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        record: 'CABECERA_TIPO_2',
        fieldNumber: 14,
        code: 'CAMPO_14_LONGITUD_SUPERADA',
      }),
    );
  });

  it('acepta el código ARL del aportante en su longitud máxima de seis posiciones', () => {
    const source = payload();
    source.employer.pila.codigoArlAportante = 'A1B2C3';

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(
      result.issues.filter(
        ({ record, fieldNumber }) =>
          record === 'CABECERA_TIPO_2' && fieldNumber === 14,
      ),
    ).toEqual([]);
  });

  it.each([
    [31, 'fondoPensionCodigo'],
    [33, 'epsCodigo'],
    [35, 'cajaCompensacionCodigo'],
    [77, 'arlCodigo'],
  ] as const)(
    'bloquea el código de afiliación del campo %i si excede seis posiciones',
    (fieldNumber, key) => {
      const source = payload();
      Object.assign(source.affiliations[0], { [key]: 'A'.repeat(7) });

      const result = inspectPilaSnapshotPreparation(
        snapshot('employee-1', 'Ana', { payload: source }),
      );

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          fieldNumber,
          code: `CAMPO_${fieldNumber}_LONGITUD_SUPERADA`,
        }),
      );
    },
  );

  it('acepta los códigos de afiliación de seis posiciones de AT2', () => {
    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: payload() }),
    );

    expect(
      result.issues.filter(({ fieldNumber }) =>
        [31, 33, 35, 77].includes(fieldNumber ?? -1),
      ),
    ).toEqual([]);
  });

  it('bloquea la afiliación sin código ARL para el campo 77', () => {
    const source = payload();
    source.affiliations[0].arlCodigo = '';

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        record: 'DETALLE_TIPO_2',
        fieldNumber: 77,
        code: 'CAMPO_77_SIN_DATO',
      }),
    );
  });

  it.each([
    [99_999, false],
    [100_000, true],
  ])(
    'valida que el conteo de cotizantes %i quepa en el campo 19 de cinco dígitos',
    (totalCotizantes, shouldBlock) => {
      const result = inspectPilaSnapshotPreparation({
        employeeId: 'employee-1',
        payloadVersion: 1,
        payload: payload(),
        totalCotizantes,
      });

      const fieldIssues = result.issues.filter(
        ({ record, fieldNumber }) =>
          record === 'CABECERA_TIPO_2' && fieldNumber === 19,
      );
      if (shouldBlock) {
        expect(fieldIssues).toContainEqual(
          expect.objectContaining({
            code: 'CAMPO_19_CONTEO_COTIZANTES_SUPERA_LONGITUD',
          }),
        );
      } else {
        expect(fieldIssues).toEqual([]);
      }
    },
  );

  it('counts raw whitespace when validating an A6 affiliation code', () => {
    const source = payload();
    source.affiliations[0].arlCodigo = 'ARL001 ';

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        fieldNumber: 77,
        code: 'CAMPO_77_LONGITUD_SUPERADA',
      }),
    );
  });
  it.each([
    ['faltante', null],
    ['especial', '01'],
  ] as const)('bloquea un subtipo PILA %s fuera de 00', (_, subtype) => {
    const source = payload();
    const affiliation = source.affiliations[0] as {
      subtipoCotizanteCodigo: string | null;
    };
    affiliation.subtipoCotizanteCodigo = subtype;

    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana', { payload: source }),
    );

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        fieldNumber: 6,
        code: 'CAMPO_6_SIN_VALOR_VALIDO',
      }),
    );
  });

  it.each(['0001', '123456789'])(
    'acepta los campos 62 y 98 cuando el código %s cabe en N9',
    (codigoCentro) => {
      const source = {
        ...payload(),
        schemaVersion: 2,
        pilaRiskAssignments: [
          {
            assignmentId: 'assignment-1',
            tenantId: 'tenant-1',
            codigoActividadEconomica: '1131202',
            formatoNormativoVersion: 'DECRETO_768_2022',
            vigenteDesde: '2026-01-01',
            vigenteHasta: null,
            centroTrabajo: {
              centroTrabajoId: 'center-1',
              tenantId: 'tenant-1',
              sedeId: 'site-1',
              arlCodigo: 'ARL001',
              codigoCentro,
              nombre: 'Centro principal',
            },
          },
        ],
      };

      const result = inspectPilaSnapshotPreparation({
        employeeId: 'employee-1',
        payloadVersion: 2,
        payload: source,
      });

      expect(result.issues).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fieldNumber: 62 }),
          expect.objectContaining({ fieldNumber: 98 }),
        ]),
      );
    },
  );

  it.each(['CENTRO-1', '1234567890', ' 0001 '])(
    'bloquea el código de centro %s porque no cabe en el campo 62 N9',
    (codigoCentro) => {
      const source = {
        ...payload(),
        schemaVersion: 2,
        pilaRiskAssignments: [
          {
            assignmentId: 'assignment-1',
            tenantId: 'tenant-1',
            codigoActividadEconomica: '1131202',
            formatoNormativoVersion: 'DECRETO_768_2022',
            vigenteDesde: '2026-01-01',
            vigenteHasta: null,
            centroTrabajo: {
              centroTrabajoId: 'center-1',
              tenantId: 'tenant-1',
              sedeId: 'site-1',
              arlCodigo: 'ARL001',
              codigoCentro,
              nombre: 'Centro principal',
            },
          },
        ],
      };

      const result = inspectPilaSnapshotPreparation({
        employeeId: 'employee-1',
        payloadVersion: 2,
        payload: source,
      });

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          fieldNumber: 62,
          code: 'CENTRO_TRABAJO_CODIGO_FORMATO_AT2_INVALIDO',
        }),
      );
    },
  );

  it('bloquea afiliaciones si una fila malformada acompaña a la fila válida', () => {
    const source = payload();
    Object.assign(source, {
      affiliations: [...source.affiliations, null],
    });

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 1,
      payload: source,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        fieldNumber: 5,
        code: 'AFILIACION_PILA_FILA_NO_VALIDA',
      }),
    );
  });

  it('bloquea asignaciones ARL si una fila malformada acompaña a la válida', () => {
    const source = {
      ...payload(),
      schemaVersion: 2,
      pilaRiskAssignments: [
        {
          assignmentId: 'assignment-1',
          tenantId: 'tenant-1',
          codigoActividadEconomica: '1131202',
          formatoNormativoVersion: 'DECRETO_768_2022',
          vigenteDesde: '2026-01-01',
          vigenteHasta: null,
          centroTrabajo: {
            centroTrabajoId: 'center-1',
            tenantId: 'tenant-1',
            sedeId: 'site-1',
            arlCodigo: 'ARL001',
            codigoCentro: '0001',
            nombre: 'Centro principal',
          },
        },
        null,
      ],
    };

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 2,
      payload: source,
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldNumber: 62,
          code: 'CENTRO_TRABAJO_PILA_FILA_NO_VALIDA',
        }),
        expect.objectContaining({
          fieldNumber: 98,
          code: 'ACTIVIDAD_ARL_PILA_FILA_NO_VALIDA',
        }),
      ]),
    );
  });

  it('bloquea actividad inexistente en el catálogo aunque tenga siete dígitos', () => {
    const source = {
      ...payload(),
      schemaVersion: 2,
      pilaRiskAssignments: [
        {
          assignmentId: 'assignment-1',
          tenantId: 'tenant-1',
          codigoActividadEconomica: '1999999',
          formatoNormativoVersion: 'DECRETO_768_2022',
          vigenteDesde: '2026-01-01',
          vigenteHasta: null,
          centroTrabajo: {
            centroTrabajoId: 'center-1',
            tenantId: 'tenant-1',
            sedeId: null,
            arlCodigo: 'ARL001',
            codigoCentro: '0001',
            nombre: 'Centro principal',
          },
        },
      ],
    };

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 2,
      payload: source,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        fieldNumber: 98,
        code: 'ACTIVIDAD_ARL_NO_VALIDA_CATALOGO_PILA',
      }),
    );
  });

  it('marca los campos obligatorios faltantes y exige segmentación para días parciales', () => {
    const incomplete = payload();
    incomplete.employer.pila.tipoPersona = '';
    incomplete.employee.tipoDocumento = 'PPT';
    incomplete.payroll.diasCotizadosPorSubsistema.pension.valor = 29;
    incomplete.payroll.ibcPorSubsistema.salud.valor = 3000000.5;

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 1,
      payload: incomplete,
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldNumber: 9,
          code: 'CAMPO_9_SIN_VALOR_VALIDO',
        }),
        expect.objectContaining({
          fieldNumber: 3,
          code: 'CAMPO_3_DOCUMENTO_SIN_MAPEO_AT2',
        }),
        expect.objectContaining({
          fieldNumber: 36,
          code: 'CAMPO_36_REQUIERE_SEGMENTACION',
        }),
        expect.objectContaining({
          fieldNumber: 43,
          code: 'CAMPO_43_IBC_NO_APROBADO',
        }),
      ]),
    );
  });

  it('bloquea el campo 26 si el aportante declara una acción especial', () => {
    const source = payload();
    source.employer.pila.sinAccionEspecial = false;

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 1,
      payload: source,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        record: 'APORTANTE_TIPO_1',
        fieldNumber: 26,
        code: 'CAMPO_26_ACCION_ESPECIAL_FUERA_DEL_MVP',
      }),
    );
  });

  it('bloquea el campo 26 si el aportante no confirmó que no hay acción especial', () => {
    const source = payload();
    const incomplete = {
      ...source,
      employer: {
        ...source.employer,
        pila: { ...source.employer.pila, sinAccionEspecial: null },
      },
    };

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 1,
      payload: incomplete,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        record: 'APORTANTE_TIPO_1',
        fieldNumber: 26,
        code: 'CAMPO_26_ACCION_ESPECIAL_SIN_CONFIRMAR',
      }),
    );
  });

  it('valida la clase A/B con el total de cotizantes únicos del período', () => {
    const source = payload();
    source.employer.pila.claseAportante = 'B';

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 1,
      payload: source,
      totalCotizantes: 200,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        record: 'APORTANTE_TIPO_1',
        fieldNumber: 7,
        code: 'CAMPO_7_CLASE_NO_COINCIDE_COTIZANTES',
      }),
    );
  });

  it('bloquea una clase A/B incompatible con el beneficio de Ley 1429', () => {
    const source = payload();
    source.employer.pila.claseAportante = 'B';
    source.employer.pila.beneficioLey1429 = true;

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 1,
      payload: source,
      totalCotizantes: 1,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        record: 'APORTANTE_TIPO_1',
        fieldNumber: 7,
        code: 'CAMPO_7_CLASE_BENEFICIO_LEY1429_INCONSISTENTE',
      }),
    );
  });

  it('mantiene bloqueados beneficios declarados hasta validar su elegibilidad', () => {
    const source = payload();
    source.employer.aportesExonerados = true;
    source.employer.pila.aportesExoneradosConfirmado = true;
    source.employer.pila.beneficioCcfLey1429 = true;

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 1,
      payload: source,
      totalCotizantes: 1,
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          record: 'APORTANTE_TIPO_1',
          fieldNumber: 33,
          code: 'CAMPO_33_ELEGIBILIDAD_EXONERACION_SIN_VALIDAR',
        }),
        expect.objectContaining({
          record: 'APORTANTE_TIPO_1',
          fieldNumber: 34,
          code: 'CAMPO_34_ELEGIBILIDAD_CCF_SIN_VALIDAR',
        }),
        expect.objectContaining({
          record: 'DETALLE_TIPO_2',
          fieldNumber: 76,
          code: 'CAMPO_76_ELEGIBILIDAD_EXONERACION_SIN_VALIDAR',
        }),
      ]),
    );
  });

  it.each(['C', 'D'])(
    'bloquea la clase especial %s sin evidencia de elegibilidad',
    (value) => {
      const source = payload();
      source.employer.pila.claseAportante = value;

      const result = inspectPilaSnapshotPreparation({
        employeeId: 'employee-1',
        payloadVersion: 1,
        payload: source,
        totalCotizantes: 1,
      });

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          record: 'APORTANTE_TIPO_1',
          fieldNumber: 7,
          code: 'CAMPO_7_ELEGIBILIDAD_ESPECIAL_SIN_VERIFICAR',
        }),
      );
    },
  );

  it.each([
    { code: 'ING', fieldNumber: 15 },
    { code: 'RET', fieldNumber: 16 },
    { code: 'VSP', fieldNumber: 21 },
    { code: 'VST', fieldNumber: 23 },
    { code: 'SLN', fieldNumber: 24 },
    { code: 'IGE', fieldNumber: 25 },
    { code: 'LMA', fieldNumber: 26 },
    { code: 'VAC_LR', fieldNumber: 27 },
    { code: 'VCT', fieldNumber: 29 },
    { code: 'IRL', fieldNumber: 30 },
  ])(
    'reports PILA event $code as an unsegmented approved snapshot source',
    ({ code, fieldNumber }) => {
      const source = payload() as ReturnType<typeof payload> & {
        pilaEvents?: unknown;
      };
      source.schemaVersion = 2;
      const payroll = source.payroll as typeof source.payroll & {
        pilaEvents?: unknown;
      };
      const events = [
        { codigo: code, fechaInicio: '2026-10-12', fechaFin: null, dias: null },
      ];
      payroll.pilaEvents = events;
      source.pilaEvents = events;

      const result = inspectPilaSnapshotPreparation({
        employeeId: 'employee-1',
        payloadVersion: 2,
        payload: source,
        totalCotizantes: 1,
      });

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          record: 'DETALLE_TIPO_2',
          fieldNumber,
          code: `EVENTO_PILA_${code}_SIN_SEGMENTACION_APROBADA`,
        }),
      );
    },
  );

  it('blocks a v2 PILA snapshot that omits its frozen event list', () => {
    const source = payload();
    source.schemaVersion = 2;

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 2,
      payload: source,
      totalCotizantes: 1,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        record: 'DETALLE_TIPO_2',
        fieldNumber: null,
        code: 'EVENTOS_PILA_NO_CONSERVADOS_EN_SNAPSHOT',
      }),
    );
  });

  it('blocks a v2 PILA snapshot that omits one of its event copies', () => {
    const source = payload() as ReturnType<typeof payload> & {
      pilaEvents?: unknown;
    };
    source.schemaVersion = 2;
    source.pilaEvents = [];

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 2,
      payload: source,
      totalCotizantes: 1,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        record: 'DETALLE_TIPO_2',
        fieldNumber: null,
        code: 'EVENTOS_PILA_SNAPSHOT_DESINCRONIZADO',
      }),
    );
  });

  it('blocks inconsistent event copies and still reports every known event code', () => {
    const source = payload() as ReturnType<typeof payload> & {
      pilaEvents?: unknown;
    };
    source.schemaVersion = 2;
    const payroll = source.payroll as typeof source.payroll & {
      pilaEvents?: unknown;
    };
    payroll.pilaEvents = [];
    source.pilaEvents = [
      { codigo: 'RET', fechaInicio: '2026-10-25', fechaFin: null, dias: null },
    ];

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 2,
      payload: source,
      totalCotizantes: 1,
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'EVENTOS_PILA_SNAPSHOT_DESINCRONIZADO',
        }),
        expect.objectContaining({
          fieldNumber: 16,
          code: 'EVENTO_PILA_RET_SIN_SEGMENTACION_APROBADA',
        }),
      ]),
    );
  });

  it('blocks event codes outside the reviewed MVP matrix', () => {
    const source = payload();
    source.schemaVersion = 2;
    const payroll = source.payroll as typeof source.payroll & {
      pilaEvents?: unknown;
    };
    payroll.pilaEvents = [{ codigo: 'TDE', fechaInicio: '2026-10-12' }];
    Object.assign(source, { pilaEvents: payroll.pilaEvents });

    const result = inspectPilaSnapshotPreparation({
      employeeId: 'employee-1',
      payloadVersion: 2,
      payload: source,
      totalCotizantes: 1,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        record: 'DETALLE_TIPO_2',
        fieldNumber: null,
        code: 'EVENTO_PILA_CODIGO_FUERA_DE_MATRIZ',
      }),
    );
  });

  it('agrupa faltantes por campo y declara expresamente que el archivo aún no se genera', () => {
    const report = buildPilaPreparationReport({
      period: {
        id: 'period-1',
        fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
        fechaFin: new Date('2026-10-31T00:00:00.000Z'),
      },
      snapshots: [
        snapshot('employee-1', 'Ana'),
        snapshot('employee-2', 'Luis'),
      ],
    });

    expect(report).toMatchObject({
      formatVersion: null,
      normativeSourceStatus: 'RECONCILIATION_PENDING',
      snapshotsRevisados: 2,
      empleadosConDatosPendientes: 2,
      empleadosSinBrechasDetectadas: 0,
      archivoGenerable: false,
      estadoArchivo: 'NO_IMPLEMENTADO',
    });
    expect(report.exportReadiness.blockers).not.toContainEqual(
      expect.objectContaining({ code: 'PILA_PAYMENT_DATE_REQUIRED' }),
    );
    expect(report.exportReadiness.blockers).not.toContainEqual(
      expect.objectContaining({
        code: 'PILA_PENSION_RULESET_AFTER_2027_NOT_RECONCILED',
      }),
    );
    expect(report.period.fechaPrevistaPagoPila).toBe('2026-11-06');
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldNumber: 62,
          affectedCount: 2,
          affectedEmployees: ['Ana Demo', 'Luis Demo'],
        }),
        expect.objectContaining({ fieldNumber: 98, affectedCount: 2 }),
      ]),
    );
  });

  it('expone candidatos parciales por campo sin habilitar el archivo', () => {
    const compliant = detailCandidateSnapshot('employee-1', 'Ana');
    const arlAmountNotRounded = detailCandidateSnapshot(
      'employee-2',
      'Luis',
      15_660,
    );
    const report = buildPilaPreparationReport({
      period: {
        id: 'period-1',
        fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
        fechaFin: new Date('2026-10-31T00:00:00.000Z'),
      },
      snapshots: [compliant, arlAmountNotRounded],
    });
    const statusFor = (fieldNumber: number) =>
      report.detailContributionCandidates.find(
        (status) => status.fieldNumber === fieldNumber,
      );

    expect(statusFor(61)).toMatchObject({
      candidateEmployees: 2,
      pendingEmployees: 0,
    });
    expect(statusFor(46)).toMatchObject({
      candidateEmployees: 2,
      pendingEmployees: 0,
    });
    expect(statusFor(47)).toMatchObject({
      candidateEmployees: 2,
      pendingEmployees: 0,
    });
    expect(statusFor(54)).toMatchObject({
      candidateEmployees: 2,
      pendingEmployees: 0,
    });
    expect(statusFor(55)).toMatchObject({
      candidateEmployees: 2,
      pendingEmployees: 0,
    });
    const field63 = statusFor(63);
    expect(field63).toMatchObject({
      candidateEmployees: 1,
      pendingEmployees: 1,
    });
    expect(field63?.pendingReasons[0]?.reason).toContain(
      'múltiplo de 100 superior',
    );
    expect(field63?.pendingReasons[0]?.affectedEmployees).toEqual([
      'Luis Demo',
    ]);
    expect(statusFor(65)).toMatchObject({
      candidateEmployees: 2,
      pendingEmployees: 0,
    });
    expect(statusFor(67)).toMatchObject({
      candidateEmployees: 2,
      pendingEmployees: 0,
    });
    expect(statusFor(69)).toMatchObject({
      candidateEmployees: 2,
      pendingEmployees: 0,
    });
    expect(report.detailNoEventFieldCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldNumber: 57,
          candidateEmployees: 2,
          pendingEmployees: 0,
        }),
        expect.objectContaining({
          fieldNumber: 58,
          candidateEmployees: 2,
          pendingEmployees: 0,
        }),
        expect.objectContaining({
          fieldNumber: 59,
          candidateEmployees: 2,
          pendingEmployees: 0,
        }),
        expect.objectContaining({
          fieldNumber: 60,
          candidateEmployees: 2,
          pendingEmployees: 0,
        }),
      ]),
    );
    expect(report.detailAbsentEventCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldNumber: 15,
          candidateEmployees: 2,
          pendingEmployees: 0,
        }),
        expect.objectContaining({
          fieldNumber: 30,
          candidateEmployees: 2,
          pendingEmployees: 0,
        }),
        expect.objectContaining({
          fieldNumber: 80,
          candidateEmployees: 2,
          pendingEmployees: 0,
        }),
        expect.objectContaining({
          fieldNumber: 94,
          candidateEmployees: 2,
          pendingEmployees: 0,
        }),
        expect.objectContaining({
          fieldNumber: 22,
          candidateEmployees: 0,
          pendingEmployees: 2,
        }),
        expect.objectContaining({
          fieldNumber: 28,
          candidateEmployees: 0,
          pendingEmployees: 2,
        }),
      ]),
    );
    expect(report.detailStandardDependentEmptyCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldNumber: 32,
          candidateEmployees: 2,
          pendingEmployees: 0,
        }),
        expect.objectContaining({
          fieldNumber: 34,
          candidateEmployees: 2,
          pendingEmployees: 0,
        }),
        expect.objectContaining({
          fieldNumber: 74,
          candidateEmployees: 2,
          pendingEmployees: 0,
        }),
        expect.objectContaining({
          fieldNumber: 75,
          candidateEmployees: 2,
          pendingEmployees: 0,
        }),
      ]),
    );
    expect(report.detailNonExemptCotizanteCandidates).toEqual([
      expect.objectContaining({
        fieldNumber: 76,
        candidateEmployees: 2,
        pendingEmployees: 0,
      }),
    ]);
    expect(report.archivoGenerable).toBe(false);
  });

  it('reports IGE/LMA fields as pending when the approved snapshot has an event', () => {
    const snapshotWithEvent = detailCandidateSnapshot('employee-1', 'Ana');
    const payload = snapshotWithEvent.payload as {
      pilaEvents: unknown[];
      payroll: { pilaEvents: unknown[] };
    };
    const event = { codigo: 'IGE', fechaInicio: '2026-10-12' };
    payload.pilaEvents.push(event);
    payload.payroll.pilaEvents.push(event);

    const report = buildPilaPreparationReport({
      period: {
        id: 'period-1',
        fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
        fechaFin: new Date('2026-10-31T00:00:00.000Z'),
      },
      snapshots: [snapshotWithEvent],
    });
    const status = report.detailNoEventFieldCandidates.find(
      ({ fieldNumber }) => fieldNumber === 57,
    );

    expect(status).toMatchObject({
      candidateEmployees: 0,
      pendingEmployees: 1,
    });
    expect(status?.pendingReasons[0]?.reason).toContain(
      'sin novedades ni eventos PILA',
    );
    expect(status?.pendingReasons[0]?.affectedEmployees).toEqual(['Ana Demo']);
    for (const fieldNumber of [15, 30, 80, 94]) {
      expect(
        report.detailAbsentEventCandidates.find(
          (candidate) => candidate.fieldNumber === fieldNumber,
        ),
      ).toMatchObject({
        candidateEmployees: 0,
        pendingEmployees: 1,
      });
    }
  });

  it('does not choose a detail candidate when an employee has duplicate snapshots', () => {
    const duplicate = detailCandidateSnapshot('employee-1', 'Ana');
    const report = buildPilaPreparationReport({
      period: {
        id: 'period-1',
        fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
        fechaFin: new Date('2026-10-31T00:00:00.000Z'),
      },
      snapshots: [duplicate, duplicate],
    });

    const field61 = report.detailContributionCandidates.find(
      (status) => status.fieldNumber === 61,
    )!;
    expect(field61).toMatchObject({
      fieldNumber: 61,
      candidateEmployees: 0,
      pendingEmployees: 1,
    });
    expect(field61.pendingReasons[0]?.reason).toContain('más de un snapshot');
    expect(field61.pendingReasons[0]?.affectedEmployees).toEqual(['Ana Demo']);
  });

  it('explica que no hay snapshots cuando el período aprobado no los conserva', () => {
    const report = buildPilaPreparationReport({
      period: {
        id: 'period-1',
        fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
        fechaFin: new Date('2026-10-31T00:00:00.000Z'),
      },
      snapshots: [],
    });

    expect(report.issues).toEqual([
      expect.objectContaining({ code: 'SNAPSHOTS_APROBADOS_NO_DISPONIBLES' }),
    ]);
    expect(report.exportReadiness.blockers).not.toContainEqual(
      expect.objectContaining({ code: 'PILA_PAYMENT_DATE_REQUIRED' }),
    );
  });

  it('bloquea el total CCF de campo 20 si excede N12 sin truncar', () => {
    const snapshots = Array.from({ length: 1001 }, (_, index) =>
      snapshot(`employee-${index}`, 'Empleado'),
    );
    snapshots.forEach((item, index) => {
      const source = item.payload as ReturnType<typeof payload>;
      source.employer.pila.claseAportante = 'A';
      source.payroll.ibcPorSubsistema.cajaCompensacion.valor =
        index === snapshots.length - 1 ? 999 : 999_999_999;
    });
    const period = {
      id: 'period-1',
      fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
      fechaFin: new Date('2026-10-31T00:00:00.000Z'),
    };

    const atMaximum = buildPilaPreparationReport({ period, snapshots });
    expect(atMaximum.exportReadiness.blockers).not.toContainEqual(
      expect.objectContaining({
        code: 'AT2_HEADER_CCF_IBC_TOTAL_SUPERA_LONGITUD',
      }),
    );

    const lastSource = snapshots.at(-1)!.payload as ReturnType<typeof payload>;
    lastSource.payroll.ibcPorSubsistema.cajaCompensacion.valor = 1000;
    const overMaximum = buildPilaPreparationReport({ period, snapshots });

    expect(overMaximum.exportReadiness.blockers).toContainEqual(
      expect.objectContaining({
        code: 'AT2_HEADER_CCF_IBC_TOTAL_SUPERA_LONGITUD',
        scope: 'FILE_GENERATION',
        fields: [{ record: 'CABECERA_TIPO_2', fieldNumbers: [20] }],
      }),
    );
  });

  it.each([
    ['marzo pagado en marzo', '2027-03-01', '2027-03-31', '2027-03-06', false],
    ['abril pagado en mayo', '2027-04-01', '2027-04-30', '2027-05-06', true],
    ['marzo pagado en abril', '2027-03-01', '2027-03-31', '2027-04-06', true],
    [
      'período que cruza abril aunque comience y se pague antes',
      '2027-03-15',
      '2027-04-15',
      '2027-03-31',
      true,
    ],
  ])(
    'aplica el bloqueo de reglas pensionales según el período y pago (%s)',
    (_, fechaInicio, fechaFin, fechaPrevistaPagoPila, shouldBlock) => {
      const payrollSnapshot = snapshot('employee-1', 'Ana');
      const source = payrollSnapshot.payload as ReturnType<typeof payload>;
      source.period.fechaInicio = fechaInicio;
      source.period.fechaFin = fechaFin;
      source.payroll.fechaPrevistaPagoPila = fechaPrevistaPagoPila;

      const report = buildPilaPreparationReport({
        period: {
          id: 'period-1',
          fechaInicio: new Date(`${fechaInicio}T00:00:00.000Z`),
          fechaFin: new Date(`${fechaFin}T00:00:00.000Z`),
        },
        snapshots: [payrollSnapshot],
      });

      const matchingBlockers = report.exportReadiness.blockers.filter(
        ({ code }) => code === 'PILA_PENSION_RULESET_AFTER_2027_NOT_RECONCILED',
      );
      expect(matchingBlockers).toHaveLength(shouldBlock ? 1 : 0);
    },
  );

  it('exige fecha prevista válida en cada snapshot aprobado', () => {
    const missingDate = snapshot('employee-1', 'Ana');
    const source = missingDate.payload as ReturnType<typeof payload>;
    source.payroll.fechaPrevistaPagoPila = null;

    const report = buildPilaPreparationReport({
      period: {
        id: 'period-1',
        fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
        fechaFin: new Date('2026-10-31T00:00:00.000Z'),
      },
      snapshots: [missingDate],
    });

    expect(report.period.fechaPrevistaPagoPila).toBeNull();
    expect(report.exportReadiness.blockers).toContainEqual(
      expect.objectContaining({
        code: 'PILA_PAYMENT_DATE_REQUIRED',
        scope: 'FILE_GENERATION',
      }),
    );
  });

  it('rechaza fechas previstas imposibles en snapshots aprobados', () => {
    const malformedDate = snapshot('employee-1', 'Ana');
    const source = malformedDate.payload as ReturnType<typeof payload>;
    source.payroll.fechaPrevistaPagoPila = '2026-02-30';

    const report = buildPilaPreparationReport({
      period: {
        id: 'period-1',
        fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
        fechaFin: new Date('2026-10-31T00:00:00.000Z'),
      },
      snapshots: [malformedDate],
    });

    expect(report.period.fechaPrevistaPagoPila).toBeNull();
    expect(report.exportReadiness.blockers).toContainEqual(
      expect.objectContaining({ code: 'PILA_PAYMENT_DATE_REQUIRED' }),
    );
  });

  it('bloquea si los snapshots aprobados tienen fechas previstas diferentes', () => {
    const secondSnapshot = snapshot('employee-2', 'Luis');
    const source = secondSnapshot.payload as ReturnType<typeof payload>;
    source.payroll.fechaPrevistaPagoPila = '2026-11-07';

    const report = buildPilaPreparationReport({
      period: {
        id: 'period-1',
        fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
        fechaFin: new Date('2026-10-31T00:00:00.000Z'),
      },
      snapshots: [snapshot('employee-1', 'Ana'), secondSnapshot],
    });

    expect(report.period.fechaPrevistaPagoPila).toBeNull();
    expect(report.exportReadiness.blockers).toContainEqual(
      expect.objectContaining({
        code: 'PILA_PAYMENT_DATE_SNAPSHOT_INCONSISTENT',
        scope: 'FILE_GENERATION',
      }),
    );
  });
});
