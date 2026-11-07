import {
  PILA_RISK_ACTIVITY_CATALOG_VERSION,
  PILA_RISK_ACTIVITY_CODES,
} from './pila-risk-activity-catalog';
import { PILA_AT2_V30_RECORD_LAYOUTS } from './pila-at2-v30-record-serializer';
import {
  isValidPilaCotizanteIdentification,
  isValidPilaEmployerIdentification,
  isValidPilaRepresentativeIdentification,
  PILA_SUPPORTED_COTIZANTE_DOCUMENT_TYPES,
  PILA_SUPPORTED_EMPLOYER_DOCUMENT_TYPES,
  PILA_SUPPORTED_REPRESENTATIVE_DOCUMENT_TYPES,
} from './pila-document-identity';
import { isValidPilaEmail } from './pila-email-validation';
import {
  mapPilaAt2V30DetailCandidate,
  PILA_AT2_V30_CONFIRMED_NON_EXEMPT_COTIZANTE_FIELD_NUMBERS,
  PILA_AT2_V30_NO_EVENT_NOVELTY_FIELD_NUMBERS,
  PILA_AT2_V30_PRIVATE_EMPLOYER_ESAP_MEN_FIELD_NUMBERS,
  PILA_AT2_V30_STANDARD_DEPENDENT_EMPTY_FIELD_NUMBERS,
  PILA_AT2_V30_PENSION_CONTRIBUTION_FIELD_NUMBERS,
} from './pila-at2-v30-detail-mapper';
import {
  PILA_AT2_V30_DETAIL_RECORD_SEQUENCE_RULE_VERSION,
  sequencePilaAt2V30DetailCandidates,
} from './pila-at2-v30-detail-sequencer';
import { mapPilaAt2V30HeaderCandidate } from './pila-at2-v30-header-mapper';
import { mapPilaAt2V30EmployerAggregateCandidate } from './pila-at2-v30-employer-mapper';
import { isColombiaDaneDepartmentCode } from '@saas/types';

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

export interface PilaPreparationAffectedEmployee {
  id: string;
  name: string;
}

export interface PilaExportReadinessBlocker {
  code:
    | 'SOI_OPERATOR_FIELDS_UNCONFIRMED'
    | 'PILA_PAYMENT_DATE_REQUIRED'
    | 'PILA_PAYMENT_DATE_SNAPSHOT_INCONSISTENT'
    | 'AT2_HEADER_CCF_IBC_TOTAL_SUPERA_LONGITUD'
    | 'PILA_PENSION_RULESET_AFTER_2027_NOT_RECONCILED'
    | 'OPERATOR_UPLOAD_NOT_VERIFIED';
  scope: 'FILE_GENERATION' | 'OPERATOR_COMPATIBILITY';
  title: string;
  message: string;
  fields: Array<{
    record: PilaPreparationRecord;
    fieldNumbers: number[];
  }>;
  evidence: string;
}

export interface PilaDetailFieldCandidateStatus {
  fieldNumber: number;
  candidateEmployees: number;
  pendingEmployees: number;
  sourceLabel?: string;
  candidateValues?: Array<{
    employeeId: string;
    employeeName: string;
    value: string | number | null;
    emptyAs?: 'spaces' | 'zeros';
    ruleVersion?: string;
  }>;
  pendingReasons: Array<{
    reason: string;
    affectedEmployees: PilaPreparationAffectedEmployee[];
  }>;
}

export interface PilaExportReadiness {
  recordLayoutVersion: 'AT2_V30';
  fileGenerationStatus: 'IMPLEMENTED';
  localValidationStatus: 'PER_EXPORT';
  operatorAcceptanceStatus: 'NOT_VERIFIED';
  blockers: PilaExportReadinessBlocker[];
}

const pilaExportReadiness: PilaExportReadiness = {
  recordLayoutVersion: 'AT2_V30',
  fileGenerationStatus: 'IMPLEMENTED',
  localValidationStatus: 'PER_EXPORT',
  operatorAcceptanceStatus: 'NOT_VERIFIED',
  blockers: [
    {
      code: 'SOI_OPERATOR_FIELDS_UNCONFIRMED',
      scope: 'OPERATOR_COMPATIBILITY',
      title: 'Falta verificar los campos asignados por SOI durante la carga',
      message:
        'Los mapas conservan posiciones vacías candidatas para campos que AT2 v30 asigna al operador. La carga real debe confirmar que SOI completa esas posiciones; no se declara compatibilidad hasta probar el archivo.',
      fields: [
        { record: 'APORTANTE_TIPO_1', fieldNumbers: [28, 29] },
        { record: 'CABECERA_TIPO_2', fieldNumbers: [2, 15, 17, 18, 22] },
      ],
      evidence:
        'AT2 v30, pp. 15, 26 y 29–30; SOI selecciona tipo de planilla y período antes de cargar el archivo, pero la representación vacía no está confirmada por una carga real.',
    },
    {
      code: 'OPERATOR_UPLOAD_NOT_VERIFIED',
      scope: 'OPERATOR_COMPATIBILITY',
      title: 'No hay aceptación de carga verificada en un operador',
      message:
        'No se ha probado un archivo candidato en SOI ni en otro portal; el producto no debe anunciar compatibilidad con un operador.',
      fields: [],
      evidence:
        'ADR-013 exige prueba aceptada por operador antes de declarar compatibilidad.',
    },
  ],
};

export interface PilaSnapshotPreparationInput {
  employeeId: string;
  payloadVersion: number | null;
  payload: unknown;
  totalCotizantes?: number;
}

export interface PilaPensionTransitionSummary {
  totalSnapshots: number;
  statusS: number;
  statusN: number;
  sinValorUtilizable: number;
  historicosSinCampo5: number;
  alcanceNoVerificado: number;
  versionIncompatible: number;
}

export interface PilaSnapshotPreparation {
  employeeId: string;
  employeeName: string;
  issues: PilaPreparationIssue[];
}

const pensionSystemEffectiveDate = '2027-04-01';
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

function validCalendarDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function snapshotPaymentDate(
  snapshot: PilaSnapshotPreparationInput,
): string | null {
  const payroll = nested(object(snapshot.payload), 'payroll');
  const value = text(payroll?.fechaPrevistaPagoPila);
  return validCalendarDate(value) ? value : null;
}

function summarizePensionTransitionStatus(
  snapshots: readonly PilaSnapshotPreparationInput[],
  expectedScope: {
    tenantId?: string;
    period: { id: string; fechaInicio: Date; fechaFin: Date };
  },
): PilaPensionTransitionSummary {
  const summary: PilaPensionTransitionSummary = {
    totalSnapshots: snapshots.length,
    statusS: 0,
    statusN: 0,
    sinValorUtilizable: 0,
    historicosSinCampo5: 0,
    alcanceNoVerificado: 0,
    versionIncompatible: 0,
  };

  for (const snapshot of snapshots) {
    const root = object(snapshot.payload);
    const matchesVersion = root?.schemaVersion === snapshot.payloadVersion;
    if (
      matchesVersion &&
      snapshot.payloadVersion !== null &&
      snapshot.payloadVersion >= 1 &&
      snapshot.payloadVersion <= 6
    ) {
      summary.historicosSinCampo5 += 1;
      continue;
    }

    if (
      (snapshot.payloadVersion === 7 ||
        snapshot.payloadVersion === 8 ||
        snapshot.payloadVersion === 9 ||
        snapshot.payloadVersion === 10 ||
        snapshot.payloadVersion === 11) &&
      root?.schemaVersion === snapshot.payloadVersion
    ) {
      const employer = nested(root, 'employer');
      const period = nested(root, 'period');
      const periodStart = expectedScope.period.fechaInicio
        .toISOString()
        .slice(0, 10);
      const periodEnd = expectedScope.period.fechaFin
        .toISOString()
        .slice(0, 10);
      if (
        !expectedScope.tenantId ||
        employer?.tenantId !== expectedScope.tenantId ||
        period?.payrollPeriodId !== expectedScope.period.id ||
        text(period?.fechaInicio) !== periodStart ||
        text(period?.fechaFin) !== periodEnd
      ) {
        summary.alcanceNoVerificado += 1;
        continue;
      }

      const payroll = nested(root, 'payroll');
      const fspSubaccounts = nested(payroll, 'fspSubaccounts');
      const status = fspSubaccounts?.estadoAfiliacionPensional;
      if (status === 'S') summary.statusS += 1;
      else if (status === 'N') summary.statusN += 1;
      else summary.sinValorUtilizable += 1;
      continue;
    }

    summary.versionIncompatible += 1;
  }

  return summary;
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
    ((input.payloadVersion === 2 ||
      input.payloadVersion === 3 ||
      input.payloadVersion === 4 ||
      input.payloadVersion === 5 ||
      input.payloadVersion === 6 ||
      input.payloadVersion === 7 ||
      input.payloadVersion === 8 ||
      input.payloadVersion === 9 ||
      input.payloadVersion === 10 ||
      input.payloadVersion === 11) &&
      root?.schemaVersion === input.payloadVersion);
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
  const contract = nested(root, 'contract');
  const payroll = nested(root, 'payroll');
  const payrollPilaEvents = payroll?.pilaEvents;
  const contextPilaEvents = root?.pilaEvents;
  const periodStart = date(period?.fechaInicio);
  const periodEnd = date(period?.fechaFin);
  const ingressDetailCandidate =
    (input.payloadVersion === 10 || input.payloadVersion === 11) &&
    periodStart &&
    periodEnd &&
    text(period?.payrollPeriodId) &&
    text(employer?.tenantId)
      ? mapPilaAt2V30DetailCandidate(input, {
          expectedTenantId: text(employer?.tenantId),
          planillaType: 'E',
          period: {
            id: text(period?.payrollPeriodId)!,
            fechaInicio: new Date(`${periodStart}T00:00:00.000Z`),
            fechaFin: new Date(`${periodEnd}T00:00:00.000Z`),
          },
        })
      : null;
  const approvedNewHireIngress = Boolean(
    ingressDetailCandidate?.normativeRuleVersions.newHireIngressFields ===
      'AT2_V30_NEW_HIRE_INGRESS_FIELDS_V1' &&
    ingressDetailCandidate.normativeRuleVersions.newHireBasicSalaryField40 ===
      'PILA_ING_FIELD_40_FROM_APPROVED_BASE_V1' &&
    ingressDetailCandidate.values[15]?.value === 'X' &&
    typeof ingressDetailCandidate.values[40]?.value === 'number' &&
    ingressDetailCandidate.values[80]?.value === date(employee?.fechaIngreso) &&
    [36, 37, 38, 39].every((fieldNumber) => {
      const sourceField =
        fieldNumber === 36
          ? 'pension'
          : fieldNumber === 37
            ? 'salud'
            : fieldNumber === 38
              ? 'riesgos'
              : 'cajaCompensacion';
      return (
        ingressDetailCandidate.values[fieldNumber]?.value ===
        nested(nested(payroll, 'diasCotizadosPorSubsistema'), sourceField)
          ?.valor
      );
    }),
  );
  const approvedRetirement = Boolean(
    ingressDetailCandidate?.normativeRuleVersions.retirementEventFields ===
      'AT2_V30_SINGLE_RETIREMENT_FIELDS_V1' &&
    ingressDetailCandidate.normativeRuleVersions
      .retirementBasicSalaryField40 ===
      'PILA_RET_FIELD_40_FROM_APPROVED_BASE_V1' &&
    ingressDetailCandidate.values[16]?.value === 'X' &&
    ingressDetailCandidate.values[81]?.value === date(employee?.fechaRetiro) &&
    typeof ingressDetailCandidate.values[40]?.value === 'number' &&
    [36, 37, 38, 39].every((fieldNumber) => {
      const sourceField =
        fieldNumber === 36
          ? 'pension'
          : fieldNumber === 37
            ? 'salud'
            : fieldNumber === 38
              ? 'riesgos'
              : 'cajaCompensacion';
      return (
        ingressDetailCandidate.values[fieldNumber]?.value ===
        nested(nested(payroll, 'diasCotizadosPorSubsistema'), sourceField)
          ?.valor
      );
    }),
  );
  const approvedIngressRetirement = Boolean(
    ingressDetailCandidate?.normativeRuleVersions
      .samePeriodIngressRetirementFields ===
      'AT2_V30_SAME_PERIOD_ING_RET_FIELDS_V1' &&
    ingressDetailCandidate.normativeRuleVersions
      .ingressRetirementBasicSalaryField40 ===
      'PILA_ING_RET_FIELD_40_FROM_APPROVED_BASE_V1' &&
    ingressDetailCandidate.values[15]?.value === 'X' &&
    ingressDetailCandidate.values[16]?.value === 'X' &&
    typeof ingressDetailCandidate.values[40]?.value === 'number' &&
    ingressDetailCandidate.values[80]?.value === date(employee?.fechaIngreso) &&
    ingressDetailCandidate.values[81]?.value === date(employee?.fechaRetiro) &&
    [36, 37, 38, 39].every((fieldNumber) => {
      const sourceField =
        fieldNumber === 36
          ? 'pension'
          : fieldNumber === 37
            ? 'salud'
            : fieldNumber === 38
              ? 'riesgos'
              : 'cajaCompensacion';
      return (
        ingressDetailCandidate.values[fieldNumber]?.value ===
        nested(nested(payroll, 'diasCotizadosPorSubsistema'), sourceField)
          ?.valor
      );
    }),
  );
  const coverageStart =
    approvedNewHireIngress || approvedIngressRetirement
      ? (date(employee?.fechaIngreso) ?? periodStart)
      : periodStart;
  const coverageEnd =
    approvedRetirement || approvedIngressRetirement
      ? (date(employee?.fechaRetiro) ?? periodEnd)
      : periodEnd;

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
    const rawValue = typeof value === 'string' ? value : null;
    if (rawValue !== null && Array.from(rawValue).length > maxLength) {
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
    PILA_SUPPORTED_EMPLOYER_DOCUMENT_TYPES,
    'Falta confirmar el tipo de documento del aportante.',
  );
  const employerDocumentType = text(employerPila?.tipoDocumentoAportante);
  const employerId = text(employer?.nit);
  if (
    !employerId ||
    !employerDocumentType ||
    !isValidPilaEmployerIdentification(employerDocumentType, employerId)
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
  const employerEmail =
    typeof employer?.email === 'string' && employer.email.trim().length > 0
      ? employer.email
      : null;
  if (employerEmail && !isValidPilaEmail(employerEmail)) {
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
      !PILA_SUPPORTED_REPRESENTATIVE_DOCUMENT_TYPES.has(
        representativeDocumentType,
      )
    ) {
      add(
        employerRecord,
        20,
        'CAMPO_20_DOCUMENTO_REPRESENTANTE_NO_VALIDO',
        'Se requiere un tipo de documento válido para la identificación del representante legal.',
      );
    } else if (
      representativeDocument &&
      !isValidPilaRepresentativeIdentification(
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
    (input.payloadVersion ?? 0) >= 2 &&
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
    (input.payloadVersion ?? 0) >= 2 &&
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
      const isApprovedSingleIngress =
        code === 'ING' &&
        ingressDetailCandidate?.values[15]?.value === 'X' &&
        ingressDetailCandidate.values[80]?.value === text(event?.fechaInicio) &&
        [36, 37, 38, 39, 80].every(
          (fieldNumber) =>
            !ingressDetailCandidate.unresolvedFields.some(
              (field) => field.fieldNumber === fieldNumber,
            ),
        );
      const isApprovedSingleRetirement =
        code === 'RET' &&
        approvedRetirement &&
        ingressDetailCandidate?.values[81]?.value ===
          text(event?.fechaInicio) &&
        [16, 36, 37, 38, 39, 40, 81].every(
          (fieldNumber) =>
            !ingressDetailCandidate.unresolvedFields.some(
              (field) => field.fieldNumber === fieldNumber,
            ),
        );
      const isApprovedSingleFullMonthVsp =
        code === 'VSP' &&
        ingressDetailCandidate?.normativeRuleVersions.vspEventFields ===
          'AT2_V30_SINGLE_FULL_MONTH_VSP_FIELDS_V1' &&
        ingressDetailCandidate.values[21]?.value === 'X' &&
        ingressDetailCandidate.values[82]?.value === text(event?.fechaInicio);
      if (
        isApprovedSingleIngress ||
        isApprovedSingleRetirement ||
        isApprovedSingleFullMonthVsp
      ) {
        continue;
      }
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
  validateFieldLength(
    'CABECERA_TIPO_2',
    14,
    employerPila?.codigoArlAportante,
    6,
    'código ARL del aportante',
  );

  // Registro tipo 2 por cotizante. Este reporte revisa insumos capturados,
  // no inventa códigos ni completa datos consultando Empleado/Sede actuales.
  const detailRecord: PilaPreparationRecord = 'DETALLE_TIPO_2';
  if (input.totalCotizantes !== undefined) {
    if (!safeInteger(input.totalCotizantes)) {
      add(
        'CABECERA_TIPO_2',
        19,
        'CAMPO_19_CONTEO_COTIZANTES_NO_VALIDO',
        'El conteo de cotizantes únicos debe ser un entero no negativo.',
      );
    } else if (!fitsNumericField(input.totalCotizantes, 5)) {
      add(
        'CABECERA_TIPO_2',
        19,
        'CAMPO_19_CONTEO_COTIZANTES_SUPERA_LONGITUD',
        'El campo 19 admite hasta 99.999 cotizantes únicos; el conteo no se truncará.',
      );
    }
  }
  const documentType = text(employee?.tipoDocumento);
  if (
    !documentType ||
    !PILA_SUPPORTED_COTIZANTE_DOCUMENT_TYPES.has(documentType)
  ) {
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
    PILA_SUPPORTED_COTIZANTE_DOCUMENT_TYPES.has(documentType) &&
    !isValidPilaCotizanteIdentification(documentType, identification)
  ) {
    add(
      detailRecord,
      4,
      'CAMPO_4_IDENTIFICACION_NO_VALIDA',
      'El número del cotizante no cumple los caracteres y la longitud permitidos por AT2 v30 para su tipo de documento.',
    );
  }
  const affiliationRows = Array.isArray(root?.affiliations)
    ? root.affiliations
    : [];
  const affiliations = affiliationRows
    .map(object)
    .filter((value): value is JsonRecord => value !== null);
  if (affiliations.length !== affiliationRows.length) {
    add(
      detailRecord,
      5,
      'AFILIACION_PILA_FILA_NO_VALIDA',
      'El snapshot PILA contiene una fila de afiliación con formato no válido; no se puede confirmar la afiliación efectiva única.',
    );
  }
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
      validateFieldLength(detailRecord, field, affiliation[key], 6, label);
    }
    requireText(
      detailRecord,
      77,
      affiliation.arlCodigo,
      'Falta el código confirmado de la administradora ARL para el período.',
    );
    validateFieldLength(
      detailRecord,
      77,
      affiliation.arlCodigo,
      6,
      'código de la administradora ARL',
    );
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
      !coverageEnd ||
      !affiliationStart ||
      (coverageStart !== null && affiliationStart > coverageStart) ||
      (affiliationEndValue !== null &&
        (affiliationEnd === null || affiliationEnd < coverageEnd))
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
  const workLocationRows = Array.isArray(root?.pilaWorkLocations)
    ? root.pilaWorkLocations.map(object)
    : null;
  const workLocation =
    workLocationRows?.length === 1 ? workLocationRows[0] : null;
  const workLocationMunicipality = nested(workLocation, 'municipio');
  const confirmedWorkLocation = Boolean(
    (input.payloadVersion ?? 0) >= 3 &&
    workLocation &&
    periodStart &&
    periodEnd &&
    coverageStart &&
    coverageEnd &&
    workLocation.tenantId === text(employer?.tenantId) &&
    text(workLocation.municipioId) !== null &&
    workLocation.municipioId === workLocationMunicipality?.id &&
    date(workLocation.vigenteDesde) !== null &&
    date(workLocation.vigenteDesde)! <= coverageStart &&
    (workLocation.vigenteHasta === null ||
      (date(workLocation.vigenteHasta) !== null &&
        date(workLocation.vigenteHasta)! >= coverageEnd)),
  );
  const affiliationCoversPeriod = Boolean(
    affiliations.length === 1 &&
    affiliation &&
    periodStart &&
    periodEnd &&
    coverageStart &&
    coverageEnd &&
    date(affiliation.vigenteDesde) !== null &&
    date(affiliation.vigenteDesde)! <= coverageStart &&
    (affiliation.vigenteHasta === null ||
      (date(affiliation.vigenteHasta) !== null &&
        date(affiliation.vigenteHasta)! >= coverageEnd)) &&
    text(affiliation.tipoCotizanteCodigo) === '01' &&
    text(affiliation.subtipoCotizanteCodigo) === '00',
  );
  const municipalityCode = text(workLocationMunicipality?.codigo);
  const ccfDepartmentCode = text(
    affiliation?.cajaCompensacionDepartamentoCodigo,
  );
  const locationIssue =
    (input.payloadVersion ?? 0) < 3
      ? {
          code: 'UBICACION_LABORAL_PILA_SIN_FUENTE_CONFIRMADA',
          message:
            'El snapshot histórico no conserva una ubicación laboral PILA explícita; no se completa desde la sede ni desde datos actuales.',
        }
      : !confirmedWorkLocation
        ? {
            code: 'UBICACION_LABORAL_PILA_FUENTE_INVALIDA',
            message:
              workLocationRows === null
                ? 'El snapshot no conserva una lista válida de ubicaciones laborales PILA.'
                : workLocationRows.length === 0
                  ? 'Falta una ubicación laboral PILA confirmada que cubra el período.'
                  : workLocationRows.length > 1
                    ? 'Hay varias ubicaciones laborales PILA durante el período; la segmentación no está habilitada.'
                    : 'La ubicación laboral PILA congelada no cubre todo el período o no conserva tenant, municipio y vigencia completos.',
          }
        : !affiliationCoversPeriod
          ? {
              code: 'AFILIACION_CCF_SIN_COBERTURA_PERIODO',
              message:
                'Falta una afiliación CCF única de tipo 01/00 que cubra todo el período.',
            }
          : !municipalityCode ||
              !/^\d{5}$/.test(municipalityCode) ||
              !isColombiaDaneDepartmentCode(municipalityCode.slice(0, 2))
            ? {
                code: 'UBICACION_LABORAL_PILA_DANE_CODIGO_INVALIDO',
                message:
                  'El municipio laboral congelado no conserva un código DIVIPOLA válido de cinco dígitos.',
              }
            : !isColombiaDaneDepartmentCode(ccfDepartmentCode)
              ? {
                  code: 'AFILIACION_CCF_DEPARTAMENTO_DANE_SIN_DATO',
                  message:
                    'La afiliación CCF congelada no conserva un departamento DIVIPOLA válido tomado de su constancia.',
                }
              : ccfDepartmentCode !== municipalityCode.slice(0, 2)
                ? {
                    code: 'UBICACION_LABORAL_PILA_CCF_DEPARTAMENTO_NO_COINCIDE',
                    message:
                      'El departamento de la ubicación laboral no coincide con el departamento de la CCF afiliada, como exige AT2 v30.',
                  }
                : null;
  if (locationIssue) {
    for (const fieldNumber of [9, 10]) {
      add(detailRecord, fieldNumber, locationIssue.code, locationIssue.message);
    }
  }
  const riskAssignmentRows = Array.isArray(root?.pilaRiskAssignments)
    ? root.pilaRiskAssignments
    : [];
  const riskAssignments = riskAssignmentRows
    .map(object)
    .filter((value): value is JsonRecord => value !== null);
  if (riskAssignments.length !== riskAssignmentRows.length) {
    add(
      detailRecord,
      62,
      'CENTRO_TRABAJO_PILA_FILA_NO_VALIDA',
      'El snapshot PILA contiene una fila de centro de trabajo con formato no válido; no se puede confirmar la asignación efectiva única.',
    );
    add(
      detailRecord,
      98,
      'ACTIVIDAD_ARL_PILA_FILA_NO_VALIDA',
      'El snapshot PILA contiene una fila de actividad económica con formato no válido; no se puede confirmar la asignación efectiva única.',
    );
  }
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
      coverageStart &&
      coverageEnd &&
      assignmentStart &&
      assignmentStart <= coverageStart &&
      (assignmentEndValue === null ||
        (assignmentEnd !== null && assignmentEnd >= coverageEnd)),
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
      const workCenterCodeValue = center?.codigoCentro;
      const workCenterCode =
        typeof workCenterCodeValue === 'string' ? workCenterCodeValue : null;
      if (!workCenterCode) {
        add(
          detailRecord,
          62,
          'CENTRO_TRABAJO_SIN_CODIGO_PILA',
          'Falta el código del centro de trabajo declarado por la ARL.',
        );
      } else if (!/^\d{1,9}$/.test(workCenterCode)) {
        add(
          detailRecord,
          62,
          'CENTRO_TRABAJO_CODIGO_FORMATO_AT2_INVALIDO',
          'El campo 62 del AT2 v30 requiere un código de centro de trabajo de 1 a 9 dígitos; no se truncará ni convertirá el valor declarado por la ARL.',
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
    } else if (
      value !== 30 &&
      !(
        (approvedNewHireIngress || approvedRetirement) &&
        ingressDetailCandidate?.values[field]?.value === value
      )
    ) {
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
    const supportedParafiscalRule =
      source?.reglaVersion === 'CO_PARAFISCAL_BASE_V1' ||
      ((root?.schemaVersion === 10 || root?.schemaVersion === 11) &&
        source?.reglaVersion === 'CO_PARAFISCAL_BASE_V2' &&
        safeInteger(source?.valor) &&
        ingressDetailCandidate?.values[95]?.value === source?.valor);
    if (field === 95 && !supportedParafiscalRule) {
      add(
        detailRecord,
        field,
        'CAMPO_95_REGLA_SIN_VERSION',
        'La base parafiscal no conserva la versión explícita de su regla candidata.',
      );
    }
  }
  if ([2, 3, 4, 5, 6, 7, 8, 9].includes(Number(root?.schemaVersion))) {
    const rawConceptRows = payroll?.concepts;
    const conceptRows = Array.isArray(rawConceptRows)
      ? rawConceptRows
          .map(object)
          .filter((row): row is JsonRecord => row !== null)
      : [];
    if (
      !Array.isArray(rawConceptRows) ||
      rawConceptRows.some((row) => object(row) === null)
    ) {
      add(
        'SNAPSHOT',
        null,
        'PILA_CONCEPTO_FILA_NO_VALIDA',
        'El snapshot PILA debe conservar la lista completa de conceptos como filas válidas.',
      );
    }
    const contributionSources = [
      {
        codigo: 'PENSION_EMP',
        tipo: 'DEDUCTION',
        required: true,
        amountField: 47,
        ibcField: 42,
        ibcKey: 'pension',
      },
      {
        codigo: 'PENSION_PAT',
        tipo: 'EMPLOYER_CONTRIBUTION',
        required: true,
        amountField: 47,
        ibcField: 42,
        ibcKey: 'pension',
      },
      {
        codigo: 'SALUD_EMP',
        tipo: 'DEDUCTION',
        required: true,
        amountField: 55,
        ibcField: 43,
        ibcKey: 'salud',
      },
      {
        codigo: 'SALUD_PAT',
        tipo: 'EMPLOYER_CONTRIBUTION',
        required: false,
        amountField: 55,
        ibcField: 43,
        ibcKey: 'salud',
      },
      {
        codigo: 'ARL',
        tipo: 'EMPLOYER_CONTRIBUTION',
        required: true,
        amountField: 63,
        ibcField: 44,
        ibcKey: 'riesgos',
      },
      {
        codigo: 'CAJA',
        tipo: 'EMPLOYER_CONTRIBUTION',
        required: true,
        amountField: 65,
        ibcField: 45,
        ibcKey: 'cajaCompensacion',
      },
      {
        codigo: 'SENA',
        tipo: 'EMPLOYER_CONTRIBUTION',
        required: false,
        amountField: 67,
        ibcField: null,
        ibcKey: null,
      },
      {
        codigo: 'ICBF',
        tipo: 'EMPLOYER_CONTRIBUTION',
        required: false,
        amountField: 69,
        ibcField: null,
        ibcKey: null,
      },
      {
        codigo: 'FSP',
        tipo: 'DEDUCTION',
        required: false,
        amountField: 51,
        ibcField: null,
        ibcKey: null,
      },
    ] as const;
    for (const sourceDefinition of contributionSources) {
      const matches = conceptRows.filter(
        (concept) => concept.codigo === sourceDefinition.codigo,
      );
      if (matches.length === 0) {
        if (sourceDefinition.required) {
          add(
            detailRecord,
            sourceDefinition.amountField,
            `CAMPO_${sourceDefinition.amountField}_FUENTE_CONCEPTO_NO_DISPONIBLE`,
            `El snapshot PILA no conserva el concepto ${sourceDefinition.codigo} como fuente candidata del aporte.`,
          );
        }
        continue;
      }
      if (matches.length > 1) {
        add(
          detailRecord,
          sourceDefinition.amountField,
          `CAMPO_${sourceDefinition.amountField}_FUENTE_CONCEPTO_DUPLICADA`,
          `El snapshot PILA conserva más de un concepto ${sourceDefinition.codigo}; no se puede seleccionar una fuente sin ambigüedad.`,
        );
        continue;
      }

      const concept = matches[0];
      if (concept.tipo !== sourceDefinition.tipo) {
        add(
          detailRecord,
          sourceDefinition.amountField,
          `CAMPO_${sourceDefinition.amountField}_FUENTE_CONCEPTO_TIPO_INVALIDO`,
          `El concepto ${sourceDefinition.codigo} no tiene el tipo de nómina esperado para la fuente candidata.`,
        );
      }
      if (
        !safeInteger(concept.base) ||
        typeof concept.factor !== 'number' ||
        !Number.isFinite(concept.factor) ||
        concept.factor < 0 ||
        !fitsNumericField(concept.valor, 9)
      ) {
        add(
          detailRecord,
          sourceDefinition.amountField,
          `CAMPO_${sourceDefinition.amountField}_FUENTE_CONCEPTO_VALOR_INVALIDO`,
          `El concepto ${sourceDefinition.codigo} debe conservar base y valor enteros no negativos, valor de hasta nueve posiciones y tarifa numérica finita.`,
        );
      }
      if (sourceDefinition.ibcKey !== null) {
        const expectedBase = nested(
          subsystemBases,
          sourceDefinition.ibcKey,
        )?.valor;
        if (
          safeInteger(concept.base) &&
          safeInteger(expectedBase) &&
          concept.base !== expectedBase
        ) {
          add(
            detailRecord,
            sourceDefinition.ibcField,
            `CAMPO_${sourceDefinition.ibcField}_FUENTE_CONCEPTO_BASE_NO_COINCIDE`,
            `La base del concepto ${sourceDefinition.codigo} no coincide con el IBC por subsistema congelado.`,
          );
        }
      }
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

function summarizePilaDetailFieldCandidates(
  snapshots: PilaSnapshotPreparationInput[],
  assessments: PilaSnapshotPreparation[],
  fields: readonly PilaDetailFieldCandidateStatus['fieldNumber'][],
  candidatesBySnapshot: Map<
    PilaSnapshotPreparationInput,
    ReturnType<typeof mapPilaAt2V30DetailCandidate>
  >,
  sourceLabels?: Partial<Record<number, string>>,
): PilaDetailFieldCandidateStatus[] {
  const snapshotsPerEmployee = new Map<string, number>();
  for (const snapshot of snapshots) {
    snapshotsPerEmployee.set(
      snapshot.employeeId,
      (snapshotsPerEmployee.get(snapshot.employeeId) ?? 0) + 1,
    );
  }
  const affectedEmployeesById = new Map(
    assessments.map(({ employeeId, employeeName }) => [
      employeeId,
      { id: employeeId, name: employeeName },
    ]),
  );
  const candidatesByEmployee = new Map<
    string,
    ReturnType<typeof mapPilaAt2V30DetailCandidate> | null
  >();
  for (const snapshot of snapshots) {
    const duplicateSnapshot =
      (snapshotsPerEmployee.get(snapshot.employeeId) ?? 0) > 1;
    candidatesByEmployee.set(
      snapshot.employeeId,
      duplicateSnapshot ? null : (candidatesBySnapshot.get(snapshot) ?? null),
    );
  }

  return fields.map((fieldNumber) => {
    const candidateEmployees = new Set<string>();
    const pendingEmployees = new Set<string>();
    const candidateValues: NonNullable<
      PilaDetailFieldCandidateStatus['candidateValues']
    > = [];
    const reasons = new Map<
      string,
      Map<string, PilaPreparationAffectedEmployee>
    >();

    for (const snapshot of snapshots) {
      const employeeId = snapshot.employeeId;
      const duplicateSnapshot = (snapshotsPerEmployee.get(employeeId) ?? 0) > 1;
      const candidate = candidatesByEmployee.get(employeeId) ?? null;
      const fieldValue = candidate?.values[fieldNumber];
      const isCandidate =
        Boolean(fieldValue) && (!sourceLabels || !candidate?.scopeMismatch);
      if (candidate && isCandidate && fieldValue) {
        candidateEmployees.add(employeeId);
        const employeeName =
          affectedEmployeesById.get(employeeId)?.name ?? employeeId;
        if (sourceLabels) {
          const payload = object(snapshot.payload);
          const payroll = nested(payload, 'payroll');
          const subsystemBases = nested(payroll, 'ibcPorSubsistema');
          const otherParafiscalBase = nested(
            subsystemBases,
            'otrosParafiscales',
          );
          const rawRuleVersion = otherParafiscalBase?.reglaVersion;
          const field40RuleVersion =
            candidate.normativeRuleVersions.newHireBasicSalaryField40 ??
            candidate.normativeRuleVersions.retirementBasicSalaryField40 ??
            candidate.normativeRuleVersions.ingressRetirementBasicSalaryField40;
          const ruleVersion =
            fieldNumber === 95 &&
            (rawRuleVersion === 'CO_PARAFISCAL_BASE_V1' ||
              rawRuleVersion === 'CO_PARAFISCAL_BASE_V2')
              ? rawRuleVersion
              : fieldNumber === 40
                ? (field40RuleVersion ?? undefined)
                : undefined;
          candidateValues.push({
            employeeId,
            employeeName,
            value: fieldValue.value,
            ...(fieldValue.emptyAs ? { emptyAs: fieldValue.emptyAs } : {}),
            ...(ruleVersion ? { ruleVersion } : {}),
          });
        }
        continue;
      }

      pendingEmployees.add(employeeId);
      let reason: string;
      if (duplicateSnapshot) {
        reason =
          'Hay más de un snapshot aprobado para el empleado en este período; no se elige uno automáticamente.';
      } else if (sourceLabels && candidate?.scopeMismatch) {
        reason =
          'El snapshot no corresponde al tenant o período consultado; se ocultan sus valores.';
      } else {
        reason =
          candidate?.unresolvedFields.find(
            (field) => field.fieldNumber === fieldNumber,
          )?.reason ??
          'No hay un valor candidato disponible en el snapshot aprobado.';
      }
      const affectedEmployees =
        reasons.get(reason) ??
        new Map<string, PilaPreparationAffectedEmployee>();
      affectedEmployees.set(
        employeeId,
        affectedEmployeesById.get(employeeId) ?? {
          id: employeeId,
          name: employeeId,
        },
      );
      reasons.set(reason, affectedEmployees);
    }

    return {
      fieldNumber,
      candidateEmployees: candidateEmployees.size,
      pendingEmployees: pendingEmployees.size,
      ...(sourceLabels?.[fieldNumber]
        ? {
            sourceLabel: sourceLabels[fieldNumber],
            candidateValues: candidateValues.sort((left, right) =>
              left.employeeName.localeCompare(right.employeeName, 'es'),
            ),
          }
        : {}),
      pendingReasons: [...reasons].map(([reason, affectedEmployees]) => ({
        reason,
        affectedEmployees: [...affectedEmployees.values()],
      })),
    };
  });
}

export function buildPilaPreparationReport(input: {
  tenantId?: string;
  expectedEmployeeIds?: readonly string[];
  period: {
    id: string;
    fechaInicio: Date;
    fechaFin: Date;
  };
  snapshots: PilaSnapshotPreparationInput[];
}) {
  const paymentDates = input.snapshots.map(snapshotPaymentDate);
  const distinctPaymentDates = new Set(
    paymentDates.filter((date): date is string => date !== null),
  );
  const hasMissingPaymentDate =
    input.snapshots.length > 0 && paymentDates.some((date) => date === null);
  const hasConflictingPaymentDates = distinctPaymentDates.size > 1;
  const snapshotPaymentDateValue =
    !hasMissingPaymentDate && distinctPaymentDates.size === 1
      ? [...distinctPaymentDates][0]
      : null;
  const paymentDateBlocker: PilaExportReadinessBlocker | null =
    hasMissingPaymentDate
      ? {
          code: 'PILA_PAYMENT_DATE_REQUIRED',
          scope: 'FILE_GENERATION',
          title: 'Falta la fecha prevista de pago de aportes PILA',
          message:
            'Al menos un snapshot aprobado no conserva una fecha prevista de pago PILA válida. La fecha debe quedar congelada en todos los snapshots antes de una futura exportación; este informe no modifica los snapshots.',
          fields: [],
          evidence:
            'ADR-013 establece que la aprobación congela la fecha prevista de pago en el snapshot y que la exportación consume snapshots aprobados.',
        }
      : null;
  const paymentDateConflictBlocker: PilaExportReadinessBlocker | null =
    hasConflictingPaymentDates
      ? {
          code: 'PILA_PAYMENT_DATE_SNAPSHOT_INCONSISTENT',
          scope: 'FILE_GENERATION',
          title: 'Los snapshots conservan fechas previstas diferentes',
          message:
            'Los snapshots aprobados del período no comparten la misma fecha prevista de pago PILA. La exportación debe detenerse hasta revisar la consistencia de sus fuentes; cambiar la fecha del período no reescribe snapshots aprobados.',
          fields: [],
          evidence:
            'ADR-013 requiere conservar la fecha seleccionada con la evidencia de snapshots aprobados y prohíbe reescribirlos.',
        }
      : null;
  const paymentDateBlockers = [
    paymentDateBlocker,
    paymentDateConflictBlocker,
  ].filter(
    (blocker): blocker is PilaExportReadinessBlocker => blocker !== null,
  );
  const pensionRulesCutoverAffectsPeriod =
    input.period.fechaInicio.toISOString().slice(0, 10) >=
      pensionSystemEffectiveDate ||
    input.period.fechaFin.toISOString().slice(0, 10) >=
      pensionSystemEffectiveDate ||
    paymentDates.some(
      (paymentDate) =>
        paymentDate !== null && paymentDate >= pensionSystemEffectiveDate,
    );
  const pensionRulesBlocker: PilaExportReadinessBlocker | null =
    pensionRulesCutoverAffectsPeriod
      ? {
          code: 'PILA_PENSION_RULESET_AFTER_2027_NOT_RECONCILED',
          scope: 'FILE_GENERATION',
          title:
            'Falta reconciliar las reglas pensionales vigentes desde abril de 2027',
          message:
            'El período o su fecha prevista de pago alcanza la entrada en vigor del nuevo sistema pensional. AT2 v30 contiene reglas de distribución entre componentes, pero el producto aún no versiona ni valida ese cálculo. No se debe presentar el preflight como completo para los campos 46 y 47.',
          fields: [{ record: 'DETALLE_TIPO_2', fieldNumbers: [46, 47] }],
          evidence:
            'Sentencia C-264/2026: las disposiciones exequibles que conforman el nuevo sistema entran en vigor el 2027-04-01; AT2 v30, pp. 147–154. La matriz vigente mantiene este mapeo pendiente.',
        }
      : null;
  const headerCandidate = mapPilaAt2V30HeaderCandidate({
    expectedTenantId: input.tenantId ?? null,
    period: input.period,
    snapshots: input.snapshots,
  });
  const employerCandidate = mapPilaAt2V30EmployerAggregateCandidate({
    expectedTenantId: input.tenantId ?? null,
    period: input.period,
    snapshots: input.snapshots,
  });
  const headerCcfIbcField =
    PILA_AT2_V30_RECORD_LAYOUTS.payrollHeaderType2.fields[19];
  const headerCcfIbcBlocker: PilaExportReadinessBlocker | null =
    headerCandidate.unresolvedFields.some(
      ({ fieldNumber, code }) =>
        fieldNumber === 20 &&
        code === 'AT2_HEADER_CCF_IBC_TOTAL_SUPERA_LONGITUD',
    )
      ? {
          code: 'AT2_HEADER_CCF_IBC_TOTAL_SUPERA_LONGITUD',
          scope: 'FILE_GENERATION',
          title: 'El IBC total de caja supera el campo 20 del encabezado',
          message:
            'La suma candidata de los IBC de caja de compensación del campo 45 supera las 12 posiciones numéricas del campo 20 AT2 v30. No se truncará ni se generará un total parcial.',
          fields: [
            {
              record: 'CABECERA_TIPO_2',
              fieldNumbers: [headerCcfIbcField.fieldNumber],
            },
          ],
          evidence:
            'AT2 v30, registro 01 del archivo tipo 2: campo 20 es N12 y suma el campo 45 de los detalles aplicables. El candidato solo usa snapshots PILA v2–v11 únicos del mismo tenant/período y afiliación dependiente estándar vigente.',
        }
      : null;
  const readinessBlockers = [
    ...pilaExportReadiness.blockers,
    ...paymentDateBlockers,
    ...(pensionRulesBlocker ? [pensionRulesBlocker] : []),
    ...(headerCcfIbcBlocker ? [headerCcfIbcBlocker] : []),
  ];
  const exportReadiness =
    readinessBlockers.length > pilaExportReadiness.blockers.length
      ? {
          ...pilaExportReadiness,
          blockers: readinessBlockers,
        }
      : pilaExportReadiness;
  const totalCotizantes = new Set(
    input.snapshots.map(({ employeeId }) => employeeId),
  ).size;
  const pensionTransitionSummary = summarizePensionTransitionStatus(
    input.snapshots,
    { tenantId: input.tenantId, period: input.period },
  );
  const detailScope = {
    expectedTenantId: input.tenantId ?? null,
    planillaType:
      typeof headerCandidate.values[8]?.value === 'string'
        ? headerCandidate.values[8].value
        : null,
    period: input.period,
  };
  const detailCandidatesBySnapshot = new Map(
    input.snapshots.map((snapshot) => [
      snapshot,
      mapPilaAt2V30DetailCandidate(snapshot, detailScope),
    ]),
  );
  const detailSequence = sequencePilaAt2V30DetailCandidates(
    input.snapshots.map(
      (snapshot) => detailCandidatesBySnapshot.get(snapshot)!,
    ),
    input.expectedEmployeeIds ?? null,
  );
  const detailSequenceByEmployeeId = new Map(
    detailSequence.assignments.map(({ employeeId, sequence }) => [
      employeeId,
      sequence,
    ]),
  );
  for (const snapshot of input.snapshots) {
    const candidate = detailCandidatesBySnapshot.get(snapshot);
    if (!candidate) continue;
    const sequence = detailSequenceByEmployeeId.get(snapshot.employeeId);
    if (detailSequence.status === 'CANDIDATE' && sequence !== undefined) {
      candidate.values[2] = { value: sequence };
      candidate.normativeRuleVersions.detailRecordSequence =
        PILA_AT2_V30_DETAIL_RECORD_SEQUENCE_RULE_VERSION;
      candidate.unresolvedFields = candidate.unresolvedFields.filter(
        ({ fieldNumber }) => fieldNumber !== 2,
      );
    } else {
      candidate.normativeRuleVersions.detailRecordSequence = null;
      const pendingReason =
        detailSequence.status === 'PENDING'
          ? detailSequence.pendingReason
          : 'La secuencia del empleado no se pudo resolver dentro del conjunto completo.';
      candidate.unresolvedFields = candidate.unresolvedFields.map((field) =>
        field.fieldNumber === 2 ? { ...field, reason: pendingReason } : field,
      );
    }
  }
  const assessments = input.snapshots.map((snapshot) => {
    const assessment = inspectPilaSnapshotPreparation({
      ...snapshot,
      totalCotizantes,
    });
    return detailCandidatesBySnapshot.get(snapshot)?.scopeMismatch
      ? { ...assessment, employeeName: 'Empleado con alcance no validado' }
      : assessment;
  });
  const detailContributionCandidates = summarizePilaDetailFieldCandidates(
    input.snapshots,
    assessments,
    [
      46,
      47,
      ...PILA_AT2_V30_PENSION_CONTRIBUTION_FIELD_NUMBERS,
      54,
      55,
      61,
      63,
      64,
      65,
      66,
      67,
      68,
      69,
    ],
    detailCandidatesBySnapshot,
  );
  const detailSourceFieldCandidates = summarizePilaDetailFieldCandidates(
    input.snapshots,
    assessments,
    [40, 41, 42, 43, 44, 45, 95],
    detailCandidatesBySnapshot,
    {
      40: 'Salario básico congelado en el snapshot aprobado de nómina.',
      41: 'Tipo salarial explícito y congelado en el snapshot aprobado.',
      42: 'IBC de pensión con fuente única en el snapshot aprobado.',
      43: 'IBC de salud con fuente única en el snapshot aprobado.',
      44: 'IBC de riesgos laborales con fuente única en el snapshot aprobado.',
      45: 'IBC de caja de compensación con fuente única en el snapshot aprobado.',
      95: 'Base de otros parafiscales congelada; se muestra la regla por empleado.',
    },
  );
  const detailSequenceCandidates = summarizePilaDetailFieldCandidates(
    input.snapshots,
    assessments,
    [2],
    detailCandidatesBySnapshot,
  );
  const detailNoEventFieldCandidates = summarizePilaDetailFieldCandidates(
    input.snapshots,
    assessments,
    [57, 58, 59, 60],
    detailCandidatesBySnapshot,
  );
  const detailAbsentEventCandidates = summarizePilaDetailFieldCandidates(
    input.snapshots,
    assessments,
    PILA_AT2_V30_NO_EVENT_NOVELTY_FIELD_NUMBERS,
    detailCandidatesBySnapshot,
  );
  const detailStandardDependentEmptyCandidates =
    summarizePilaDetailFieldCandidates(
      input.snapshots,
      assessments,
      PILA_AT2_V30_STANDARD_DEPENDENT_EMPTY_FIELD_NUMBERS,
      detailCandidatesBySnapshot,
    );
  const detailNonExemptCotizanteCandidates = summarizePilaDetailFieldCandidates(
    input.snapshots,
    assessments,
    PILA_AT2_V30_CONFIRMED_NON_EXEMPT_COTIZANTE_FIELD_NUMBERS,
    detailCandidatesBySnapshot,
  );
  const detailPrivateEmployerEsapMenCandidates =
    summarizePilaDetailFieldCandidates(
      input.snapshots,
      assessments,
      PILA_AT2_V30_PRIVATE_EMPLOYER_ESAP_MEN_FIELD_NUMBERS,
      detailCandidatesBySnapshot,
    );
  const grouped = new Map<
    string,
    PilaPreparationIssue & {
      affectedEmployees: PilaPreparationAffectedEmployee[];
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
          current.affectedEmployees.push({
            id: assessment.employeeId,
            name: assessment.employeeName,
          });
        }
      } else {
        grouped.set(key, {
          ...issue,
          affectedEmployees: [
            { id: assessment.employeeId, name: assessment.employeeName },
          ],
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
  const expectedIds = input.expectedEmployeeIds
    ? new Set(input.expectedEmployeeIds)
    : null;
  const snapshotIds = new Set(
    input.snapshots.map(({ employeeId }) => employeeId),
  );
  const completeSnapshotSet =
    expectedIds === null ||
    (expectedIds.size === input.expectedEmployeeIds?.length &&
      expectedIds.size === input.snapshots.length &&
      snapshotIds.size === input.snapshots.length &&
      [...expectedIds].every((employeeId) => snapshotIds.has(employeeId)));
  const hasFileGenerationBlocker = readinessBlockers.some(
    ({ scope }) => scope === 'FILE_GENERATION',
  );
  const archivoGenerable =
    issues.length === 0 &&
    !hasFileGenerationBlocker &&
    detailSequence.status === 'CANDIDATE' &&
    completeSnapshotSet;

  return {
    formatVersion: null,
    normativeSourceStatus: 'RECONCILIATION_PENDING' as const,
    exportReadiness,
    period: {
      id: input.period.id,
      fechaInicio: input.period.fechaInicio.toISOString().slice(0, 10),
      fechaFin: input.period.fechaFin.toISOString().slice(0, 10),
      fechaPrevistaPagoPila: snapshotPaymentDateValue,
    },
    snapshotsRevisados: assessments.length,
    pensionTransitionSummary,
    empleadosConDatosPendientes: employeesWithIssues,
    empleadosSinBrechasDetectadas: assessments.length - employeesWithIssues,
    detailRecordSequence: {
      status: detailSequence.status,
      candidateRecords: detailSequence.assignments.length,
      ruleVersion: detailSequence.ruleVersion,
      pendingReason: detailSequence.pendingReason,
    },
    detailSequenceCandidates,
    detailContributionCandidates,
    detailSourceFieldCandidates,
    detailNoEventFieldCandidates,
    detailAbsentEventCandidates,
    detailStandardDependentEmptyCandidates,
    detailNonExemptCotizanteCandidates,
    detailPrivateEmployerEsapMenCandidates,
    employerCandidate,
    headerCandidate,
    issues,
    archivoGenerable,
    estadoArchivo: archivoGenerable ? 'LISTO_PARA_GENERAR' : 'BLOQUEADO',
    mensaje: archivoGenerable
      ? 'Los snapshots no tienen brechas detectadas por las reglas locales. Se puede generar una copia de archivos tipo 1 y tipo 2 para este período; la validación local de estructura no confirma aceptación, liquidación ni pago por un operador.'
      : 'La generación está bloqueada hasta resolver las brechas de snapshots, las reglas de período o la composición local. No se generó ningún archivo.',
  };
}
