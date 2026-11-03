import {
  PILA_AT2_V30_FORMAT_VERSION,
  PILA_AT2_V30_RECORD_LAYOUTS,
  type PilaAt2V30FieldInput,
} from './pila-at2-v30-record-serializer';
import {
  PILA_RISK_ACTIVITY_CATALOG_VERSION,
  PILA_RISK_ACTIVITY_CODES,
} from './pila-risk-activity-catalog';
import {
  getPilaArlInitialRate,
  PILA_ARL_INITIAL_RATE_RULE_VERSION,
} from './pila-arl-initial-rate-catalog';
import {
  getPilaContributionFactorRatio,
  getPilaContributionRoundingRuleVersion,
  isPilaContributionAmountRoundedUpToHundred,
  PILA_CONTRIBUTION_ROUNDING_RULE_VERSION,
} from './pila-contribution-rounding';
import {
  getPilaCcfStandardRate,
  PILA_CCF_STANDARD_RATE_RULE_VERSION,
} from './pila-ccf-standard-rate-catalog';
import {
  getPilaIcbfStandardRate,
  getPilaSenaStandardRate,
  PILA_ICBF_STANDARD_RATE_RULE_VERSION,
  PILA_SENA_STANDARD_RATE_RULE_VERSION,
} from './pila-parafiscal-rate-catalog';
import {
  getPilaPensionStandardRate,
  PILA_NEW_PENSION_SYSTEM_EFFECTIVE_FROM,
  PILA_PENSION_STANDARD_RATE_RULE_VERSION,
} from './pila-pension-standard-rate-catalog';
import {
  getPilaHealthStandardRate,
  PILA_HEALTH_STANDARD_RATE_RULE_VERSION,
} from './pila-health-standard-rate-catalog';
import { isColombiaDaneDepartmentCode } from '@saas/types';
import type { PilaSnapshotPreparationInput } from './pila-preparation';

type JsonRecord = Record<string, unknown>;

const PILA_AT2_V30_NO_BENEFIT_EVENT_FIELDS_RULE_VERSION =
  'AT2_V30_NO_IGE_LMA_FIXED_FIELDS_V1' as const;
const PILA_AT2_V30_NO_EVENT_NOVELTY_FIELDS_RULE_VERSION =
  'AT2_V30_NO_EVENT_NOVELTY_FIELDS_V1' as const;
const PILA_AT2_V30_PLANILLA_E_FIELD_22_RULE_VERSION =
  'AT2_V30_PLANILLA_E_FIELD_22_BLANK_V1' as const;
const PILA_AT2_V30_VOLUNTARY_PENSION_CUTOFF_RULE_VERSION =
  'AT2_V30_VOLUNTARY_PENSION_PRE_JUL_2025_CUTOFF_V1' as const;
const PILA_AT2_V30_VOLUNTARY_PENSION_CUTOFF = '2025-07-01';
const PILA_AT2_V30_PENSION_TOTAL_FIELD_50_RULE_VERSION =
  'AT2_V30_PENSION_TOTAL_FIELD_50_SUM_47_49_V1' as const;
const PILA_AT2_V30_NO_TRANSFER_DESTINATION_FIELDS_RULE_VERSION =
  'AT2_V30_NO_TRANSFER_DESTINATION_FIELDS_V1' as const;
const PILA_AT2_V30_NON_COTIZANTE40_PRINCIPAL_FIELDS_RULE_VERSION =
  'AT2_V30_NON_COTIZANTE40_PRINCIPAL_FIELDS_V1' as const;
const PILA_AT2_V30_CONFIRMED_NON_EXEMPT_COTIZANTE_RULE_VERSION =
  'AT2_V30_CONFIRMED_NON_EXEMPT_COTIZANTE_V1' as const;
const PILA_AT2_V30_PRIVATE_EMPLOYER_NO_ESAP_MEN_RULE_VERSION =
  'AT2_V30_PRIVATE_EMPLOYER_NO_ESAP_MEN_V1' as const;

export const PILA_AT2_V30_STANDARD_DEPENDENT_EMPTY_FIELD_NUMBERS = [
  32, 34, 56, 74, 75,
] as const;
export const PILA_AT2_V30_CONFIRMED_NON_EXEMPT_COTIZANTE_FIELD_NUMBERS = [
  76,
] as const;
export const PILA_AT2_V30_PRIVATE_EMPLOYER_ESAP_MEN_FIELD_NUMBERS = [
  70, 71, 72, 73,
] as const;
export const PILA_AT2_V30_PENSION_CONTRIBUTION_FIELD_NUMBERS = [
  48, 49, 50, 51, 52, 53,
] as const;
export const PILA_AT2_V30_NO_EVENT_NOVELTY_FIELD_NUMBERS = [
  15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 80, 81, 82,
  83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94,
] as const;

const PILA_AT2_V30_NO_EVENT_NOVELTY_CANDIDATE_FIELDS = [
  15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 29, 30, 80, 81, 82, 83, 84,
  85, 86, 87, 88, 89, 90, 91, 92, 93, 94,
] as const;

export interface PilaAt2V30DetailCandidate {
  formatVersion: typeof PILA_AT2_V30_FORMAT_VERSION;
  supportedSnapshot: boolean;
  scopeMismatch: boolean;
  employeeId: string;
  tenantId: string | null;
  payrollPeriodId: string | null;
  normativeRuleVersions: {
    planillaEField22:
      | typeof PILA_AT2_V30_PLANILLA_E_FIELD_22_RULE_VERSION
      | null;
    pensionTotalField50:
      | typeof PILA_AT2_V30_PENSION_TOTAL_FIELD_50_RULE_VERSION
      | null;
    voluntaryPensionCutoff:
      | typeof PILA_AT2_V30_VOLUNTARY_PENSION_CUTOFF_RULE_VERSION
      | null;
    arlInitialRate: typeof PILA_ARL_INITIAL_RATE_RULE_VERSION | null;
    contributionRounding: typeof PILA_CONTRIBUTION_ROUNDING_RULE_VERSION | null;
    ccfRate: typeof PILA_CCF_STANDARD_RATE_RULE_VERSION | null;
    senaRate: typeof PILA_SENA_STANDARD_RATE_RULE_VERSION | null;
    icbfRate: typeof PILA_ICBF_STANDARD_RATE_RULE_VERSION | null;
    pensionRate: typeof PILA_PENSION_STANDARD_RATE_RULE_VERSION | null;
    healthRate: typeof PILA_HEALTH_STANDARD_RATE_RULE_VERSION | null;
    noBenefitEventFields:
      | typeof PILA_AT2_V30_NO_BENEFIT_EVENT_FIELDS_RULE_VERSION
      | null;
    noEventNoveltyFields:
      | typeof PILA_AT2_V30_NO_EVENT_NOVELTY_FIELDS_RULE_VERSION
      | null;
    noTransferDestinationFields:
      | typeof PILA_AT2_V30_NO_TRANSFER_DESTINATION_FIELDS_RULE_VERSION
      | null;
    nonCotizante40PrincipalFields:
      | typeof PILA_AT2_V30_NON_COTIZANTE40_PRINCIPAL_FIELDS_RULE_VERSION
      | null;
    confirmedNonExemptCotizante:
      | typeof PILA_AT2_V30_CONFIRMED_NON_EXEMPT_COTIZANTE_RULE_VERSION
      | null;
    privateEmployerEsapMen:
      | typeof PILA_AT2_V30_PRIVATE_EMPLOYER_NO_ESAP_MEN_RULE_VERSION
      | null;
  };
  values: Partial<Record<number, PilaAt2V30FieldInput>>;
  unresolvedFields: Array<{ fieldNumber: number; reason: string }>;
}

export interface PilaAt2V30DetailScope {
  expectedTenantId: string | null;
  planillaType: string | null;
  period: {
    id: string;
    fechaInicio: Date;
    fechaFin: Date;
  };
}

function object(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function objectRows(value: unknown): JsonRecord[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.map(object);
  return rows.every((row): row is JsonRecord => row !== null) ? rows : null;
}

function sourceText(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  return value;
}

function calendarDate(value: unknown): string | null {
  const normalized = sourceText(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === normalized
    ? normalized
    : null;
}

function safeInteger(value: unknown, maxDigits: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    String(value).length <= maxDigits
  );
}

function hasNoBlockers(value: JsonRecord | null): boolean {
  return Array.isArray(value?.bloqueos) && value.bloqueos.length === 0;
}

function coversPeriod(
  startValue: unknown,
  endValue: unknown,
  periodStart: string,
  periodEnd: string,
): boolean {
  const start = calendarDate(startValue);
  if (!start || start > periodStart) return false;
  if (endValue === null) return true;
  const end = calendarDate(endValue);
  return end !== null && end >= periodEnd;
}

function fullCalendarMonth(start: string, end: string): boolean {
  const parsedStart = new Date(`${start}T00:00:00.000Z`);
  const parsedEnd = new Date(`${end}T00:00:00.000Z`);
  return (
    parsedStart.getUTCDate() === 1 &&
    parsedStart.getUTCFullYear() === parsedEnd.getUTCFullYear() &&
    parsedStart.getUTCMonth() === parsedEnd.getUTCMonth() &&
    parsedEnd.getUTCDate() ===
      new Date(
        Date.UTC(parsedEnd.getUTCFullYear(), parsedEnd.getUTCMonth() + 1, 0),
      ).getUTCDate()
  );
}

/**
 * Maps candidate AT2 v30 type 2 detail sources from one frozen PILA snapshot.
 * It is deliberately partial: the initial ARL rate is only a versioned
 * candidate, remaining contribution rules and novelty segments are unresolved,
 * and this function never validates or serializes a record.
 */
export function mapPilaAt2V30DetailCandidate(
  snapshot: PilaSnapshotPreparationInput,
  scope: PilaAt2V30DetailScope,
): PilaAt2V30DetailCandidate {
  const values: Partial<Record<number, PilaAt2V30FieldInput>> = {};
  const reasons = new Map<number, string>();
  const put = (fieldNumber: number, value: string | number) => {
    values[fieldNumber] = { value };
    reasons.delete(fieldNumber);
  };
  const blank = (fieldNumber: number) => {
    values[fieldNumber] = { value: null, emptyAs: 'spaces' };
    reasons.delete(fieldNumber);
  };
  const unresolved = (fieldNumber: number, reason: string) => {
    reasons.set(fieldNumber, reason);
  };
  const putText = (fieldNumber: number, value: unknown, label: string) => {
    const normalized = sourceText(value);
    if (normalized === null) {
      unresolved(fieldNumber, `Falta ${label} congelado en el snapshot.`);
    } else {
      put(fieldNumber, normalized);
    }
  };
  const putBooleanFlag = (
    fieldNumber: number,
    value: unknown,
    missingReason: string,
  ) => {
    if (value === true) {
      put(fieldNumber, 'X');
    } else if (value === false) {
      blank(fieldNumber);
    } else {
      unresolved(fieldNumber, missingReason);
    }
  };

  const root = object(snapshot.payload);
  const employee = object(root?.employee);
  const employer = object(root?.employer);
  const period = object(root?.period);
  const contract = object(root?.contract);
  const payroll = object(root?.payroll);
  const employerPila = object(employer?.pila);
  const affiliations = objectRows(root?.affiliations);
  const periodStart = calendarDate(period?.fechaInicio);
  const periodEnd = calendarDate(period?.fechaFin);
  const tenantId = sourceText(employer?.tenantId);
  const payrollPeriodId = sourceText(period?.payrollPeriodId);
  const employeeSnapshotId = sourceText(employee?.employeeId);
  const expectedTenantId = sourceText(scope.expectedTenantId);
  const expectedStart = Number.isNaN(scope.period.fechaInicio.getTime())
    ? null
    : scope.period.fechaInicio.toISOString().slice(0, 10);
  const expectedEnd = Number.isNaN(scope.period.fechaFin.getTime())
    ? null
    : scope.period.fechaFin.toISOString().slice(0, 10);
  const matchesApprovedScope =
    expectedTenantId !== null &&
    expectedStart !== null &&
    expectedEnd !== null &&
    tenantId === expectedTenantId &&
    payrollPeriodId === scope.period.id &&
    periodStart === expectedStart &&
    periodEnd === expectedEnd;
  const scopeMismatch =
    (expectedTenantId !== null &&
      tenantId !== null &&
      tenantId !== expectedTenantId) ||
    (payrollPeriodId !== null && payrollPeriodId !== scope.period.id) ||
    (expectedStart !== null &&
      sourceText(period?.fechaInicio) !== null &&
      sourceText(period?.fechaInicio) !== expectedStart) ||
    (expectedEnd !== null &&
      sourceText(period?.fechaFin) !== null &&
      sourceText(period?.fechaFin) !== expectedEnd) ||
    (employeeSnapshotId !== null && employeeSnapshotId !== snapshot.employeeId);
  const supportedSnapshot =
    (snapshot.payloadVersion === 2 ||
      snapshot.payloadVersion === 3 ||
      snapshot.payloadVersion === 4) &&
    root?.schemaVersion === snapshot.payloadVersion &&
    employee !== null &&
    employer !== null &&
    employerPila !== null &&
    period !== null &&
    tenantId !== null &&
    payrollPeriodId !== null &&
    periodStart !== null &&
    periodEnd !== null &&
    matchesApprovedScope &&
    employeeSnapshotId === snapshot.employeeId;

  if (!supportedSnapshot || !periodStart || !periodEnd) {
    const reason = scopeMismatch
      ? 'El tenant, empleado o período congelado en el snapshot no coincide con el contexto autenticado solicitado.'
      : 'Se requiere un snapshot PILA v2, v3 o v4 válido y atribuible a un tenant y período.';
    for (const field of PILA_AT2_V30_RECORD_LAYOUTS.contributorDetailType2
      .fields) {
      unresolved(field.fieldNumber, reason);
    }
    return {
      formatVersion: PILA_AT2_V30_FORMAT_VERSION,
      supportedSnapshot: false,
      scopeMismatch,
      employeeId: snapshot.employeeId,
      tenantId: matchesApprovedScope ? expectedTenantId : null,
      payrollPeriodId: matchesApprovedScope ? scope.period.id : null,
      normativeRuleVersions: {
        planillaEField22: null,
        pensionTotalField50: null,
        voluntaryPensionCutoff: null,
        arlInitialRate: null,
        contributionRounding: null,
        ccfRate: null,
        senaRate: null,
        icbfRate: null,
        pensionRate: null,
        healthRate: null,
        noBenefitEventFields: null,
        noEventNoveltyFields: null,
        noTransferDestinationFields: null,
        nonCotizante40PrincipalFields: null,
        confirmedNonExemptCotizante: null,
        privateEmployerEsapMen: null,
      },
      values,
      unresolvedFields: [...reasons].map(([fieldNumber, reason]) => ({
        fieldNumber,
        reason,
      })),
    };
  }

  const fullMonth = fullCalendarMonth(periodStart, periodEnd);
  const affiliation = affiliations?.length === 1 ? affiliations[0] : null;
  const affiliationCoversPeriod = Boolean(
    affiliation &&
    coversPeriod(
      affiliation.vigenteDesde,
      affiliation.vigenteHasta,
      periodStart,
      periodEnd,
    ),
  );
  const standardAffiliation =
    affiliationCoversPeriod &&
    sourceText(affiliation?.tipoCotizanteCodigo) === '01' &&
    sourceText(affiliation?.subtipoCotizanteCodigo) === '00';
  const standardPrivateEmployer =
    standardAffiliation &&
    sourceText(employerPila.tipoAportante) === '1' &&
    sourceText(employerPila.naturalezaJuridica) === '2';
  const employeeCoversPeriod = coversPeriod(
    employee?.fechaIngreso,
    employee?.fechaRetiro,
    periodStart,
    periodEnd,
  );
  const contractCoversPeriod = coversPeriod(
    contract?.fechaInicio,
    contract?.fechaFin,
    periodStart,
    periodEnd,
  );
  const standardFullMonthEmployee =
    standardAffiliation &&
    fullMonth &&
    employeeCoversPeriod &&
    contractCoversPeriod;

  if (standardFullMonthEmployee) {
    put(1, '02');
    // One detail line per standard employee is the current MVP scope.
    put(2, '1');
  } else {
    unresolved(
      1,
      'El detalle solo está definido para un dependiente estándar 01/00 con empleado, contrato y afiliación que cubren el mes completo.',
    );
    unresolved(
      2,
      'La secuencia solo está definida para una línea mensual estándar por empleado.',
    );
  }

  putText(3, employee?.tipoDocumento, 'el tipo de documento del cotizante');
  putText(4, employee?.cedula, 'la identificación del cotizante');
  const workLocations = objectRows(root?.pilaWorkLocations);
  const workLocation = workLocations?.length === 1 ? workLocations[0] : null;
  if ((snapshot.payloadVersion ?? 0) < 3) {
    unresolved(
      9,
      'El snapshot histórico no contiene una ubicación laboral PILA explícita; no se completa desde la sede ni desde datos actuales.',
    );
    unresolved(
      10,
      'El snapshot histórico no contiene una ubicación laboral PILA explícita; no se completa desde la sede ni desde datos actuales.',
    );
  } else if (!workLocation) {
    const reason =
      workLocations === null
        ? 'El snapshot v3/v4 no conserva una lista válida de ubicaciones laborales PILA.'
        : workLocations.length === 0
          ? 'Falta una ubicación laboral PILA confirmada que cubra el período.'
          : 'Hay varias ubicaciones laborales PILA durante el período; la segmentación no está habilitada.';
    unresolved(9, reason);
    unresolved(10, reason);
  } else if (
    workLocation.tenantId !== tenantId ||
    workLocation.municipioId !== object(workLocation.municipio)?.id ||
    !coversPeriod(
      workLocation.vigenteDesde,
      workLocation.vigenteHasta,
      periodStart,
      periodEnd,
    )
  ) {
    const reason =
      'La ubicación laboral PILA congelada no tiene tenant, municipio o vigencia completos para el período.';
    unresolved(9, reason);
    unresolved(10, reason);
  } else if (!standardAffiliation) {
    const reason =
      'Falta una afiliación CCF única y vigente durante todo el período para validar los campos 9 y 10.';
    unresolved(9, reason);
    unresolved(10, reason);
  } else {
    const municipalityCode = sourceText(object(workLocation.municipio)?.codigo);
    const ccfDepartmentCode = sourceText(
      affiliation?.cajaCompensacionDepartamentoCodigo,
    );
    if (!municipalityCode || !/^\d{5}$/.test(municipalityCode)) {
      const reason =
        'El municipio laboral congelado no tiene un código DIVIPOLA de cinco dígitos válido.';
      unresolved(9, reason);
      unresolved(10, reason);
    } else if (!isColombiaDaneDepartmentCode(municipalityCode.slice(0, 2))) {
      const reason =
        'El departamento del municipio laboral no pertenece al catálogo DIVIPOLA utilizado por PILA.';
      unresolved(9, reason);
      unresolved(10, reason);
    } else if (!isColombiaDaneDepartmentCode(ccfDepartmentCode)) {
      const reason =
        'La afiliación CCF congelada no conserva un departamento DIVIPOLA válido tomado de su constancia.';
      unresolved(9, reason);
      unresolved(10, reason);
    } else if (ccfDepartmentCode !== municipalityCode.slice(0, 2)) {
      const reason =
        'El departamento de la ubicación laboral no coincide con el departamento de la CCF afiliada, como exige AT2 v30.';
      unresolved(9, reason);
      unresolved(10, reason);
    } else {
      put(9, ccfDepartmentCode);
      put(10, municipalityCode.slice(2));
    }
  }
  if (standardAffiliation) {
    const documentType = sourceText(employee?.tipoDocumento);
    if (documentType === 'CC' || documentType === 'TI') {
      // AT2 v30 only allows the foreign pension exemption flag for foreign IDs.
      if (affiliation?.extranjeroNoObligadoPension == null) {
        blank(7);
      } else {
        unresolved(
          7,
          'La afiliación contiene una declaración de exención extranjera incompatible con CC/TI.',
        );
      }
      putBooleanFlag(
        8,
        affiliation?.colombianoEnElExterior,
        'Falta confirmar si el cotizante CC/TI es colombiano en el exterior.',
      );
    } else if (documentType === 'CE' || documentType === 'PA') {
      putBooleanFlag(
        7,
        affiliation?.extranjeroNoObligadoPension,
        'Falta confirmar si el cotizante extranjero está exento de pensión.',
      );
      // AT2 v30 only allows the abroad flag for Colombian CC/TI documents.
      if (affiliation?.colombianoEnElExterior == null) {
        blank(8);
      } else {
        unresolved(
          8,
          'La afiliación contiene una declaración de residencia exterior incompatible con CE/PA.',
        );
      }
    } else {
      const reason =
        documentType === 'PC'
          ? 'El producto aún no tiene reglas aprobadas para mapear PEP-TUTOR (PC) a los campos 7 y 8; ambos quedan pendientes.'
          : 'Falta un tipo de documento soportado para los campos 7 y 8.';
      unresolved(7, reason);
      unresolved(8, reason);
    }
  } else {
    unresolved(
      7,
      'Falta una afiliación dependiente 01/00 que cubra el período.',
    );
    unresolved(
      8,
      'Falta una afiliación dependiente 01/00 que cubra el período.',
    );
  }

  if (standardAffiliation) {
    putText(5, affiliation?.tipoCotizanteCodigo, 'el tipo de cotizante');
    putText(6, affiliation?.subtipoCotizanteCodigo, 'el subtipo del cotizante');
    putText(31, affiliation?.fondoPensionCodigo, 'el fondo de pensión');
    blank(32);
    putText(33, affiliation?.epsCodigo, 'la EPS');
    blank(34);
    putText(35, affiliation?.cajaCompensacionCodigo, 'la caja de compensación');
    putText(77, affiliation?.arlCodigo, 'la ARL del cotizante');
    putText(78, affiliation?.arlClaseRiesgo, 'la clase de riesgo afiliada');
    blank(74);
    blank(75);
    if (
      employer.aportesExonerados === false &&
      employerPila.aportesExoneradosConfirmado === false
    ) {
      put(76, 'N');
    } else if (
      employer.aportesExonerados === true &&
      employerPila.aportesExoneradosConfirmado === true
    ) {
      unresolved(
        76,
        'La exoneración positiva requiere validar la elegibilidad individual antes de proponer el campo.',
      );
    } else {
      unresolved(
        76,
        'Falta una confirmación explícita y coherente de no exoneración en el empleador congelado.',
      );
    }
  } else {
    for (const fieldNumber of [5, 6, 31, 32, 33, 34, 35, 74, 75, 76, 77, 78]) {
      unresolved(
        fieldNumber,
        'Falta una única afiliación dependiente 01/00 que cubra el período.',
      );
    }
  }

  putText(11, employee?.primerApellido, 'el primer apellido');
  if (sourceText(employee?.segundoApellido) === null) {
    blank(12);
  } else {
    putText(12, employee?.segundoApellido, 'el segundo apellido');
  }
  putText(13, employee?.primerNombre, 'el primer nombre');
  if (sourceText(employee?.segundoNombre) === null) {
    blank(14);
  } else {
    putText(14, employee?.segundoNombre, 'el segundo nombre');
  }

  const days = object(payroll?.diasCotizadosPorSubsistema);
  const daySources = [
    [36, 'pension'],
    [37, 'salud'],
    [38, 'riesgos'],
    [39, 'cajaCompensacion'],
  ] as const;
  for (const [fieldNumber, subsystem] of daySources) {
    const source = object(days?.[subsystem]);
    if (
      standardFullMonthEmployee &&
      source?.valor === 30 &&
      source.reglaVersion === 'PILA_FULL_MONTH_DAYS_V1' &&
      hasNoBlockers(source)
    ) {
      put(fieldNumber, 30);
    } else {
      unresolved(
        fieldNumber,
        `Faltan días aprobados y sin bloqueos para ${subsystem}.`,
      );
    }
  }
  const fullMonthPilaInputsApproved =
    standardFullMonthEmployee &&
    daySources.every(([, subsystem]) => {
      const source = object(days?.[subsystem]);
      return (
        source?.valor === 30 &&
        source.reglaVersion === 'PILA_FULL_MONTH_DAYS_V1' &&
        hasNoBlockers(source)
      );
    }) &&
    Array.isArray(root?.pilaEvents) &&
    root.pilaEvents.length === 0 &&
    Array.isArray(payroll?.pilaEvents) &&
    payroll.pilaEvents.length === 0 &&
    Array.isArray(payroll?.novelties) &&
    payroll.novelties.length === 0;

  if (fullMonthPilaInputsApproved) {
    blank(57);
    put(58, 0);
    blank(59);
    put(60, 0);
  } else {
    const reason =
      'Los campos 57–60 solo tienen valores fijos en snapshots completos sin novedades ni eventos PILA; la incapacidad o licencia requiere datos aprobados por separado.';
    for (const fieldNumber of [57, 58, 59, 60]) {
      unresolved(fieldNumber, reason);
    }
  }

  if (fullMonthPilaInputsApproved) {
    for (const fieldNumber of [
      15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 29,
    ]) {
      blank(fieldNumber);
    }
    put(30, 0);
    for (let fieldNumber = 80; fieldNumber <= 94; fieldNumber += 1) {
      blank(fieldNumber);
    }
  } else {
    const reason =
      'Este campo solo se propone vacío/cero para un dependiente 01/00 con cobertura completa, días aprobados y listas presentes sin eventos PILA ni novedades Payroll.';
    for (const fieldNumber of PILA_AT2_V30_NO_EVENT_NOVELTY_CANDIDATE_FIELDS) {
      unresolved(fieldNumber, reason);
    }
  }
  if (scope.planillaType === 'E') {
    blank(22);
  } else {
    unresolved(
      22,
      'Solo se admite planilla E en el MVP; el tipo N de correcciones no se genera.',
    );
  }
  const salary = object(payroll?.salarioBasicoCampo40);
  if (
    safeInteger(salary?.valor, 9) &&
    Array.isArray(salary?.bloqueos) &&
    salary.bloqueos.length === 0
  ) {
    put(40, salary.valor);
  } else {
    unresolved(
      40,
      'Falta un salario básico entero y aprobado para el campo 40.',
    );
  }

  if (
    (payroll?.tipoSalario === 'X' ||
      payroll?.tipoSalario === 'F' ||
      payroll?.tipoSalario === 'V') &&
    Array.isArray(payroll.tipoSalarioBloqueos) &&
    payroll.tipoSalarioBloqueos.length === 0
  ) {
    put(41, payroll.tipoSalario);
  } else {
    unresolved(41, 'Falta el tipo de salario explícito y sin bloqueos.');
  }

  const subsystemBases = object(payroll?.ibcPorSubsistema);
  const baseSources = [
    [42, 'pension'],
    [43, 'salud'],
    [44, 'riesgos'],
    [45, 'cajaCompensacion'],
  ] as const;
  for (const [fieldNumber, subsystem] of baseSources) {
    const source = object(subsystemBases?.[subsystem]);
    if (source?.sourceCount === 1 && safeInteger(source.valor, 9)) {
      put(fieldNumber, source.valor);
    } else {
      unresolved(
        fieldNumber,
        `Falta una fuente única y válida de IBC para ${subsystem}.`,
      );
    }
  }

  const riskAssignments = objectRows(root?.pilaRiskAssignments);
  const riskAssignment =
    riskAssignments?.length === 1 ? riskAssignments[0] : null;
  const workCenter = object(riskAssignment?.centroTrabajo);
  const riskActivity = sourceText(riskAssignment?.codigoActividadEconomica);
  const workCenterCode = sourceText(workCenter?.codigoCentro);
  const arlCode = sourceText(affiliation?.arlCodigo);
  const riskAssignmentValid = Boolean(
    standardAffiliation &&
    riskAssignment &&
    workCenter &&
    coversPeriod(
      riskAssignment.vigenteDesde,
      riskAssignment.vigenteHasta,
      periodStart,
      periodEnd,
    ) &&
    riskAssignment.tenantId === tenantId &&
    workCenter.tenantId === tenantId &&
    workCenter.arlCodigo === arlCode &&
    riskAssignment.formatoNormativoVersion ===
      PILA_RISK_ACTIVITY_CATALOG_VERSION &&
    riskActivity !== null &&
    PILA_RISK_ACTIVITY_CODES.has(riskActivity) &&
    riskActivity[0] === sourceText(affiliation?.arlClaseRiesgo),
  );
  const arlRateByClass = getPilaArlInitialRate(
    sourceText(affiliation?.arlClaseRiesgo),
    periodStart,
  );
  const ccfStandardRate = getPilaCcfStandardRate(periodStart);
  const senaStandardRate = getPilaSenaStandardRate(periodStart);
  const icbfStandardRate = getPilaIcbfStandardRate(periodStart);
  const pensionStandardRate = getPilaPensionStandardRate(
    periodStart,
    calendarDate(payroll?.fechaPrevistaPagoPila),
  );
  const healthStandardRate = getPilaHealthStandardRate(periodStart);
  const arlInitialRate = riskAssignmentValid ? arlRateByClass : null;
  if (
    riskAssignmentValid &&
    workCenterCode &&
    /^\d{1,9}$/.test(workCenterCode)
  ) {
    put(62, workCenterCode);
  } else {
    unresolved(
      62,
      'Falta una única asignación ARL tenant-safe vigente con código de centro numérico.',
    );
  }
  if (riskAssignmentValid && riskActivity) {
    put(98, riskActivity);
  } else {
    unresolved(
      98,
      'Falta una actividad económica ARL única y vigente del catálogo versionado.',
    );
  }

  const otherParafiscalBase = object(subsystemBases?.otrosParafiscales);
  if (
    otherParafiscalBase?.reglaVersion === 'CO_PARAFISCAL_BASE_V1' &&
    safeInteger(otherParafiscalBase.valor, 9) &&
    hasNoBlockers(otherParafiscalBase)
  ) {
    put(95, otherParafiscalBase.valor);
  } else {
    unresolved(
      95,
      'Falta una base parafiscal congelada con regla CO_PARAFISCAL_BASE_V1 y sin bloqueos.',
    );
  }
  if (standardPrivateEmployer) {
    put(70, '0.00000');
    put(72, '0.00000');
    if (Object.hasOwn(values, 95)) {
      put(71, 0);
      put(73, 0);
    } else {
      unresolved(
        71,
        'El valor ESAP requiere el IBC 95 congelado para validar el cálculo con tarifa cero.',
      );
      unresolved(
        73,
        'El valor MEN requiere el IBC 95 congelado para validar el cálculo con tarifa cero.',
      );
    }
  } else {
    const privateEmployerReason = standardAffiliation
      ? 'Los campos ESAP/MEN solo están mapeados aquí para el empleador privado tipo 1; los empleadores públicos y otros tipos están fuera del MVP.'
      : 'Falta una única afiliación dependiente 01/00 que cubra el período.';
    for (const fieldNumber of [70, 71, 72, 73]) {
      unresolved(fieldNumber, privateEmployerReason);
    }
  }

  const contributionConcepts = objectRows(payroll?.concepts);
  const getContributionAmountCandidate = (input: {
    fieldNumber: number;
    code: string;
    base: JsonRecord | null;
    expectedType?: string;
    requireExplicitNonExemption?: boolean;
    expectedFactor?: number | null;
    expectedFactorReason?: string;
    expectedFactorMismatchReason?: string;
  }): JsonRecord | null => {
    if (!fullMonthPilaInputsApproved) {
      unresolved(
        input.fieldNumber,
        'El importe candidato requiere un mes completo con días aprobados y sin novedades ni eventos PILA.',
      );
      return null;
    }
    if (input.expectedFactor === null) {
      unresolved(
        input.fieldNumber,
        input.expectedFactorReason ??
          'No hay una tarifa versionada aplicable al concepto y período congelados.',
      );
      return null;
    }
    if (input.requireExplicitNonExemption) {
      if (
        employer.aportesExonerados !== false ||
        employerPila.aportesExoneradosConfirmado !== false
      ) {
        unresolved(
          input.fieldNumber,
          'Se requiere declaración expresa y coherente de no exoneración en el empleador congelado.',
        );
        return null;
      }
    }
    const matches = contributionConcepts?.filter(
      (concept) => concept.codigo === input.code,
    );
    if (!matches || matches.length !== 1) {
      unresolved(
        input.fieldNumber,
        matches?.length
          ? `Hay más de una fuente ${input.code} en el snapshot.`
          : `Falta una fuente única ${input.code} en el snapshot.`,
      );
      return null;
    }
    const concept = matches[0];
    if (
      concept.tipo !== (input.expectedType ?? 'EMPLOYER_CONTRIBUTION') ||
      !safeInteger(concept.base, 9) ||
      typeof concept.factor !== 'number' ||
      !Number.isFinite(concept.factor) ||
      concept.factor <= 0 ||
      !safeInteger(concept.valor, 9) ||
      !input.base ||
      !safeInteger(input.base.valor, 9) ||
      concept.base !== input.base.valor
    ) {
      unresolved(
        input.fieldNumber,
        `La fuente ${input.code} no tiene tipo esperado, importe entero, factor positivo y base coincidente con la fuente congelada.`,
      );
      return null;
    }
    if (
      input.expectedFactor !== undefined &&
      concept.factor !== input.expectedFactor
    ) {
      unresolved(
        input.fieldNumber,
        input.expectedFactorMismatchReason ??
          'El factor del snapshot no coincide con la tarifa versionada para el período congelado.',
      );
      return null;
    }
    return concept;
  };

  const arlBase =
    object(subsystemBases?.riesgos)?.sourceCount === 1
      ? object(subsystemBases?.riesgos)
      : null;
  const arlConcept = getContributionAmountCandidate({
    fieldNumber: 63,
    code: 'ARL',
    base: arlBase,
    expectedFactor: arlInitialRate?.factor ?? null,
    expectedFactorReason:
      'No hay una tarifa ARL versionada aplicable a la clase de riesgo y al período congelados.',
    expectedFactorMismatchReason:
      'El factor ARL del snapshot no coincide con la tarifa inicial versionada para la clase de riesgo congelada.',
  });
  if (arlInitialRate && arlConcept) {
    put(61, arlInitialRate.fieldValue);
    if (
      getPilaContributionRoundingRuleVersion(periodStart) &&
      arlBase &&
      safeInteger(arlBase.valor, 9) &&
      isPilaContributionAmountRoundedUpToHundred(
        periodStart,
        arlBase.valor,
        arlInitialRate.factorNumerator,
        arlInitialRate.factorDenominator,
        arlConcept.valor as number,
      )
    ) {
      put(63, arlConcept.valor as number);
    } else {
      unresolved(
        63,
        'El importe ARL congelado no coincide con el redondeo PILA versionado al múltiplo de 100 superior; no se recalcula ni reemplaza.',
      );
    }
  } else if (!riskAssignmentValid) {
    unresolved(
      61,
      'Falta una asignación ARL válida, tenant-safe y vigente para el período completo.',
    );
  } else if (!arlInitialRate) {
    unresolved(
      61,
      'No hay una tarifa inicial versionada para la clase ARL y el período congelados.',
    );
  } else {
    unresolved(
      61,
      'Falta un concepto ARL único cuyo factor y base coincidan con la regla y el IBC congelados.',
    );
  }

  if (standardAffiliation) {
    blank(56);
  } else {
    unresolved(
      56,
      'AT2 v30 reserva el campo 56 para cotizantes tipo 40. El MVP solo admite 01/00; 40 y 69 quedan fuera de alcance.',
    );
  }
  const mapContributionAmountCandidate = (input: {
    fieldNumber: number;
    code: string;
    base: JsonRecord | null;
    expectedType?: string;
    requireExplicitNonExemption?: boolean;
    expectedFactor?: number | null;
    expectedFactorReason?: string;
    expectedFactorMismatchReason?: string;
  }) => {
    const concept = getContributionAmountCandidate(input);
    if (!concept) return;
    const factorRatio = getPilaContributionFactorRatio(concept.factor);
    if (
      !factorRatio ||
      !getPilaContributionRoundingRuleVersion(periodStart) ||
      !safeInteger(concept.base, 9) ||
      !isPilaContributionAmountRoundedUpToHundred(
        periodStart,
        concept.base,
        factorRatio.numerator,
        factorRatio.denominator,
        concept.valor as number,
      )
    ) {
      unresolved(
        input.fieldNumber,
        `El importe ${input.code} congelado no coincide con el redondeo PILA versionado al múltiplo de 100 superior; no se recalcula ni reemplaza.`,
      );
      return;
    }
    put(input.fieldNumber, concept.valor as number);
  };
  const pensionBase = object(subsystemBases?.pension);
  let pensionCandidateBlockReason: string | null = null;
  if (!standardFullMonthEmployee) {
    pensionCandidateBlockReason =
      'La tarifa pensional candidata solo está definida para dependiente 01/00 con empleado, contrato y afiliación que cubren el mes completo.';
  } else if (!fullMonthPilaInputsApproved) {
    pensionCandidateBlockReason =
      'El candidato pensional requiere un mes completo con días aprobados y sin novedades ni eventos PILA.';
  } else if (employerPila.tipoAportante !== '1') {
    pensionCandidateBlockReason =
      'El candidato pensional solo cubre aportantes empleadores tipo 1.';
  } else if (employerPila.naturalezaJuridica !== '2') {
    pensionCandidateBlockReason =
      'El candidato pensional solo cubre empleadores privados; las reglas de empleadores públicos requieren validación específica.';
  } else if (
    (employee?.tipoDocumento === 'CC' || employee?.tipoDocumento === 'TI') &&
    affiliation?.colombianoEnElExterior !== false
  ) {
    pensionCandidateBlockReason =
      'Debe confirmarse explícitamente que el cotizante CC/TI no se encuentra en el exterior para usar el candidato pensional.';
  } else if (
    (employee?.tipoDocumento === 'CC' || employee?.tipoDocumento === 'TI') &&
    affiliation?.extranjeroNoObligadoPension !== null &&
    affiliation?.extranjeroNoObligadoPension !== undefined
  ) {
    pensionCandidateBlockReason =
      'La declaración de exención extranjera es incompatible con el documento CC/TI.';
  } else if (
    (employee?.tipoDocumento === 'CE' || employee?.tipoDocumento === 'PA') &&
    affiliation?.extranjeroNoObligadoPension !== false
  ) {
    pensionCandidateBlockReason =
      'Debe confirmarse explícitamente que el cotizante CE/PA está obligado a cotizar a pensión para usar el candidato.';
  } else if (
    (employee?.tipoDocumento === 'CE' || employee?.tipoDocumento === 'PA') &&
    affiliation?.colombianoEnElExterior !== null &&
    affiliation?.colombianoEnElExterior !== undefined
  ) {
    pensionCandidateBlockReason =
      'La declaración de residencia exterior colombiana es incompatible con el documento CE/PA.';
  } else if (
    employee?.tipoDocumento !== 'CC' &&
    employee?.tipoDocumento !== 'TI' &&
    employee?.tipoDocumento !== 'CE' &&
    employee?.tipoDocumento !== 'PA'
  ) {
    pensionCandidateBlockReason =
      'El candidato pensional requiere tipo documental CC, TI, CE o PA con declaración aplicable.';
  } else if (!pensionStandardRate) {
    const paymentDate = calendarDate(payroll?.fechaPrevistaPagoPila);
    if (!paymentDate) {
      pensionCandidateBlockReason =
        'Falta la fecha prevista de pago PILA congelada para seleccionar la regla pensional aplicable.';
    } else if (
      periodStart >= PILA_NEW_PENSION_SYSTEM_EFFECTIVE_FROM ||
      paymentDate >= PILA_NEW_PENSION_SYSTEM_EFFECTIVE_FROM
    ) {
      pensionCandidateBlockReason =
        'El período o la fecha prevista de pago alcanza el 2027-04-01; falta versionar las reglas del nuevo sistema pensional.';
    } else {
      pensionCandidateBlockReason =
        'No existe una tarifa pensional estándar versionada para el período congelado.';
    }
  } else if (
    !pensionBase ||
    pensionBase.sourceCount !== 1 ||
    !safeInteger(pensionBase.valor, 9) ||
    pensionBase.valor <= 0
  ) {
    pensionCandidateBlockReason =
      'Falta una fuente única y positiva de IBC pensional en el snapshot.';
  }

  if (!pensionCandidateBlockReason && pensionBase && pensionStandardRate) {
    const employeePensionRows = contributionConcepts?.filter(
      (concept) => concept.codigo === 'PENSION_EMP',
    );
    const employerPensionRows = contributionConcepts?.filter(
      (concept) => concept.codigo === 'PENSION_PAT',
    );
    const employeePension =
      employeePensionRows?.length === 1 ? employeePensionRows[0] : null;
    const employerPension =
      employerPensionRows?.length === 1 ? employerPensionRows[0] : null;
    const employeePensionAmount = employeePension?.valor;
    const employerPensionAmount = employerPension?.valor;
    const pensionAmountCandidate =
      safeInteger(employeePensionAmount, 9) &&
      safeInteger(employerPensionAmount, 9)
        ? employeePensionAmount + employerPensionAmount
        : null;
    const pensionRateBlockReason =
      employeePensionRows?.length !== 1 || employerPensionRows?.length !== 1
        ? 'Se requieren fuentes únicas PENSION_EMP y PENSION_PAT en el snapshot.'
        : employeePension?.tipo !== 'DEDUCTION' ||
            employerPension?.tipo !== 'EMPLOYER_CONTRIBUTION'
          ? 'Las fuentes de pensión no tienen los tipos de concepto esperados.'
          : employeePension.factor !== pensionStandardRate.employeeFactor ||
              employerPension.factor !== pensionStandardRate.employerFactor
            ? 'Los factores PENSION_EMP/PENSION_PAT no coinciden con las tarifas estándar versionadas 4 % y 12 %.'
            : !safeInteger(employeePension.base, 9) ||
                !safeInteger(employeePensionAmount, 9) ||
                !safeInteger(employerPension.base, 9) ||
                !safeInteger(employerPensionAmount, 9) ||
                employeePension.base !== pensionBase.valor ||
                employerPension.base !== pensionBase.valor
              ? 'Las bases e importes PENSION_EMP/PENSION_PAT no coinciden con el IBC pensional congelado.'
              : !isPilaContributionAmountRoundedUpToHundred(
                    periodStart,
                    pensionBase.valor,
                    4,
                    100,
                    employeePensionAmount,
                  ) ||
                  !isPilaContributionAmountRoundedUpToHundred(
                    periodStart,
                    pensionBase.valor,
                    12,
                    100,
                    employerPensionAmount,
                  )
                ? 'Los importes pensionales congelados no cumplen el redondeo PILA vigente para cada concepto.'
                : pensionAmountCandidate === null ||
                    !safeInteger(pensionAmountCandidate, 9) ||
                    !isPilaContributionAmountRoundedUpToHundred(
                      periodStart,
                      pensionBase.valor,
                      16,
                      100,
                      pensionAmountCandidate,
                    )
                  ? 'La suma congelada de los aportes pensionales no coincide con IBC × 16 % y su redondeo PILA; no se ajustan los importes.'
                  : null;

    if (
      pensionRateBlockReason ||
      pensionAmountCandidate === null ||
      !safeInteger(pensionAmountCandidate, 9)
    ) {
      const reason =
        pensionRateBlockReason ??
        'No se pueden leer los importes pensionales congelados.';
      unresolved(46, reason);
      unresolved(47, reason);
    } else {
      // Field 47 is composed only from the two approved snapshot amounts;
      // the calculation above is a consistency check and never replaces them.
      put(46, pensionStandardRate.fieldValue);
      put(47, pensionAmountCandidate);
    }
  } else {
    const reason =
      pensionCandidateBlockReason ??
      'No se puede validar el aporte pensional contra fuentes congeladas.';
    unresolved(46, reason);
    unresolved(47, reason);
  }

  unresolved(
    48,
    'El período permite aportes voluntarios, pero falta el importe del afiliado congelado desde Payroll y la confirmación del campo 28.',
  );
  unresolved(
    49,
    'El período permite aportes voluntarios, pero falta el importe del aportante congelado desde Payroll y la confirmación del campo 28.',
  );
  unresolved(
    51,
    'El aporte de solidaridad requiere agregar el IBC pensional por cotizante y validar su obligación; el snapshot no conserva esa base agregada ni una fuente separada de esta subcuenta.',
  );
  unresolved(
    52,
    'El aporte de subsistencia requiere la base pensional agregada y validar la regla vigente por régimen; Payroll no conserva una fuente separada de esta subcuenta.',
  );
  unresolved(
    53,
    'El período permite aportes voluntarios, pero falta una fuente aprobada para calcular el valor no retenido y validar la diferencia de retención.',
  );

  if (scope.planillaType !== 'E') {
    const reason =
      'El MVP solo mapea aportes voluntarios para planilla E; otros tipos de planilla no están soportados.';
    for (const fieldNumber of [28, 48, 49, 53]) {
      unresolved(fieldNumber, reason);
    }
  } else if (periodEnd < periodStart) {
    const reason =
      'El período PILA tiene un intervalo invertido; no se puede aplicar el corte normativo de aportes voluntarios.';
    for (const fieldNumber of [28, 48, 49, 53]) {
      unresolved(fieldNumber, reason);
    }
  } else if (periodStart >= PILA_AT2_V30_VOLUNTARY_PENSION_CUTOFF) {
    // AT2 v30 only permits these voluntary contributions for periods before
    // July 2025. The cutoff, rather than missing payroll data, makes them
    // inapplicable for later planilla E periods.
    blank(28);
    put(48, 0);
    put(49, 0);
    // AT2 only permits field 53 when field 28 is X; leave the numeric field
    // unused when no voluntary contribution is declared.
    blank(53);
  } else if (periodEnd < PILA_AT2_V30_VOLUNTARY_PENSION_CUTOFF) {
    unresolved(
      28,
      'El período permite aportes voluntarios, pero falta la afiliación pensional versionada y la declaración congelada del campo 28.',
    );
  } else {
    const reason =
      'El período cruza el corte normativo del 2025-07-01; no se puede determinar la aplicabilidad de aportes voluntarios con un único período.';
    for (const fieldNumber of [28, 48, 49, 53]) {
      unresolved(fieldNumber, reason);
    }
  }

  const pensionContributionAmounts: number[] = [];
  for (const fieldNumber of [47, 48, 49]) {
    const value = values[fieldNumber]?.value;
    if (!safeInteger(value, 9)) break;
    pensionContributionAmounts.push(value);
  }
  if (pensionContributionAmounts.length === 3) {
    const totalPensionContribution = pensionContributionAmounts.reduce(
      (total, value) => total + value,
      0,
    );
    if (safeInteger(totalPensionContribution, 9)) {
      // AT2 v30 defines field 50 as the sum of fields 47–49. This derives no
      // new contribution: every component must already be a resolved value.
      put(50, totalPensionContribution);
    } else {
      unresolved(
        50,
        'La suma AT2 de los campos 47–49 excede la longitud permitida para el campo 50.',
      );
    }
  } else {
    unresolved(
      50,
      'AT2 define el campo 50 como la suma de los campos 47–49; no se propone mientras alguno permanezca sin resolver.',
    );
  }

  const healthBase = object(subsystemBases?.salud);
  let healthRateBlockReason: string | null = null;
  if (!standardFullMonthEmployee || !fullMonthPilaInputsApproved) {
    healthRateBlockReason =
      'La tarifa de salud candidata requiere un dependiente 01/00 con snapshot mensual completo y sin novedades ni eventos PILA.';
  } else if (employerPila.tipoAportante !== '1') {
    healthRateBlockReason =
      'La tarifa de salud candidata solo cubre aportantes empleadores tipo 1.';
  } else if (employerPila.naturalezaJuridica !== '2') {
    healthRateBlockReason =
      'La tarifa de salud candidata solo cubre empleadores privados.';
  } else if (
    employer.aportesExonerados !== false ||
    employerPila.aportesExoneradosConfirmado !== false
  ) {
    healthRateBlockReason =
      'Se requiere declaración expresa y coherente de no exoneración para validar la tarifa total de salud de 12,5 %.';
  } else if (
    (employee?.tipoDocumento !== 'CC' && employee?.tipoDocumento !== 'TI') ||
    affiliation?.colombianoEnElExterior !== false
  ) {
    healthRateBlockReason =
      'La tarifa de salud candidata requiere tipo documental CC/TI y confirmación expresa de que el trabajador no está en el exterior.';
  } else if (
    affiliation?.extranjeroNoObligadoPension !== null &&
    affiliation?.extranjeroNoObligadoPension !== undefined
  ) {
    healthRateBlockReason =
      'La declaración de exención extranjera es incompatible con el documento CC/TI.';
  } else if (!healthStandardRate) {
    healthRateBlockReason =
      'No hay una tarifa de salud estándar versionada para el período congelado.';
  } else if (
    !healthBase ||
    healthBase.sourceCount !== 1 ||
    !safeInteger(healthBase.valor, 9) ||
    healthBase.valor <= 0
  ) {
    healthRateBlockReason =
      'Falta una fuente única y positiva de IBC de salud en el snapshot.';
  }

  const healthBaseAmount =
    healthBase && safeInteger(healthBase.valor, 9) ? healthBase.valor : null;
  if (
    !healthRateBlockReason &&
    healthBase &&
    healthBaseAmount !== null &&
    healthStandardRate
  ) {
    const employeeHealthConcept = getContributionAmountCandidate({
      fieldNumber: 55,
      code: 'SALUD_EMP',
      base: healthBase,
      expectedType: 'DEDUCTION',
      requireExplicitNonExemption: true,
      expectedFactor: healthStandardRate.employeeFactor,
      expectedFactorMismatchReason:
        'El factor SALUD_EMP del snapshot no coincide con la tarifa estándar versionada de 4 %.',
    });
    const employerHealthConcept = getContributionAmountCandidate({
      fieldNumber: 55,
      code: 'SALUD_PAT',
      base: healthBase,
      requireExplicitNonExemption: true,
      expectedFactor: healthStandardRate.employerFactor,
      expectedFactorMismatchReason:
        'El factor SALUD_PAT del snapshot no coincide con la tarifa estándar versionada de 8,5 %.',
    });
    const employeeHealthAmount = employeeHealthConcept?.valor;
    const employerHealthAmount = employerHealthConcept?.valor;
    const healthAmountCandidate =
      safeInteger(employeeHealthAmount, 9) &&
      safeInteger(employerHealthAmount, 9)
        ? employeeHealthAmount + employerHealthAmount
        : null;
    const employeeHealthRatio = getPilaContributionFactorRatio(
      healthStandardRate.employeeFactor,
    );
    const employerHealthRatio = getPilaContributionFactorRatio(
      healthStandardRate.employerFactor,
    );
    const totalHealthRatio = getPilaContributionFactorRatio(
      healthStandardRate.factor,
    );
    let healthAmountBlockReason: string | null = null;
    if (!employeeHealthConcept || !employerHealthConcept) {
      healthAmountBlockReason =
        reasons.get(55) ??
        'Se requieren fuentes SALUD_EMP y SALUD_PAT únicas en el snapshot.';
    } else if (
      !safeInteger(employeeHealthAmount, 9) ||
      !safeInteger(employerHealthAmount, 9) ||
      healthAmountCandidate === null ||
      !safeInteger(healthAmountCandidate, 9)
    ) {
      healthAmountBlockReason =
        'Los importes de salud congelados superan el rango válido o no son enteros.';
    } else if (
      !employeeHealthRatio ||
      !employerHealthRatio ||
      !totalHealthRatio ||
      !isPilaContributionAmountRoundedUpToHundred(
        periodStart,
        healthBaseAmount,
        employeeHealthRatio.numerator,
        employeeHealthRatio.denominator,
        employeeHealthAmount,
      ) ||
      !isPilaContributionAmountRoundedUpToHundred(
        periodStart,
        healthBaseAmount,
        employerHealthRatio.numerator,
        employerHealthRatio.denominator,
        employerHealthAmount,
      )
    ) {
      healthAmountBlockReason =
        'Los importes SALUD_EMP/SALUD_PAT congelados no cumplen el redondeo PILA vigente para cada concepto.';
    } else if (
      !isPilaContributionAmountRoundedUpToHundred(
        periodStart,
        healthBaseAmount,
        totalHealthRatio.numerator,
        totalHealthRatio.denominator,
        healthAmountCandidate,
      )
    ) {
      healthAmountBlockReason =
        'La suma congelada de los aportes de salud no coincide con IBC × 12,5 % y su redondeo PILA; no se ajustan los importes.';
    }

    if (healthAmountBlockReason) {
      unresolved(54, healthAmountBlockReason);
      unresolved(55, healthAmountBlockReason);
    } else {
      put(54, healthStandardRate.fieldValue);
      put(55, healthAmountCandidate!);
    }
  } else {
    const reason =
      healthRateBlockReason ??
      'No se puede validar el aporte de salud contra fuentes congeladas.';
    unresolved(54, reason);
    unresolved(55, reason);
  }

  const ccfBase =
    object(subsystemBases?.cajaCompensacion)?.sourceCount === 1
      ? object(subsystemBases?.cajaCompensacion)
      : null;
  let parafiscalRateBlockReason: string | null = null;
  if (!standardFullMonthEmployee) {
    parafiscalRateBlockReason =
      'Las tarifas SENA e ICBF solo están definidas aquí para un dependiente 01/00 de mes completo.';
  } else if (employerPila.tipoAportante !== '1') {
    parafiscalRateBlockReason =
      'Falta declarar el aportante empleador requerido para estas tarifas parafiscales.';
  } else if (
    employerPila.claseAportante !== 'A' &&
    employerPila.claseAportante !== 'B'
  ) {
    parafiscalRateBlockReason =
      'Las tarifas candidatas SENA e ICBF solo cubren aportantes clase A/B; las clases C/D requieren reglas especiales fuera del alcance actual.';
  } else if (employerPila.naturalezaJuridica !== '2') {
    parafiscalRateBlockReason =
      'Las tarifas estándar candidatas SENA e ICBF solo cubren empleadores privados; las demás naturalezas requieren validar reglas específicas.';
  } else if (employerPila.beneficioLey1429 !== false) {
    parafiscalRateBlockReason =
      employerPila.beneficioLey1429 === true
        ? 'El beneficio general de Ley 1429 requiere tarifas y elegibilidad verificadas antes de mapear SENA e ICBF.'
        : 'Falta declarar explícitamente que no aplica el beneficio general de Ley 1429 para SENA e ICBF.';
  }
  const parafiscalBase =
    otherParafiscalBase?.reglaVersion === 'CO_PARAFISCAL_BASE_V1' &&
    hasNoBlockers(otherParafiscalBase)
      ? otherParafiscalBase
      : null;
  const mapStandardParafiscalCandidates = (input: {
    rateFieldNumber: number;
    amountFieldNumber: number;
    code: 'SENA' | 'ICBF';
    base: JsonRecord | null;
    factor: number | null;
    fieldValue: string | null;
    rateRuleAvailable: boolean;
  }) => {
    const expectedFactor = parafiscalRateBlockReason
      ? null
      : input.rateRuleAvailable
        ? input.factor
        : null;
    const expectedFactorReason =
      parafiscalRateBlockReason ??
      `No hay una tarifa ${input.code} versionada aplicable al período congelado.`;
    const expectedFactorMismatchReason = `El factor ${input.code} del snapshot no coincide con la tarifa estándar versionada.`;
    const contributionCandidate = getContributionAmountCandidate({
      fieldNumber: input.rateFieldNumber,
      code: input.code,
      base: input.base,
      requireExplicitNonExemption: true,
      expectedFactor,
      expectedFactorReason,
      expectedFactorMismatchReason,
    });
    if (contributionCandidate && input.fieldValue) {
      put(input.rateFieldNumber, input.fieldValue);
    }
    mapContributionAmountCandidate({
      fieldNumber: input.amountFieldNumber,
      code: input.code,
      base: input.base,
      requireExplicitNonExemption: true,
      expectedFactor,
      expectedFactorReason,
      expectedFactorMismatchReason,
    });
  };
  let ccfRateBlockReason: string | null = null;
  if (!standardFullMonthEmployee) {
    ccfRateBlockReason =
      'La tarifa CCF solo está definida para un dependiente 01/00 de mes completo.';
  } else if (employerPila.tipoAportante !== '1') {
    ccfRateBlockReason =
      'Falta declarar el aportante empleador requerido para esta tarifa CCF.';
  } else if (
    employerPila.claseAportante !== 'A' &&
    employerPila.claseAportante !== 'B'
  ) {
    ccfRateBlockReason =
      'La tarifa CCF solo está definida para aportantes clase A/B; las clases C/D requieren reglas de beneficio fuera del alcance actual.';
  } else if (employerPila.beneficioCcfLey1429 !== false) {
    ccfRateBlockReason =
      employerPila.beneficioCcfLey1429 === true
        ? 'El beneficio CCF de Ley 1429 requiere una tarifa y elegibilidad verificadas antes de mapear el campo.'
        : 'Falta una declaración explícita de que no aplica el beneficio CCF de Ley 1429.';
  } else if (!ccfStandardRate) {
    ccfRateBlockReason =
      'No hay una tarifa CCF versionada aplicable al período congelado.';
  }

  if (ccfRateBlockReason) {
    unresolved(64, ccfRateBlockReason);
  } else if (ccfStandardRate) {
    const ccfConcept = getContributionAmountCandidate({
      fieldNumber: 64,
      code: 'CAJA',
      base: ccfBase,
      expectedFactor: ccfStandardRate.factor,
      expectedFactorMismatchReason:
        'El factor CAJA del snapshot no coincide con la tarifa CCF estándar versionada.',
    });
    if (ccfConcept) put(64, ccfStandardRate.fieldValue);
  }

  mapContributionAmountCandidate({
    fieldNumber: 65,
    code: 'CAJA',
    base: ccfBase,
    expectedFactor: ccfRateBlockReason
      ? null
      : (ccfStandardRate?.factor ?? null),
    expectedFactorReason:
      ccfRateBlockReason ??
      'No hay una tarifa CCF versionada aplicable al período congelado.',
    expectedFactorMismatchReason:
      'El factor CAJA del snapshot no coincide con la tarifa CCF estándar versionada.',
  });
  mapStandardParafiscalCandidates({
    rateFieldNumber: 66,
    amountFieldNumber: 67,
    code: 'SENA',
    base: parafiscalBase,
    factor: senaStandardRate?.factor ?? null,
    fieldValue: senaStandardRate?.fieldValue ?? null,
    rateRuleAvailable: senaStandardRate !== null,
  });
  mapStandardParafiscalCandidates({
    rateFieldNumber: 68,
    amountFieldNumber: 69,
    code: 'ICBF',
    base: parafiscalBase,
    factor: icbfStandardRate?.factor ?? null,
    fieldValue: icbfStandardRate?.fieldValue ?? null,
    rateRuleAvailable: icbfStandardRate !== null,
  });

  const defaultReason =
    'El campo aún no tiene mapeo candidato aprobado desde snapshots PILA.';
  const unresolvedFields =
    PILA_AT2_V30_RECORD_LAYOUTS.contributorDetailType2.fields
      .filter(({ fieldNumber }) => !Object.hasOwn(values, fieldNumber))
      .map(({ fieldNumber }) => ({
        fieldNumber,
        reason: reasons.get(fieldNumber) ?? defaultReason,
      }));

  return {
    formatVersion: PILA_AT2_V30_FORMAT_VERSION,
    supportedSnapshot: true,
    scopeMismatch: false,
    employeeId: snapshot.employeeId,
    tenantId,
    payrollPeriodId,
    normativeRuleVersions: {
      planillaEField22:
        scope.planillaType === 'E'
          ? PILA_AT2_V30_PLANILLA_E_FIELD_22_RULE_VERSION
          : null,
      pensionTotalField50: PILA_AT2_V30_PENSION_TOTAL_FIELD_50_RULE_VERSION,
      voluntaryPensionCutoff:
        scope.planillaType === 'E'
          ? PILA_AT2_V30_VOLUNTARY_PENSION_CUTOFF_RULE_VERSION
          : null,
      arlInitialRate: arlRateByClass
        ? PILA_ARL_INITIAL_RATE_RULE_VERSION
        : null,
      contributionRounding: getPilaContributionRoundingRuleVersion(periodStart),
      ccfRate: getPilaCcfStandardRate(periodStart)?.ruleVersion ?? null,
      senaRate: senaStandardRate?.ruleVersion ?? null,
      icbfRate: icbfStandardRate?.ruleVersion ?? null,
      pensionRate: pensionStandardRate?.ruleVersion ?? null,
      healthRate: healthStandardRate?.ruleVersion ?? null,
      noBenefitEventFields: fullMonthPilaInputsApproved
        ? PILA_AT2_V30_NO_BENEFIT_EVENT_FIELDS_RULE_VERSION
        : null,
      noEventNoveltyFields: fullMonthPilaInputsApproved
        ? PILA_AT2_V30_NO_EVENT_NOVELTY_FIELDS_RULE_VERSION
        : null,
      noTransferDestinationFields: standardAffiliation
        ? PILA_AT2_V30_NO_TRANSFER_DESTINATION_FIELDS_RULE_VERSION
        : null,
      nonCotizante40PrincipalFields: standardAffiliation
        ? PILA_AT2_V30_NON_COTIZANTE40_PRINCIPAL_FIELDS_RULE_VERSION
        : null,
      confirmedNonExemptCotizante: values[76]
        ? PILA_AT2_V30_CONFIRMED_NON_EXEMPT_COTIZANTE_RULE_VERSION
        : null,
      privateEmployerEsapMen: standardPrivateEmployer
        ? PILA_AT2_V30_PRIVATE_EMPLOYER_NO_ESAP_MEN_RULE_VERSION
        : null,
    },
    values,
    unresolvedFields,
  };
}
