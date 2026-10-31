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
      razonSocial: 'Empresa Demo SAS',
      nit: '900123456',
      digitoVerif: '7',
      direccion: 'Calle Demo 10',
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
        aportesExoneradosConfirmado: false,
        beneficioCcfLey1429: false,
        beneficioLey1429: false,
        sinAccionEspecial: true,
        representanteNumeroDocumento: '900123456',
        representanteTipoDocumento: 'CC',
        representantePrimerApellido: 'Demo',
        representantePrimerNombre: 'Ana',
      },
    },
    employee: {
      tipoDocumento: 'CC',
      cedula: '1234567890',
      primerNombre: 'Ana',
      segundoNombre: null,
      primerApellido: 'Demo',
      segundoApellido: null,
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
      fechaPrevistaPagoPila: '2026-11-06',
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

  it('detecta como pendientes el centro de trabajo PILA y la actividad ARL vigentes', () => {
    const result = inspectPilaSnapshotPreparation(
      snapshot('employee-1', 'Ana'),
    );

    expect(result.employeeName).toBe('Ana Demo');
    expect(
      result.issues.map(({ fieldNumber, code }) => ({ fieldNumber, code })),
    ).toEqual([
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

  it('agrupa faltantes por campo y declara expresamente que el archivo aún no se genera', () => {
    const report = buildPilaPreparationReport({
      period: {
        id: 'period-1',
        fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
        fechaFin: new Date('2026-10-31T00:00:00.000Z'),
        fechaPrevistaPagoPila: new Date('2026-11-06T00:00:00.000Z'),
      },
      snapshots: [
        snapshot('employee-1', 'Ana'),
        snapshot('employee-2', 'Luis'),
      ],
    });

    expect(report).toMatchObject({
      formatVersion: 'AT2_V30',
      snapshotsRevisados: 2,
      empleadosConDatosPendientes: 2,
      empleadosSinBrechasDetectadas: 0,
      archivoGenerable: false,
      estadoArchivo: 'NO_IMPLEMENTADO',
    });
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

  it('explica que no hay snapshots cuando el período aprobado no los conserva', () => {
    const report = buildPilaPreparationReport({
      period: {
        id: 'period-1',
        fechaInicio: new Date('2026-10-01T00:00:00.000Z'),
        fechaFin: new Date('2026-10-31T00:00:00.000Z'),
        fechaPrevistaPagoPila: null,
      },
      snapshots: [],
    });

    expect(report.issues).toEqual([
      expect.objectContaining({ code: 'SNAPSHOTS_APROBADOS_NO_DISPONIBLES' }),
    ]);
  });
});
