type JsonRecord = Record<string, unknown>;

export type PilaPreparationRecord =
  | 'APORTANTE_TIPO_1'
  | 'CABECERA_TIPO_2'
  | 'DETALLE_TIPO_2'
  | 'SNAPSHOT';

export interface PilaPreparationIssue {
  record: PilaPreparationRecord;
  fieldNumber: number | null;
  code: string;
  message: string;
}

export interface PilaSnapshotPreparationInput {
  employeeId: string;
  payloadVersion: number | null;
  payload: unknown;
}

export interface PilaSnapshotPreparation {
  employeeId: string;
  employeeName: string;
  issues: PilaPreparationIssue[];
}

const supportedDocumentTypes = new Set(['CC', 'CE', 'TI', 'PA']);
const supportedEmployerDocumentTypes = new Set([
  'NI',
  'CC',
  'CE',
  'TI',
  'PA',
  'CD',
  'SC',
  'PE',
  'PT',
  'PC',
]);
const representativeDocumentTypes = new Set(['CC', 'CE', 'PA', 'CD']);

function object(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function nested(value: JsonRecord | null, key: string): JsonRecord | null {
  return object(value?.[key]);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function safeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function date(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function isFullCalendarMonth(start: string, end: string): boolean {
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  return (
    startDate.getUTCDate() === 1 &&
    startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
    startDate.getUTCMonth() === endDate.getUTCMonth() &&
    endDate.getUTCDate() ===
      new Date(
        Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0),
      ).getUTCDate()
  );
}

function fullName(employee: JsonRecord | null, fallbackId: string): string {
  if (!employee) return `Empleado ${fallbackId.slice(-8)}`;
  const parts = [
    text(employee.primerNombre),
    text(employee.segundoNombre),
    text(employee.primerApellido),
    text(employee.segundoApellido),
  ].filter((part): part is string => part !== null);
  return parts.length > 0
    ? parts.join(' ')
    : `Empleado ${fallbackId.slice(-8)}`;
}

export function inspectPilaSnapshotPreparation(
  input: PilaSnapshotPreparationInput,
): PilaSnapshotPreparation {
  const issues: PilaPreparationIssue[] = [];
  const add = (
    record: PilaPreparationRecord,
    fieldNumber: number | null,
    code: string,
    message: string,
  ) => issues.push({ record, fieldNumber, code, message });

  const root = object(input.payload);
  const employee = nested(root, 'employee');
  const employeeName = fullName(employee, input.employeeId);

  if (input.payloadVersion !== 1 || root?.schemaVersion !== 1) {
    add(
      'SNAPSHOT',
      null,
      'PILA_SNAPSHOT_VERSION_NO_SOPORTADA',
      'No existe un snapshot PILA aprobado con una versión compatible. No se completan datos desde registros actuales.',
    );
    return { employeeId: input.employeeId, employeeName, issues };
  }

  const employer = nested(root, 'employer');
  const employerPila = nested(employer, 'pila');
  const period = nested(root, 'period');
  const worksite = nested(root, 'worksite');
  const worksiteMunicipality = nested(worksite, 'municipio');
  const contract = nested(root, 'contract');
  const payroll = nested(root, 'payroll');
  const periodStart = date(period?.fechaInicio);
  const periodEnd = date(period?.fechaFin);

  const requireText = (
    record: PilaPreparationRecord,
    fieldNumber: number,
    value: unknown,
    message: string,
  ) => {
    if (text(value) === null) {
      add(record, fieldNumber, `CAMPO_${fieldNumber}_SIN_DATO`, message);
    }
  };
  const requireChoice = (
    record: PilaPreparationRecord,
    fieldNumber: number,
    value: unknown,
    choices: Set<string>,
    message: string,
  ) => {
    const normalized = text(value);
    if (normalized === null || !choices.has(normalized)) {
      add(
        record,
        fieldNumber,
        `CAMPO_${fieldNumber}_SIN_VALOR_VALIDO`,
        message,
      );
    }
  };

  // AT2 v30, archivo tipo 1: los valores del aportante se exigen desde los
  // datos declarados y congelados en el snapshot, no desde el maestro actual.
  const employerRecord: PilaPreparationRecord = 'APORTANTE_TIPO_1';
  requireText(
    employerRecord,
    1,
    employer?.razonSocial,
    'Falta la razón social del aportante.',
  );
  requireChoice(
    employerRecord,
    2,
    employerPila?.tipoDocumentoAportante,
    supportedEmployerDocumentTypes,
    'Falta confirmar el tipo de documento del aportante.',
  );
  const employerDocumentType = text(employerPila?.tipoDocumentoAportante);
  const employerId = text(employer?.nit);
  if (
    !employerId ||
    !/^[A-Z0-9]+$/.test(employerId) ||
    employerId.length > 16 ||
    (employerDocumentType === 'NI' && !/^\d{1,11}$/.test(employerId))
  ) {
    add(
      employerRecord,
      3,
      'CAMPO_3_IDENTIFICACION_APORTANTE_NO_VALIDA',
      'Falta una identificación del aportante válida para el tipo de documento declarado.',
    );
  }
  requireChoice(
    employerRecord,
    7,
    employerPila?.claseAportante,
    new Set(['A', 'B', 'C', 'D']),
    'Falta confirmar la clase de aportante para el período.',
  );
  requireChoice(
    employerRecord,
    8,
    employerPila?.naturalezaJuridica,
    new Set(['1', '2', '3', '4', '5']),
    'Falta la naturaleza jurídica declarada por el aportante.',
  );
  const personType = text(employerPila?.tipoPersona);
  requireChoice(
    employerRecord,
    9,
    personType,
    new Set(['N', 'J']),
    'Falta declarar si el aportante es persona natural o jurídica.',
  );
  const presentation = text(employerPila?.formaPresentacion);
  requireChoice(
    employerRecord,
    10,
    presentation,
    new Set(['U', 'S']),
    'Falta confirmar la forma de presentación PILA.',
  );
  if (personType === 'J') {
    const verificationDigit = text(employer?.digitoVerif);
    if (!verificationDigit || !/^\d$/.test(verificationDigit)) {
      add(
        employerRecord,
        4,
        'CAMPO_4_DV_APORTANTE_NO_VALIDO',
        'La persona jurídica requiere el dígito de verificación del aportante.',
      );
    }
  }
  if (personType === 'N' && employerDocumentType === 'NI') {
    add(
      employerRecord,
      2,
      'TIPO_DOCUMENTO_APORTANTE_INCOMPATIBLE_PERSONA_NATURAL',
      'El tipo de documento NIT no corresponde al tipo de persona natural declarado.',
    );
  }
  if (presentation === 'S') {
    requireText(
      employerRecord,
      5,
      employerPila?.codigoSucursal,
      'La presentación por sucursal requiere el código PILA de la sucursal.',
    );
    requireText(
      employerRecord,
      6,
      employerPila?.nombreSucursal,
      'La presentación por sucursal requiere el nombre PILA de la sucursal.',
    );
  }
  requireText(
    employerRecord,
    11,
    employer?.direccion,
    'Falta la dirección de correspondencia del aportante.',
  );
  const employerMunicipality = nested(employer, 'municipio');
  const employerMunicipalityCode = text(employerMunicipality?.codigo);
  if (!employerMunicipalityCode || !/^\d{5}$/.test(employerMunicipalityCode)) {
    add(
      employerRecord,
      12,
      'CAMPO_12_CODIGO_MUNICIPIO_NO_VALIDO',
      'Falta un código DIVIPOLA válido para el municipio del aportante.',
    );
    add(
      employerRecord,
      13,
      'CAMPO_13_CODIGO_DEPARTAMENTO_NO_VALIDO',
      'Falta el código de departamento DIVIPOLA del aportante.',
    );
  }
  const activityCode = text(employerPila?.codigoActividadEconomica);
  if (!activityCode || !/^\d{4}$/.test(activityCode)) {
    add(
      employerRecord,
      14,
      'CAMPO_14_ACTIVIDAD_ECONOMICA_NO_VALIDADA',
      'Falta el código CIIU de cuatro dígitos confirmado por el aportante.',
    );
  }
  const phone = text(employer?.telefono);
  if (!phone || !/^\d{1,10}$/.test(phone)) {
    add(
      employerRecord,
      15,
      'CAMPO_15_TELEFONO_NO_VALIDO',
      'Falta un teléfono del aportante que cumpla el formato numérico AT2.',
    );
  }
  requireChoice(
    employerRecord,
    30,
    employerPila?.tipoAportante,
    new Set(['1']),
    'El MVP requiere declarar al aportante como empleador (tipo 1).',
  );
  if (
    typeof employerPila?.aportesExoneradosConfirmado !== 'boolean' ||
    employerPila.aportesExoneradosConfirmado !== employer?.aportesExonerados
  ) {
    add(
      employerRecord,
      33,
      'CAMPO_33_EXONERACION_SIN_CONFIRMAR',
      'Falta confirmar si aplica la exoneración de salud, SENA e ICBF.',
    );
  }
  if (typeof employerPila?.beneficioCcfLey1429 !== 'boolean') {
    add(
      employerRecord,
      34,
      'CAMPO_34_BENEFICIO_CCF_SIN_CONFIRMAR',
      'Falta confirmar si aplica el beneficio de la Ley 1429 para CCF.',
    );
  }
  if (typeof employerPila?.beneficioLey1429 !== 'boolean') {
    add(
      employerRecord,
      7,
      'CAMPO_7_BENEFICIO_LEY1429_SIN_CONFIRMAR',
      'Falta confirmar si aplica la categoría de aportante beneficiario de Ley 1429.',
    );
  }
  if (personType === 'J') {
    requireText(
      employerRecord,
      18,
      employerPila?.representanteNumeroDocumento,
      'La persona jurídica requiere la identificación del representante legal.',
    );
    const representativeDocumentType = text(
      employerPila?.representanteTipoDocumento,
    );
    if (
      representativeDocumentType === null ||
      !representativeDocumentTypes.has(representativeDocumentType)
    ) {
      add(
        employerRecord,
        20,
        'CAMPO_20_DOCUMENTO_REPRESENTANTE_NO_VALIDO',
        'La persona jurídica requiere un tipo de documento válido para su representante legal.',
      );
    }
    requireText(
      employerRecord,
      21,
      employerPila?.representantePrimerApellido,
      'La persona jurídica requiere el primer apellido del representante legal.',
    );
    requireText(
      employerRecord,
      23,
      employerPila?.representantePrimerNombre,
      'La persona jurídica requiere el primer nombre del representante legal.',
    );
  }
  if (employerPila?.beneficioLey1429 === true) {
    if (!date(employerPila.fechaMatriculaMercantil)) {
      add(
        employerRecord,
        31,
        'CAMPO_31_MATRICULA_MERCANTIL_FALTANTE',
        'El beneficio de Ley 1429 requiere una fecha de matrícula mercantil válida.',
      );
    }
    requireText(
      employerRecord,
      32,
      employerPila.codigoDepartamentoLey1429,
      'El beneficio de Ley 1429 requiere el departamento DIVIPOLA del domicilio principal.',
    );
  }

  // La fecha de pago identifica la regla normativa aplicable; no equivale a
  // pago realizado ni a fecha de pago de nómina.
  if (!date(payroll?.fechaPrevistaPagoPila)) {
    add(
      'CABECERA_TIPO_2',
      null,
      'FECHA_PREVISTA_PILA_FALTANTE',
      'Falta la fecha prevista de pago de aportes para determinar la vigencia aplicable.',
    );
  }
  if (
    !periodStart ||
    !periodEnd ||
    !isFullCalendarMonth(periodStart, periodEnd)
  ) {
    add(
      'CABECERA_TIPO_2',
      null,
      'PERIODO_PILA_MES_CALENDARIO_NO_COMPLETO',
      'La preparación vigente solo soporta períodos que cubren un mes calendario completo.',
    );
  }
  requireText(
    'CABECERA_TIPO_2',
    14,
    employerPila?.codigoArlAportante,
    'Falta el código ARL declarado para el aportante.',
  );

  // Registro tipo 2 por cotizante. Este reporte revisa insumos capturados,
  // no inventa códigos ni completa datos consultando Empleado/Sede actuales.
  const detailRecord: PilaPreparationRecord = 'DETALLE_TIPO_2';
  const documentType = text(employee?.tipoDocumento);
  if (!documentType || !supportedDocumentTypes.has(documentType)) {
    add(
      detailRecord,
      3,
      'CAMPO_3_DOCUMENTO_SIN_MAPEO_AT2',
      'El tipo de documento del cotizante falta o aún no tiene mapeo AT2 aprobado.',
    );
  }
  requireText(
    detailRecord,
    4,
    employee?.cedula,
    'Falta el número de documento del cotizante.',
  );
  const affiliations = Array.isArray(root?.affiliations)
    ? root.affiliations
        .map(object)
        .filter((value): value is JsonRecord => value !== null)
    : [];
  if (affiliations.length !== 1) {
    add(
      detailRecord,
      5,
      'AFILIACION_EFECTIVA_NO_UNICA',
      'Debe existir una sola afiliación confirmada que cubra el período del cotizante.',
    );
  }
  const affiliation = affiliations[0] ?? null;
  if (affiliation) {
    if (text(affiliation.tipoCotizanteCodigo) !== '01') {
      add(
        detailRecord,
        5,
        'TIPO_COTIZANTE_FUERA_DEL_MVP',
        'El MVP de PILA solo contempla trabajadores dependientes estándar (tipo 01).',
      );
    }
    requireText(
      detailRecord,
      6,
      affiliation.subtipoCotizanteCodigo,
      'Falta confirmar explícitamente el subtipo de cotizante.',
    );
    for (const [field, key, label] of [
      [31, 'fondoPensionCodigo', 'fondo de pensiones'],
      [33, 'epsCodigo', 'EPS'],
      [35, 'cajaCompensacionCodigo', 'caja de compensación'],
    ] as const) {
      requireText(
        detailRecord,
        field,
        affiliation[key],
        `Falta el código confirmado de la ${label}.`,
      );
    }
    requireText(
      detailRecord,
      78,
      affiliation.arlClaseRiesgo,
      'Falta la clase de riesgo ARL confirmada para el período.',
    );
    const affiliationStart = date(affiliation.vigenteDesde);
    const affiliationEndValue = affiliation.vigenteHasta;
    const affiliationEnd =
      affiliationEndValue === null ? null : date(affiliationEndValue);
    if (
      !periodStart ||
      !periodEnd ||
      !affiliationStart ||
      affiliationStart > periodStart ||
      (affiliationEndValue !== null &&
        (affiliationEnd === null || affiliationEnd < periodEnd))
    ) {
      add(
        detailRecord,
        5,
        'AFILIACION_NO_CUBRE_PERIODO',
        'La afiliación congelada no demuestra cobertura durante todo el período.',
      );
    }
  }
  requireText(
    detailRecord,
    11,
    employee?.primerApellido,
    'Falta el primer apellido del cotizante.',
  );
  requireText(
    detailRecord,
    13,
    employee?.primerNombre,
    'Falta el primer nombre del cotizante.',
  );
  const worksiteCode = text(worksiteMunicipality?.codigo);
  if (!worksite || !worksiteCode || !/^\d{5}$/.test(worksiteCode)) {
    add(
      detailRecord,
      9,
      'UBICACION_LABORAL_NO_CONGELADA',
      'Falta el municipio DIVIPOLA del lugar de trabajo congelado en el snapshot.',
    );
    add(
      detailRecord,
      10,
      'UBICACION_LABORAL_NO_CONGELADA',
      'Falta el código DIVIPOLA municipal del lugar de trabajo congelado.',
    );
  }
  add(
    detailRecord,
    62,
    'CENTRO_TRABAJO_SIN_CODIGO_PILA',
    contract
      ? 'El contrato y la sede están congelados, pero aún falta el código PILA del centro de trabajo.'
      : 'Falta el contrato que permite identificar el código PILA del centro de trabajo.',
  );
  add(
    detailRecord,
    98,
    'ACTIVIDAD_ARL_SIN_VIGENCIA_PILA',
    'Falta el código de actividad económica ARL vigente para el cotizante y su lugar de trabajo.',
  );

  const days = nested(payroll, 'diasCotizadosPorSubsistema');
  for (const [field, key, label] of [
    [36, 'pension', 'pensión'],
    [37, 'salud', 'salud'],
    [38, 'riesgos', 'riesgos laborales'],
    [39, 'cajaCompensacion', 'caja de compensación'],
  ] as const) {
    const value = nested(days, key)?.valor;
    if (
      !Number.isInteger(value) ||
      typeof value !== 'number' ||
      value < 0 ||
      value > 30
    ) {
      add(
        detailRecord,
        field,
        `CAMPO_${field}_DIAS_SIN_APROBAR`,
        `Faltan días cotizados a ${label} aprobados por Payroll.`,
      );
    } else if (value !== 30) {
      add(
        detailRecord,
        field,
        `CAMPO_${field}_REQUIERE_SEGMENTACION`,
        `Los días cotizados a ${label} requieren una novedad y segmentación PILA aprobadas.`,
      );
    }
  }
  const basicSalary = nested(payroll, 'salarioBasicoCampo40')?.valor;
  if (!safeInteger(basicSalary)) {
    add(
      detailRecord,
      40,
      'CAMPO_40_SALARIO_BASICO_NO_VALIDO',
      'El salario básico del campo 40 debe ser un entero no negativo aprobado.',
    );
  }
  const salaryType = payroll?.tipoSalario;
  if (salaryType !== 'X' && salaryType !== 'F' && salaryType !== 'V') {
    add(
      detailRecord,
      41,
      'CAMPO_41_TIPO_SALARIO_SIN_CONFIRMAR',
      'Falta un tipo de salario declarado y compatible con el cálculo de nómina.',
    );
  }
  const subsystemBases = nested(payroll, 'ibcPorSubsistema');
  for (const [field, key, label] of [
    [42, 'pension', 'pensión'],
    [43, 'salud', 'salud'],
    [44, 'riesgos', 'riesgos laborales'],
    [45, 'cajaCompensacion', 'caja de compensación'],
    [95, 'otrosParafiscales', 'otros parafiscales'],
  ] as const) {
    const source = nested(subsystemBases, key);
    if (!safeInteger(source?.valor)) {
      add(
        detailRecord,
        field,
        `CAMPO_${field}_IBC_NO_APROBADO`,
        `Falta un IBC entero, no negativo y con fuente inequívoca para ${label}.`,
      );
    }
    if (
      field === 95 &&
      Array.isArray(source?.bloqueos) &&
      source.bloqueos.length > 0
    ) {
      add(
        detailRecord,
        field,
        'CAMPO_95_REGLA_CANDIDATA_BLOQUEADA',
        'La base parafiscal tiene bloqueos de origen y requiere revisión laboral antes de usarla.',
      );
    }
    if (field === 95 && source?.reglaVersion !== 'CO_PARAFISCAL_BASE_V1') {
      add(
        detailRecord,
        field,
        'CAMPO_95_REGLA_SIN_VERSION',
        'La base parafiscal no conserva la versión explícita de su regla candidata.',
      );
    }
  }
  const employerPilaExemption = employerPila?.aportesExoneradosConfirmado;
  if (typeof employerPilaExemption !== 'boolean') {
    add(
      detailRecord,
      76,
      'CAMPO_76_EXONERACION_NO_CONFIRMADA',
      'La exoneración requiere confirmación expresa del aportante.',
    );
  }

  return {
    employeeId: input.employeeId,
    employeeName,
    issues: deduplicateIssues(issues),
  };
}

function deduplicateIssues(
  issues: PilaPreparationIssue[],
): PilaPreparationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.record}:${issue.fieldNumber}:${issue.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildPilaPreparationReport(input: {
  period: {
    id: string;
    fechaInicio: Date;
    fechaFin: Date;
    fechaPrevistaPagoPila: Date | null;
  };
  snapshots: PilaSnapshotPreparationInput[];
}) {
  const assessments = input.snapshots.map(inspectPilaSnapshotPreparation);
  const grouped = new Map<
    string,
    PilaPreparationIssue & {
      affectedEmployees: string[];
      affectedIds: Set<string>;
    }
  >();

  for (const assessment of assessments) {
    for (const issue of assessment.issues) {
      const key = `${issue.record}:${issue.fieldNumber}:${issue.code}`;
      const current = grouped.get(key);
      if (current) {
        if (!current.affectedIds.has(assessment.employeeId)) {
          current.affectedIds.add(assessment.employeeId);
          current.affectedEmployees.push(assessment.employeeName);
        }
      } else {
        grouped.set(key, {
          ...issue,
          affectedEmployees: [assessment.employeeName],
          affectedIds: new Set([assessment.employeeId]),
        });
      }
    }
  }

  if (assessments.length === 0) {
    grouped.set('SNAPSHOT:null:SNAPSHOTS_APROBADOS_NO_DISPONIBLES', {
      record: 'SNAPSHOT',
      fieldNumber: null,
      code: 'SNAPSHOTS_APROBADOS_NO_DISPONIBLES',
      message: 'No hay snapshots aprobados de este período para revisar.',
      affectedEmployees: [],
      affectedIds: new Set(),
    });
  }

  const issues = Array.from(grouped.values()).map((issue) => ({
    record: issue.record,
    fieldNumber: issue.fieldNumber,
    code: issue.code,
    message: issue.message,
    affectedEmployees: issue.affectedEmployees,
    affectedCount: issue.affectedEmployees.length,
  }));
  const employeesWithIssues = assessments.filter(
    (assessment) => assessment.issues.length > 0,
  ).length;

  return {
    formatVersion: 'AT2_V30' as const,
    period: {
      id: input.period.id,
      fechaInicio: input.period.fechaInicio.toISOString().slice(0, 10),
      fechaFin: input.period.fechaFin.toISOString().slice(0, 10),
      fechaPrevistaPagoPila:
        input.period.fechaPrevistaPagoPila?.toISOString().slice(0, 10) ?? null,
    },
    snapshotsRevisados: assessments.length,
    empleadosConDatosPendientes: employeesWithIssues,
    empleadosSinBrechasDetectadas: assessments.length - employeesWithIssues,
    issues,
    archivoGenerable: false as const,
    estadoArchivo: 'NO_IMPLEMENTADO' as const,
    mensaje:
      'Este informe revisa insumos conocidos de snapshots aprobados. No genera archivos ni confirma aceptación de un operador.',
  };
}
