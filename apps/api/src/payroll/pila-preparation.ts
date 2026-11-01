import {
  PILA_RISK_ACTIVITY_CATALOG_VERSION,
  PILA_RISK_ACTIVITY_CODES,
} from './pila-risk-activity-catalog';

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
  totalCotizantes?: number;
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
const pilaEventFieldNumbers = new Map<string, number>([
  ['ING', 15],
  ['RET', 16],
  ['VSP', 21],
  ['VST', 23],
  ['SLN', 24],
  ['IGE', 25],
  ['LMA', 26],
  ['VAC_LR', 27],
  ['VCT', 29],
  ['IRL', 30],
]);

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

function fitsNumericField(value: unknown, length: number): value is number {
  return safeInteger(value) && String(value).length <= length;
}

function validPilaIdentification(type: string, value: string): boolean {
  const numericMaxLength: Record<string, number> = {
    CC: 10,
    CE: 7,
    TI: 11,
    NI: 11,
    SC: 8,
    PE: 15,
    PT: 8,
    PC: 8,
  };
  const maxLength = numericMaxLength[type];
  if (maxLength !== undefined) {
    return /^\d+$/.test(value) && value.length <= maxLength;
  }
  const alphanumericMaxLength: Record<string, number> = { PA: 16, CD: 11 };
  const alphanumericLength = alphanumericMaxLength[type];
  return (
    alphanumericLength !== undefined &&
    /^[A-Z0-9]+$/.test(value) &&
    value.length <= alphanumericLength
  );
}

function validEmployerIdentification(type: string, value: string): boolean {
  if (type === 'PE') return /^\d{15}$/.test(value);
  const numericMaxLength: Record<string, number> = {
    CC: 10,
    CE: 7,
    TI: 11,
    NI: 11,
    SC: 8,
    PT: 8,
    PC: 8,
  };
  const numericLimit = numericMaxLength[type];
  if (numericLimit !== undefined) {
    return new RegExp(`^\\d{1,${numericLimit}}$`).test(value);
  }
  const alphanumericMaxLength: Record<string, number> = { PA: 16, CD: 11 };
  const alphanumericLimit = alphanumericMaxLength[type];
  return (
    alphanumericLimit !== undefined &&
    new RegExp(`^[A-Z0-9]{1,${alphanumericLimit}}$`).test(value)
  );
}

function validRepresentativeIdentification(
  type: string,
  value: string,
): boolean {
  const numericMaxLength: Record<string, number> = { CC: 10, CE: 7 };
  const numericLimit = numericMaxLength[type];
  if (numericLimit !== undefined) {
    return new RegExp(`^\\d{1,${numericLimit}}$`).test(value);
  }
  const alphanumericMaxLength: Record<string, number> = { PA: 16, CD: 11 };
  const alphanumericLimit = alphanumericMaxLength[type];
  return (
    alphanumericLimit !== undefined &&
    new RegExp(`^[A-Z0-9]{1,${alphanumericLimit}}$`).test(value)
  );
}

function validPilaEmail(value: string): boolean {
  const separator = value.indexOf('@');
  if (separator <= 0 || separator !== value.lastIndexOf('@')) return false;
  const username = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  return (
    /^[a-z0-9._'-]+$/.test(username) &&
    /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(domain)
  );
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

  const supportedPayloadVersion =
    (input.payloadVersion === 1 && root?.schemaVersion === 1) ||
    (input.payloadVersion === 2 && root?.schemaVersion === 2);
  if (!supportedPayloadVersion) {
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
  const payrollPilaEvents = payroll?.pilaEvents;
  const contextPilaEvents = root?.pilaEvents;
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
  const validateFieldLength = (
    record: PilaPreparationRecord,
    fieldNumber: number,
    value: unknown,
    maxLength: number,
    label: string,
  ) => {
    const normalized = text(value);
    if (normalized && Array.from(normalized).length > maxLength) {
      add(
        record,
        fieldNumber,
        `CAMPO_${fieldNumber}_LONGITUD_SUPERADA`,
        `El campo ${label} supera las ${maxLength} posiciones permitidas por AT2 v30.`,
      );
    }
  };

  // Matriz PILA preliminar, archivo tipo 1: los valores del aportante se
  // exigen desde los datos declarados y congelados en el snapshot, no desde
  // el maestro actual. No representa una validación normativa completa.
  const employerRecord: PilaPreparationRecord = 'APORTANTE_TIPO_1';
  requireText(
    employerRecord,
    1,
    employer?.razonSocial,
    'Falta la razón social del aportante.',
  );
  validateFieldLength(
    employerRecord,
    1,
    employer?.razonSocial,
    200,
    'razón social del aportante',
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
    !employerDocumentType ||
    !validEmployerIdentification(employerDocumentType, employerId)
  ) {
    add(
      employerRecord,
      3,
      'CAMPO_3_IDENTIFICACION_APORTANTE_NO_VALIDA',
      'Falta una identificación del aportante válida para el tipo de documento declarado.',
    );
  }
  const employerClass = text(employerPila?.claseAportante);
  requireChoice(
    employerRecord,
    7,
    employerClass,
    new Set(['A', 'B', 'C', 'D']),
    'Falta confirmar la clase de aportante para el período.',
  );
  if (employerClass === 'A' || employerClass === 'B') {
    if (
      !Number.isSafeInteger(input.totalCotizantes) ||
      input.totalCotizantes! < 0
    ) {
      add(
        employerRecord,
        7,
        'CAMPO_7_TOTAL_COTIZANTES_NO_DISPONIBLE',
        'No se puede validar la clase A/B sin contar los cotizantes únicos de todas las sucursales incluidas.',
      );
    } else if (
      (employerClass === 'A' && input.totalCotizantes! < 200) ||
      (employerClass === 'B' && input.totalCotizantes! >= 200)
    ) {
      add(
        employerRecord,
        7,
        'CAMPO_7_CLASE_NO_COINCIDE_COTIZANTES',
        'La clase A requiere 200 o más cotizantes; la clase B requiere menos de 200 cotizantes.',
      );
    }
  } else if (employerClass === 'C' || employerClass === 'D') {
    add(
      employerRecord,
      7,
      'CAMPO_7_ELEGIBILIDAD_ESPECIAL_SIN_VERIFICAR',
      'Las clases C y D requieren evidencia de elegibilidad que este preflight aún no valida.',
    );
  }
  if (
    (employerClass === 'A' || employerClass === 'B') &&
    employerPila?.beneficioLey1429 === true
  ) {
    add(
      employerRecord,
      7,
      'CAMPO_7_CLASE_BENEFICIO_LEY1429_INCONSISTENTE',
      'El beneficio de Ley 1429 requiere clasificar al aportante como clase D; esa clase sigue bloqueada hasta validar elegibilidad.',
    );
  }
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
  } else if (personType === 'N' && text(employer?.digitoVerif) !== '0') {
    add(
      employerRecord,
      4,
      'CAMPO_4_DV_PERSONA_NATURAL_DEBE_SER_CERO',
      'AT2 v30 requiere reportar cero como dígito de verificación para persona natural.',
    );
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
    if (!text(employerPila?.nombreSucursal)) {
      requireText(
        employerRecord,
        6,
        employerPila?.codigoSucursal,
        'La sucursal requiere nombre o código PILA para el campo de nombre.',
      );
    }
  } else if (presentation === 'U' && text(employerPila?.codigoSucursal)) {
    add(
      employerRecord,
      5,
      'CAMPO_5_CODIGO_SUCURSAL_NO_PERMITIDO_EN_PRESENTACION_UNICA',
      'La presentación única requiere dejar en blanco el código de sucursal del campo 5 según AT2 v30.',
    );
  }
  for (const [field, value, label, maxLength] of [
    [5, employerPila?.codigoSucursal, 'código de sucursal', 10],
    [6, employerPila?.nombreSucursal, 'nombre de sucursal', 40],
    [11, employer?.direccion, 'dirección del aportante', 40],
    [16, employerPila?.fax, 'fax del aportante', 10],
    [17, employer?.email, 'correo del aportante', 60],
    [
      18,
      employerPila?.representanteNumeroDocumento,
      'documento del representante',
      16,
    ],
    [
      21,
      employerPila?.representantePrimerApellido,
      'primer apellido del representante',
      20,
    ],
    [
      22,
      employerPila?.representanteSegundoApellido,
      'segundo apellido del representante',
      30,
    ],
    [
      23,
      employerPila?.representantePrimerNombre,
      'primer nombre del representante',
      20,
    ],
    [
      24,
      employerPila?.representanteSegundoNombre,
      'segundo nombre del representante',
      30,
    ],
  ] as const) {
    validateFieldLength(employerRecord, field, value, maxLength, label);
  }
  const fax = text(employerPila?.fax);
  if (fax && !/^\d{1,10}$/.test(fax)) {
    add(
      employerRecord,
      16,
      'CAMPO_16_FAX_NO_VALIDO',
      'El fax debe contener solo dígitos y hasta 10 posiciones según AT2 v30.',
    );
  }
  const employerEmail = text(employer?.email);
  if (employerEmail && !validPilaEmail(employerEmail)) {
    add(
      employerRecord,
      17,
      'CAMPO_17_CORREO_NO_VALIDO',
      'El correo no cumple los caracteres y la estructura de dominio definidos por AT2 v30.',
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
  } else if (employerPila.aportesExoneradosConfirmado) {
    add(
      employerRecord,
      33,
      'CAMPO_33_ELEGIBILIDAD_EXONERACION_SIN_VALIDAR',
      'La exoneración fue declarada, pero aún falta validar la evidencia de elegibilidad y sus condiciones.',
    );
  }
  if (typeof employerPila?.beneficioCcfLey1429 !== 'boolean') {
    add(
      employerRecord,
      34,
      'CAMPO_34_BENEFICIO_CCF_SIN_CONFIRMAR',
      'Falta confirmar si aplica el beneficio de la Ley 1429 para CCF.',
    );
  } else if (employerPila.beneficioCcfLey1429) {
    add(
      employerRecord,
      34,
      'CAMPO_34_ELEGIBILIDAD_CCF_SIN_VALIDAR',
      'El beneficio CCF fue declarado, pero aún falta validar la evidencia de elegibilidad.',
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
  const representativeDocumentType = text(
    employerPila?.representanteTipoDocumento,
  );
  const representativeDocument = text(
    employerPila?.representanteNumeroDocumento,
  );
  const legalEntity = personType === 'J';
  if (legalEntity) {
    requireText(
      employerRecord,
      18,
      representativeDocument,
      'La persona jurídica requiere la identificación del representante legal.',
    );
  }
  if (legalEntity || representativeDocumentType || representativeDocument) {
    if (
      representativeDocumentType === null ||
      !representativeDocumentTypes.has(representativeDocumentType)
    ) {
      add(
        employerRecord,
        20,
        'CAMPO_20_DOCUMENTO_REPRESENTANTE_NO_VALIDO',
        'Se requiere un tipo de documento válido para la identificación del representante legal.',
      );
    } else if (
      representativeDocument &&
      !validRepresentativeIdentification(
        representativeDocumentType,
        representativeDocument,
      )
    ) {
      add(
        employerRecord,
        18,
        'CAMPO_18_IDENTIFICACION_REPRESENTANTE_NO_VALIDA',
        'La identificación del representante no cumple los caracteres o la longitud AT2 v30 para el tipo de documento declarado.',
      );
    }
    if (!legalEntity && !representativeDocument) {
      add(
        employerRecord,
        18,
        'CAMPO_18_IDENTIFICACION_REPRESENTANTE_INCOMPLETA',
        'Si se declara un tipo de documento del representante para persona natural, también se requiere su número.',
      );
    }
  }
  if (legalEntity) {
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
  if (employerPila?.sinAccionEspecial !== true) {
    add(
      employerRecord,
      26,
      employerPila?.sinAccionEspecial === false
        ? 'CAMPO_26_ACCION_ESPECIAL_FUERA_DEL_MVP'
        : 'CAMPO_26_ACCION_ESPECIAL_SIN_CONFIRMAR',
      employerPila?.sinAccionEspecial === false
        ? 'El aportante declara una acción especial; el MVP solo admite el código 0 confirmado cuando no aplica ninguna acción.'
        : 'Falta confirmar expresamente si no aplica una acción especial del aportante.',
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

  const eventSources = [payrollPilaEvents, contextPilaEvents].filter(
    (value): value is unknown[] => Array.isArray(value),
  );
  if (
    input.payloadVersion === 2 &&
    payrollPilaEvents === undefined &&
    contextPilaEvents === undefined
  ) {
    add(
      'DETALLE_TIPO_2',
      null,
      'EVENTOS_PILA_NO_CONSERVADOS_EN_SNAPSHOT',
      'El snapshot PILA no conserva la lista de eventos del período; no se puede confirmar que las novedades estén segmentadas.',
    );
  }
  if (
    input.payloadVersion === 2 &&
    (payrollPilaEvents === undefined) !== (contextPilaEvents === undefined)
  ) {
    add(
      'DETALLE_TIPO_2',
      null,
      'EVENTOS_PILA_SNAPSHOT_DESINCRONIZADO',
      'Falta una de las copias de eventos PILA que debe conservar el snapshot v2; requiere revisar la captura aprobada.',
    );
  }
  if (
    (payrollPilaEvents !== undefined && !Array.isArray(payrollPilaEvents)) ||
    (contextPilaEvents !== undefined && !Array.isArray(contextPilaEvents))
  ) {
    add(
      'DETALLE_TIPO_2',
      null,
      'EVENTOS_PILA_FORMATO_NO_VALIDO',
      'El snapshot PILA contiene una lista de eventos con formato no válido; no se puede verificar su segmentación.',
    );
  }
  if (
    Array.isArray(payrollPilaEvents) &&
    Array.isArray(contextPilaEvents) &&
    JSON.stringify(payrollPilaEvents) !== JSON.stringify(contextPilaEvents)
  ) {
    add(
      'DETALLE_TIPO_2',
      null,
      'EVENTOS_PILA_SNAPSHOT_DESINCRONIZADO',
      'Las copias de eventos PILA del snapshot no coinciden; requiere revisar la captura aprobada antes de preparar el archivo.',
    );
  }

  if (eventSources.length > 0) {
    const reportedEventCodes = new Set<string>();
    for (const eventValue of eventSources.flat()) {
      const event = object(eventValue);
      const code = text(event?.codigo);
      if (!code) {
        add(
          'DETALLE_TIPO_2',
          null,
          'EVENTO_PILA_SIN_CODIGO_VALIDO',
          'El snapshot contiene una novedad PILA sin código válido; su reporte y segmentación no pueden verificarse.',
        );
        continue;
      }

      if (reportedEventCodes.has(code)) continue;
      reportedEventCodes.add(code);
      const fieldNumber = pilaEventFieldNumbers.get(code) ?? null;
      add(
        'DETALLE_TIPO_2',
        fieldNumber,
        fieldNumber === null
          ? 'EVENTO_PILA_CODIGO_FUERA_DE_MATRIZ'
          : `EVENTO_PILA_${code}_SIN_SEGMENTACION_APROBADA`,
        fieldNumber === null
          ? `La novedad PILA ${code} no pertenece a la matriz del MVP revisada y no tiene una segmentación aprobada.`
          : `La novedad PILA ${code} está congelada en el snapshot, pero Payroll aún no conserva sus segmentos y días/IBC aprobados para el campo ${fieldNumber}.`,
      );
    }
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
  const identification = text(employee?.cedula);
  if (identification === null) {
    requireText(
      detailRecord,
      4,
      employee?.cedula,
      'Falta el número de documento del cotizante.',
    );
  } else if (
    documentType &&
    supportedDocumentTypes.has(documentType) &&
    !validPilaIdentification(documentType, identification)
  ) {
    add(
      detailRecord,
      4,
      'CAMPO_4_IDENTIFICACION_NO_VALIDA',
      'El número del cotizante no cumple los caracteres y la longitud permitidos por AT2 v30 para su tipo de documento.',
    );
  }
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
    requireChoice(
      detailRecord,
      6,
      affiliation.subtipoCotizanteCodigo,
      new Set(['00']),
      'El escenario estándar del MVP requiere confirmar el subtipo 00.',
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
  for (const [field, key, label, maxLength] of [
    [11, 'primerApellido', 'primer apellido', 20],
    [12, 'segundoApellido', 'segundo apellido', 30],
    [13, 'primerNombre', 'primer nombre', 20],
    [14, 'segundoNombre', 'segundo nombre', 30],
  ] as const) {
    validateFieldLength(detailRecord, field, employee?.[key], maxLength, label);
  }
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
  const riskAssignments = Array.isArray(root?.pilaRiskAssignments)
    ? root.pilaRiskAssignments
        .map(object)
        .filter((value): value is JsonRecord => value !== null)
    : [];
  if (riskAssignments.length !== 1) {
    const multiple = riskAssignments.length > 1;
    add(
      detailRecord,
      62,
      multiple
        ? 'CENTRO_TRABAJO_PILA_NO_UNICO'
        : 'CENTRO_TRABAJO_SIN_CODIGO_PILA',
      multiple
        ? 'Hay más de una asignación de centro de trabajo que cruza el período; falta segmentar la planilla.'
        : contract
          ? 'El contrato y la sede están congelados, pero falta una única asignación PILA que cubra el período.'
          : 'Falta el contrato y la asignación de centro PILA que cubren el período.',
    );
    add(
      detailRecord,
      98,
      multiple
        ? 'ACTIVIDAD_ARL_PILA_NO_UNICA'
        : 'ACTIVIDAD_ARL_SIN_VIGENCIA_PILA',
      multiple
        ? 'Hay más de una actividad de riesgos laborales que cruza el período; falta segmentar la planilla.'
        : 'Falta una única actividad económica ARL vigente durante todo el período.',
    );
  } else {
    const assignment = riskAssignments[0];
    const center = nested(assignment, 'centroTrabajo');
    const assignmentStart = date(assignment.vigenteDesde);
    const assignmentEndValue = assignment.vigenteHasta;
    const assignmentEnd =
      assignmentEndValue === null ? null : date(assignmentEndValue);
    const coversPeriod = Boolean(
      periodStart &&
      periodEnd &&
      assignmentStart &&
      assignmentStart <= periodStart &&
      (assignmentEndValue === null ||
        (assignmentEnd !== null && assignmentEnd >= periodEnd)),
    );
    const tenantId = text(employer?.tenantId);
    const sameTenant =
      tenantId !== null &&
      text(assignment.tenantId) === tenantId &&
      text(center?.tenantId) === tenantId;

    if (!coversPeriod || !sameTenant) {
      add(
        detailRecord,
        62,
        !sameTenant
          ? 'CENTRO_TRABAJO_PILA_TENANT_NO_VALIDO'
          : 'CENTRO_TRABAJO_PILA_NO_CUBRE_PERIODO',
        !sameTenant
          ? 'La asignación del centro no pertenece al tenant congelado en el snapshot.'
          : 'La vigencia del centro PILA no cubre todo el período reportado.',
      );
      add(
        detailRecord,
        98,
        !sameTenant
          ? 'ACTIVIDAD_ARL_PILA_TENANT_NO_VALIDO'
          : 'ACTIVIDAD_ARL_PILA_NO_CUBRE_PERIODO',
        !sameTenant
          ? 'La asignación de actividad ARL no pertenece al tenant congelado en el snapshot.'
          : 'La vigencia de la actividad económica ARL no cubre todo el período.',
      );
    } else {
      const workCenterCode = text(center?.codigoCentro);
      if (!workCenterCode) {
        add(
          detailRecord,
          62,
          'CENTRO_TRABAJO_SIN_CODIGO_PILA',
          'Falta el código del centro de trabajo declarado por la ARL.',
        );
      }
      if (
        affiliation &&
        text(center?.arlCodigo) !== text(affiliation.arlCodigo)
      ) {
        add(
          detailRecord,
          62,
          'CENTRO_TRABAJO_ARL_NO_COINCIDE',
          'La ARL declarada para el centro no coincide con la afiliación congelada.',
        );
      } else if (!affiliation) {
        add(
          detailRecord,
          62,
          'CENTRO_TRABAJO_ARL_NO_VERIFICABLE',
          'No hay una afiliación única que permita confirmar la ARL del centro.',
        );
      }

      const activityCode = text(assignment.codigoActividadEconomica);
      if (
        !activityCode ||
        assignment.formatoNormativoVersion !==
          PILA_RISK_ACTIVITY_CATALOG_VERSION ||
        !PILA_RISK_ACTIVITY_CODES.has(activityCode)
      ) {
        add(
          detailRecord,
          98,
          'ACTIVIDAD_ARL_NO_VALIDA_CATALOGO_PILA',
          `El código de actividad no pertenece al catálogo ${PILA_RISK_ACTIVITY_CATALOG_VERSION}.`,
        );
      } else if (
        !affiliation ||
        activityCode[0] !== text(affiliation.arlClaseRiesgo)
      ) {
        add(
          detailRecord,
          98,
          'ACTIVIDAD_ARL_RIESGO_NO_COINCIDE_PILA',
          'La clase de riesgo incluida en el código de actividad no coincide con la afiliación ARL congelada.',
        );
      }
    }
  }

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
  } else if (!fitsNumericField(basicSalary, 9)) {
    add(
      detailRecord,
      40,
      'CAMPO_40_SALARIO_BASICO_SUPERA_LONGITUD',
      'El salario básico del campo 40 supera las 9 posiciones numéricas permitidas por AT2 v30.',
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
    } else if (!fitsNumericField(source.valor, 9)) {
      add(
        detailRecord,
        field,
        `CAMPO_${field}_IBC_SUPERA_LONGITUD`,
        `El IBC de ${label} supera las 9 posiciones numéricas permitidas por AT2 v30.`,
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
  } else if (employerPilaExemption) {
    add(
      detailRecord,
      76,
      'CAMPO_76_ELEGIBILIDAD_EXONERACION_SIN_VALIDAR',
      'La exoneración declarada requiere validar evidencia de elegibilidad y condiciones antes de usarla.',
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
  const totalCotizantes = new Set(
    input.snapshots.map(({ employeeId }) => employeeId),
  ).size;
  const assessments = input.snapshots.map((snapshot) =>
    inspectPilaSnapshotPreparation({ ...snapshot, totalCotizantes }),
  );
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
    formatVersion: null,
    normativeSourceStatus: 'RECONCILIATION_PENDING' as const,
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
      'Este informe revisa insumos conocidos de snapshots aprobados. La fuente oficial AT2 v30 está identificada; el mapeo de campos y las reglas aplicables siguen en reconciliación. No es una validación normativa completa, no genera archivos ni confirma aceptación de un operador.',
  };
}
