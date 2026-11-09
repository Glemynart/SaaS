import {
  PILA_AT2_V30_FORMAT_VERSION,
  PILA_AT2_V30_RECORD_LAYOUTS,
  validatePilaAt2V30FieldCandidate,
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
import {
  getFspSubaccountRates,
  PILA_FSP_NEW_SYSTEM_EFFECTIVE_FROM,
  PILA_FSP_SUBACCOUNT_RULE_VERSION,
} from './pila-fsp-subaccounts';
import { isColombiaDaneDepartmentCode } from '@saas/types';
import {
  isValidPilaCotizanteIdentification,
  PILA_SUPPORTED_COTIZANTE_DOCUMENT_TYPES,
} from './pila-document-identity';
import type { PilaSnapshotPreparationInput } from './pila-preparation';
import type { PILA_AT2_V30_DETAIL_RECORD_SEQUENCE_RULE_VERSION } from './pila-at2-v30-detail-sequencer';
import {
  calculateMonthlyEmploymentDays,
  calculateMonthlyEntryDays,
  calculateMonthlyRetirementDays,
} from './payroll-30-day-month';

type JsonRecord = Record<string, unknown>;

const PILA_AT2_V30_NO_BENEFIT_EVENT_FIELDS_RULE_VERSION =
  'AT2_V30_NO_IGE_LMA_FIXED_FIELDS_V1' as const;
const PILA_AT2_V30_NO_EVENT_NOVELTY_FIELDS_RULE_VERSION =
  'AT2_V30_NO_EVENT_NOVELTY_FIELDS_V1' as const;
const PILA_AT2_V30_NEW_HIRE_INGRESS_FIELDS_RULE_VERSION =
  'AT2_V30_NEW_HIRE_INGRESS_FIELDS_V1' as const;
const PILA_AT2_V30_NEW_HIRE_BASIC_SALARY_FIELD_40_RULE_VERSION =
  'PILA_ING_FIELD_40_FROM_APPROVED_BASE_V1' as const;
const PILA_AT2_V30_RETIREMENT_EVENT_FIELDS_RULE_VERSION =
  'AT2_V30_SINGLE_RETIREMENT_FIELDS_V1' as const;
const PILA_AT2_V30_RETIREMENT_BASIC_SALARY_FIELD_40_RULE_VERSION =
  'PILA_RET_FIELD_40_FROM_APPROVED_BASE_V1' as const;
const PILA_AT2_V30_ING_RET_FIELDS_RULE_VERSION =
  'AT2_V30_SAME_PERIOD_ING_RET_FIELDS_V1' as const;
const PILA_AT2_V30_ING_RET_DAYS_RULE_VERSION =
  'PILA_ING_RET_DAYS_FROM_APPROVED_PAYROLL_V1' as const;
const PILA_AT2_V30_ING_RET_BASIC_SALARY_FIELD_40_RULE_VERSION =
  'PILA_ING_RET_FIELD_40_FROM_APPROVED_BASE_V1' as const;
const PILA_AT2_V30_SINGLE_FULL_MONTH_VSP_FIELDS_RULE_VERSION =
  'AT2_V30_SINGLE_FULL_MONTH_VSP_FIELDS_V1' as const;
const PILA_AT2_V30_VAC_LR_EVENT_FIELDS_RULE_VERSION =
  'AT2_V30_TYPED_VAC_LR_EVENT_FIELDS_V1' as const;
const PILA_AT2_V30_PLANILLA_E_FIELD_22_RULE_VERSION =
  'AT2_V30_PLANILLA_E_FIELD_22_BLANK_V1' as const;
const PILA_AT2_V30_PENSION_TOTAL_FIELD_50_RULE_VERSION =
  'AT2_V30_PENSION_TOTAL_FIELD_50_SUM_47_49_V1' as const;
const PILA_AT2_V30_NORMAL_PENSION_TARIFF_FIELD_79_RULE_VERSION =
  'AT2_V30_CONFIRMED_NORMAL_PENSION_TARIFF_FIELD_79_V1' as const;
const PILA_AT2_V30_OPTIONAL_HOURS_FIELD_96_RULE_VERSION =
  'AT2_V30_FIELD_96_OPTIONAL_BLANK_FOR_DEPENDENT_V1' as const;
const PILA_AT2_V30_NO_FOREIGN_RESIDENCE_FIELD_97_RULE_VERSION =
  'AT2_V30_FIELD_97_BLANK_WHEN_NOT_ABROAD_V1' as const;
const PILA_AT2_V30_VOLUNTARY_PENSION_DECLARATION_RULE_VERSION =
  'AT2_V30_AVP_NONE_DECLARED_PRE_2027_04_01_V1' as const;
const PILA_AT2_V30_NEW_PENSION_SYSTEM_EFFECTIVE_FROM = '2027-04-01';
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
  28, 48, 49, 50, 51, 52, 53,
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
    normalPensionTariffField79:
      | typeof PILA_AT2_V30_NORMAL_PENSION_TARIFF_FIELD_79_RULE_VERSION
      | null;
    voluntaryPensionDeclaration:
      | typeof PILA_AT2_V30_VOLUNTARY_PENSION_DECLARATION_RULE_VERSION
      | null;
    arlInitialRate: typeof PILA_ARL_INITIAL_RATE_RULE_VERSION | null;
    contributionRounding: typeof PILA_CONTRIBUTION_ROUNDING_RULE_VERSION | null;
    ccfRate: typeof PILA_CCF_STANDARD_RATE_RULE_VERSION | null;
    senaRate: typeof PILA_SENA_STANDARD_RATE_RULE_VERSION | null;
    icbfRate: typeof PILA_ICBF_STANDARD_RATE_RULE_VERSION | null;
    pensionRate: typeof PILA_PENSION_STANDARD_RATE_RULE_VERSION | null;
    healthRate: typeof PILA_HEALTH_STANDARD_RATE_RULE_VERSION | null;
    fspSubaccounts: typeof PILA_FSP_SUBACCOUNT_RULE_VERSION | null;
    noBenefitEventFields:
      | typeof PILA_AT2_V30_NO_BENEFIT_EVENT_FIELDS_RULE_VERSION
      | null;
    noEventNoveltyFields:
      | typeof PILA_AT2_V30_NO_EVENT_NOVELTY_FIELDS_RULE_VERSION
      | null;
    newHireIngressFields:
      | typeof PILA_AT2_V30_NEW_HIRE_INGRESS_FIELDS_RULE_VERSION
      | null;
    newHireBasicSalaryField40:
      | typeof PILA_AT2_V30_NEW_HIRE_BASIC_SALARY_FIELD_40_RULE_VERSION
      | null;
    retirementEventFields:
      | typeof PILA_AT2_V30_RETIREMENT_EVENT_FIELDS_RULE_VERSION
      | null;
    retirementBasicSalaryField40:
      | typeof PILA_AT2_V30_RETIREMENT_BASIC_SALARY_FIELD_40_RULE_VERSION
      | null;
    samePeriodIngressRetirementFields:
      | typeof PILA_AT2_V30_ING_RET_FIELDS_RULE_VERSION
      | null;
    ingressRetirementBasicSalaryField40:
      | typeof PILA_AT2_V30_ING_RET_BASIC_SALARY_FIELD_40_RULE_VERSION
      | null;
    vspEventFields:
      | typeof PILA_AT2_V30_SINGLE_FULL_MONTH_VSP_FIELDS_RULE_VERSION
      | null;
    vacLrEventFields:
      | typeof PILA_AT2_V30_VAC_LR_EVENT_FIELDS_RULE_VERSION
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
    optionalHoursField96:
      | typeof PILA_AT2_V30_OPTIONAL_HOURS_FIELD_96_RULE_VERSION
      | null;
    noForeignResidenceDateField97:
      | typeof PILA_AT2_V30_NO_FOREIGN_RESIDENCE_FIELD_97_RULE_VERSION
      | null;
    detailRecordSequence:
      | typeof PILA_AT2_V30_DETAIL_RECORD_SEQUENCE_RULE_VERSION
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

function containsPilaEventCode(value: unknown, expectedCode: string): boolean {
  return (
    Array.isArray(value) &&
    value.some((row: unknown) => {
      const event = object(row);
      return sourceText(event?.codigo) === expectedCode;
    })
  );
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

function calendarDateAsDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Maps candidate AT2 v30 type 2 detail sources from one frozen PILA snapshot.
 * It is deliberately partial: the initial ARL rate is only a versioned
 * candidate, remaining contribution rules and novelty segments are unresolved,
 * and it does not validate record completeness or serialize a record. Concrete
 * values are checked against their field layout before they become candidates.
 */
export function mapPilaAt2V30DetailCandidate(
  snapshot: PilaSnapshotPreparationInput,
  scope: PilaAt2V30DetailScope,
): PilaAt2V30DetailCandidate {
  const values: Partial<Record<number, PilaAt2V30FieldInput>> = {};
  const reasons = new Map<number, string>();
  const unresolved = (fieldNumber: number, reason: string) => {
    reasons.set(fieldNumber, reason);
  };
  const put = (fieldNumber: number, value: string | number) => {
    const input = { value } satisfies PilaAt2V30FieldInput;
    const validationError = validatePilaAt2V30FieldCandidate(
      'contributorDetailType2',
      fieldNumber,
      input,
    );
    if (validationError) {
      delete values[fieldNumber];
      unresolved(fieldNumber, validationError);
      return;
    }
    values[fieldNumber] = { value };
    reasons.delete(fieldNumber);
  };
  const blank = (fieldNumber: number) => {
    // Field-specific rules own blank semantics, including numeric fields whose
    // AT2 applicability requires a blank instead of a numeric zero.
    const input = { value: null, emptyAs: 'spaces' } as const;
    values[fieldNumber] = input;
    reasons.delete(fieldNumber);
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
      snapshot.payloadVersion === 4 ||
      snapshot.payloadVersion === 5 ||
      snapshot.payloadVersion === 6 ||
      snapshot.payloadVersion === 7 ||
      snapshot.payloadVersion === 8 ||
      snapshot.payloadVersion === 9 ||
      snapshot.payloadVersion === 10 ||
      snapshot.payloadVersion === 11 ||
      snapshot.payloadVersion === 12 ||
      snapshot.payloadVersion === 13) &&
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
      : 'Se requiere un snapshot PILA v2 a v13 válido y atribuible a un tenant y período.';
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
        normalPensionTariffField79: null,
        voluntaryPensionDeclaration: null,
        arlInitialRate: null,
        contributionRounding: null,
        ccfRate: null,
        senaRate: null,
        icbfRate: null,
        pensionRate: null,
        healthRate: null,
        fspSubaccounts: null,
        noBenefitEventFields: null,
        noEventNoveltyFields: null,
        newHireIngressFields: null,
        newHireBasicSalaryField40: null,
        retirementEventFields: null,
        retirementBasicSalaryField40: null,
        samePeriodIngressRetirementFields: null,
        ingressRetirementBasicSalaryField40: null,
        vspEventFields: null,
        vacLrEventFields: null,
        noTransferDestinationFields: null,
        nonCotizante40PrincipalFields: null,
        confirmedNonExemptCotizante: null,
        privateEmployerEsapMen: null,
        optionalHoursField96: null,
        noForeignResidenceDateField97: null,
        detailRecordSequence: null,
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
  const rootEventRows = Array.isArray(root?.pilaEvents)
    ? root.pilaEvents
    : null;
  const payrollEventRows = Array.isArray(payroll?.pilaEvents)
    ? payroll.pilaEvents
    : null;
  const hasVacLrEvent =
    containsPilaEventCode(root?.pilaEvents, 'VAC_LR') ||
    containsPilaEventCode(payroll?.pilaEvents, 'VAC_LR');
  const rootPilaEvent =
    rootEventRows?.length === 1 ? object(rootEventRows[0]) : null;
  const payrollPilaEvent =
    payrollEventRows?.length === 1 ? object(payrollEventRows[0]) : null;
  const rootIngressEvent =
    rootEventRows?.length === 2
      ? rootEventRows
          .map(object)
          .find((event) => sourceText(event?.codigo) === 'ING')
      : null;
  const rootRetirementEvent =
    rootEventRows?.length === 2
      ? rootEventRows
          .map(object)
          .find((event) => sourceText(event?.codigo) === 'RET')
      : null;
  const payrollIngressEvent =
    payrollEventRows?.length === 2
      ? payrollEventRows
          .map(object)
          .find((event) => sourceText(event?.codigo) === 'ING')
      : null;
  const payrollRetirementEvent =
    payrollEventRows?.length === 2
      ? payrollEventRows
          .map(object)
          .find((event) => sourceText(event?.codigo) === 'RET')
      : null;
  const entryDate = sourceText(employee?.fechaIngreso);
  const retirementDate = sourceText(employee?.fechaRetiro);
  const contractStartDate = sourceText(contract?.fechaInicio);
  const contractEndDate = sourceText(contract?.fechaFin);
  const approvedSingleIngressEvent = Boolean(
    rootPilaEvent &&
    payrollPilaEvent &&
    sourceText(rootPilaEvent.eventId) !== null &&
    sourceText(rootPilaEvent.codigo) === 'ING' &&
    sourceText(payrollPilaEvent.codigo) === 'ING' &&
    sourceText(rootPilaEvent.fechaInicio) === entryDate &&
    sourceText(payrollPilaEvent.fechaInicio) === entryDate &&
    rootPilaEvent.fechaFin === null &&
    payrollPilaEvent.fechaFin === null &&
    rootPilaEvent.dias === null &&
    payrollPilaEvent.dias === null &&
    sourceText(rootPilaEvent.eventId) === sourceText(payrollPilaEvent.eventId),
  );
  const approvedSingleRetirementEvent = Boolean(
    rootPilaEvent &&
    payrollPilaEvent &&
    sourceText(rootPilaEvent.eventId) !== null &&
    sourceText(rootPilaEvent.codigo) === 'RET' &&
    sourceText(payrollPilaEvent.codigo) === 'RET' &&
    sourceText(rootPilaEvent.fechaInicio) === retirementDate &&
    sourceText(payrollPilaEvent.fechaInicio) === retirementDate &&
    rootPilaEvent.fechaFin === null &&
    payrollPilaEvent.fechaFin === null &&
    rootPilaEvent.dias === null &&
    payrollPilaEvent.dias === null &&
    sourceText(rootPilaEvent.eventId) === sourceText(payrollPilaEvent.eventId),
  );
  const approvedSamePeriodIngressRetirementEvents = Boolean(
    rootIngressEvent &&
    rootRetirementEvent &&
    payrollIngressEvent &&
    payrollRetirementEvent &&
    sourceText(rootIngressEvent.eventId) !== null &&
    sourceText(rootRetirementEvent.eventId) !== null &&
    sourceText(rootIngressEvent.eventId) !==
      sourceText(rootRetirementEvent.eventId) &&
    sourceText(rootIngressEvent.eventId) ===
      sourceText(payrollIngressEvent.eventId) &&
    sourceText(rootRetirementEvent.eventId) ===
      sourceText(payrollRetirementEvent.eventId) &&
    sourceText(rootIngressEvent.fechaInicio) === entryDate &&
    sourceText(payrollIngressEvent.fechaInicio) === entryDate &&
    sourceText(rootRetirementEvent.fechaInicio) === retirementDate &&
    sourceText(payrollRetirementEvent.fechaInicio) === retirementDate &&
    rootIngressEvent.fechaFin === null &&
    payrollIngressEvent.fechaFin === null &&
    rootRetirementEvent.fechaFin === null &&
    payrollRetirementEvent.fechaFin === null &&
    rootIngressEvent.dias === null &&
    payrollIngressEvent.dias === null &&
    rootRetirementEvent.dias === null &&
    payrollRetirementEvent.dias === null,
  );
  const approvedSingleVspEvent = Boolean(
    (snapshot.payloadVersion === 10 ||
      snapshot.payloadVersion === 11 ||
      snapshot.payloadVersion === 12 ||
      snapshot.payloadVersion === 13) &&
    rootPilaEvent &&
    payrollPilaEvent &&
    sourceText(rootPilaEvent.eventId) !== null &&
    sourceText(rootPilaEvent.codigo) === 'VSP' &&
    sourceText(payrollPilaEvent.codigo) === 'VSP' &&
    sourceText(rootPilaEvent.fechaInicio) === periodStart &&
    sourceText(payrollPilaEvent.fechaInicio) === periodStart &&
    rootPilaEvent.fechaFin === null &&
    payrollPilaEvent.fechaFin === null &&
    rootPilaEvent.dias === null &&
    payrollPilaEvent.dias === null &&
    sourceText(rootPilaEvent.eventId) === sourceText(payrollPilaEvent.eventId),
  );
  const affiliationCoversPeriod = Boolean(
    affiliation &&
    coversPeriod(
      affiliation.vigenteDesde,
      affiliation.vigenteHasta,
      periodStart,
      periodEnd,
    ),
  );
  const affiliationCoversRetirementWindow = Boolean(
    affiliation &&
    periodStart &&
    retirementDate &&
    coversPeriod(
      affiliation.vigenteDesde,
      affiliation.vigenteHasta,
      periodStart,
      retirementDate,
    ),
  );
  const standardAffiliationIdentity =
    affiliations?.length === 1 &&
    sourceText(affiliation?.tipoCotizanteCodigo) === '01' &&
    sourceText(affiliation?.subtipoCotizanteCodigo) === '00';
  const affiliationCoversNewHireWindow = Boolean(
    affiliation &&
    entryDate &&
    periodEnd &&
    coversPeriod(
      affiliation.vigenteDesde,
      affiliation.vigenteHasta,
      entryDate,
      periodEnd,
    ),
  );
  const affiliationCoversIngressRetirementWindow = Boolean(
    affiliation &&
    entryDate &&
    retirementDate &&
    coversPeriod(
      affiliation.vigenteDesde,
      affiliation.vigenteHasta,
      entryDate,
      retirementDate,
    ),
  );
  const standardAffiliation =
    standardAffiliationIdentity &&
    (affiliationCoversPeriod ||
      affiliationCoversNewHireWindow ||
      affiliationCoversRetirementWindow ||
      affiliationCoversIngressRetirementWindow);
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
  const vacationStart = sourceText(rootPilaEvent?.fechaInicio);
  const vacationEnd = sourceText(rootPilaEvent?.fechaFin);
  const vacationSubtype = sourceText(rootPilaEvent?.subtipo);
  const vacationWindowIsValid = Boolean(
    periodStart &&
    periodEnd &&
    vacationStart &&
    vacationEnd &&
    vacationStart <= vacationEnd &&
    vacationStart >= periodStart &&
    vacationEnd <= periodEnd &&
    calendarDate(vacationStart) === vacationStart &&
    calendarDate(vacationEnd) === vacationEnd,
  );
  const approvedSingleVacLrEvent = Boolean(
    (snapshot.payloadVersion === 12 || snapshot.payloadVersion === 13) &&
    standardFullMonthEmployee &&
    rootEventRows?.length === 1 &&
    payrollEventRows?.length === 1 &&
    rootPilaEvent &&
    payrollPilaEvent &&
    sourceText(rootPilaEvent.eventId) !== null &&
    sourceText(rootPilaEvent.codigo) === 'VAC_LR' &&
    sourceText(payrollPilaEvent.codigo) === 'VAC_LR' &&
    (vacationSubtype === 'VACACIONES_DISFRUTADAS' ||
      vacationSubtype === 'LICENCIA_REMUNERADA') &&
    sourceText(payrollPilaEvent.subtipo) === vacationSubtype &&
    sourceText(payrollPilaEvent.eventId) ===
      sourceText(rootPilaEvent.eventId) &&
    sourceText(payrollPilaEvent.fechaInicio) === vacationStart &&
    sourceText(payrollPilaEvent.fechaFin) === vacationEnd &&
    rootPilaEvent.dias === null &&
    payrollPilaEvent.dias === null &&
    vacationWindowIsValid &&
    Array.isArray(payroll?.novelties) &&
    payroll.novelties.length === 0,
  );
  const standardFullMonthVspEmployee = Boolean(
    standardFullMonthEmployee &&
    periodEnd &&
    (sourceText(employee?.fechaRetiro) === null ||
      sourceText(employee?.fechaRetiro)! > periodEnd) &&
    (sourceText(contract?.fechaFin) === null ||
      sourceText(contract?.fechaFin)! > periodEnd) &&
    ['TERMINO_FIJO', 'TERMINO_INDEFINIDO', 'OBRA_LABOR'].includes(
      sourceText(contract?.tipo) ?? '',
    ) &&
    payroll?.tipoSalario === 'F' &&
    payroll?.salarioIntegral === false &&
    payroll?.diasNomina === 30 &&
    Array.isArray(payroll?.tipoSalarioBloqueos) &&
    payroll.tipoSalarioBloqueos.length === 0 &&
    Array.isArray(payroll?.novelties) &&
    payroll.novelties.length === 0 &&
    approvedSingleVspEvent,
  );
  const frozenEntryDays = payroll?.diasNomina;
  const expectedEntryDays =
    periodStart && periodEnd && entryDate
      ? calculateMonthlyEntryDays(
          calendarDateAsDate(periodStart),
          calendarDateAsDate(periodEnd),
          calendarDateAsDate(entryDate),
        )
      : null;
  const standardNewHireEmployee = Boolean(
    (snapshot.payloadVersion === 10 ||
      snapshot.payloadVersion === 11 ||
      snapshot.payloadVersion === 12 ||
      snapshot.payloadVersion === 13) &&
    fullMonth &&
    standardAffiliationIdentity &&
    affiliationCoversNewHireWindow &&
    entryDate &&
    periodStart &&
    periodEnd &&
    entryDate >= periodStart &&
    entryDate <= periodEnd &&
    (employee?.fechaRetiro === null ||
      (sourceText(employee?.fechaRetiro) ?? '') >= periodEnd) &&
    contract?.fechaInicio === entryDate &&
    (contract?.fechaFin === null ||
      (sourceText(contract?.fechaFin) ?? '') >= periodEnd) &&
    payroll?.tipoSalario === 'F' &&
    payroll?.salarioIntegral === false &&
    Array.isArray(payroll?.tipoSalarioBloqueos) &&
    payroll.tipoSalarioBloqueos.length === 0 &&
    approvedSingleIngressEvent &&
    Array.isArray(payroll?.novelties) &&
    payroll.novelties.length === 0 &&
    typeof frozenEntryDays === 'number' &&
    Number.isSafeInteger(frozenEntryDays) &&
    frozenEntryDays >= 1 &&
    frozenEntryDays <= 30 &&
    expectedEntryDays !== null &&
    frozenEntryDays === expectedEntryDays,
  );
  const frozenRetirementDays = payroll?.diasNomina;
  const expectedRetirementDays =
    periodStart && periodEnd && retirementDate
      ? calculateMonthlyRetirementDays(
          calendarDateAsDate(periodStart),
          calendarDateAsDate(periodEnd),
          calendarDateAsDate(retirementDate),
        )
      : null;
  const standardRetirementEmployee = Boolean(
    (snapshot.payloadVersion === 10 ||
      snapshot.payloadVersion === 11 ||
      snapshot.payloadVersion === 12 ||
      snapshot.payloadVersion === 13) &&
    fullMonth &&
    standardAffiliationIdentity &&
    affiliationCoversRetirementWindow &&
    entryDate &&
    periodStart &&
    retirementDate &&
    entryDate <= periodStart &&
    retirementDate >= periodStart &&
    retirementDate <= (periodEnd ?? '') &&
    contractStartDate !== null &&
    contractStartDate <= periodStart &&
    contractEndDate === retirementDate &&
    sourceText(contract?.estado) === 'TERMINADO' &&
    approvedSingleRetirementEvent &&
    payroll?.tipoSalario === 'F' &&
    payroll?.salarioIntegral === false &&
    Array.isArray(payroll?.tipoSalarioBloqueos) &&
    payroll.tipoSalarioBloqueos.length === 0 &&
    Array.isArray(payroll?.novelties) &&
    payroll.novelties.length === 0 &&
    typeof frozenRetirementDays === 'number' &&
    Number.isSafeInteger(frozenRetirementDays) &&
    frozenRetirementDays >= 1 &&
    frozenRetirementDays <= 30 &&
    expectedRetirementDays !== null &&
    frozenRetirementDays === expectedRetirementDays,
  );
  const frozenIngressRetirementDays = payroll?.diasNomina;
  const expectedIngressRetirementDays =
    periodStart && periodEnd && entryDate && retirementDate
      ? calculateMonthlyEmploymentDays(
          calendarDateAsDate(periodStart),
          calendarDateAsDate(periodEnd),
          calendarDateAsDate(entryDate),
          calendarDateAsDate(retirementDate),
        )
      : null;
  const standardIngressRetirementEmployee = Boolean(
    (snapshot.payloadVersion === 11 ||
      snapshot.payloadVersion === 12 ||
      snapshot.payloadVersion === 13) &&
    fullMonth &&
    standardAffiliationIdentity &&
    affiliationCoversIngressRetirementWindow &&
    entryDate &&
    retirementDate &&
    periodStart &&
    periodEnd &&
    entryDate >= periodStart &&
    entryDate <= retirementDate &&
    retirementDate <= periodEnd &&
    contractStartDate === entryDate &&
    contractEndDate === retirementDate &&
    sourceText(contract?.estado) === 'TERMINADO' &&
    approvedSamePeriodIngressRetirementEvents &&
    payroll?.tipoSalario === 'F' &&
    payroll?.salarioIntegral === false &&
    Array.isArray(payroll?.tipoSalarioBloqueos) &&
    payroll.tipoSalarioBloqueos.length === 0 &&
    Array.isArray(payroll?.novelties) &&
    payroll.novelties.length === 0 &&
    typeof frozenIngressRetirementDays === 'number' &&
    Number.isSafeInteger(frozenIngressRetirementDays) &&
    frozenIngressRetirementDays >= 1 &&
    frozenIngressRetirementDays <= 30 &&
    expectedIngressRetirementDays !== null &&
    frozenIngressRetirementDays === expectedIngressRetirementDays,
  );
  const standardSupportedEmployee =
    standardFullMonthEmployee ||
    standardFullMonthVspEmployee ||
    standardNewHireEmployee ||
    standardRetirementEmployee ||
    standardIngressRetirementEmployee;
  const supportedCoverageStart =
    (standardNewHireEmployee || standardIngressRetirementEmployee) && entryDate
      ? entryDate
      : periodStart;
  const supportedCoverageEnd =
    (standardRetirementEmployee || standardIngressRetirementEmployee) &&
    retirementDate
      ? retirementDate
      : periodEnd;
  const standardPrivateEmployer =
    standardAffiliation &&
    sourceText(employerPila.tipoAportante) === '1' &&
    sourceText(employerPila.naturalezaJuridica) === '2';

  if (standardSupportedEmployee) {
    put(1, '02');
    unresolved(
      2,
      'La secuencia se asigna al conjunto completo de registros tipo 2, no a cada empleado por separado.',
    );
  } else {
    unresolved(
      1,
      'El detalle requiere un dependiente estándar 01/00 con cobertura completa o un único ingreso aprobado en el snapshot de Nómina.',
    );
    unresolved(
      2,
      'La secuencia solo está definida para una línea mensual estándar por empleado.',
    );
  }

  const documentType = sourceText(employee?.tipoDocumento);
  const documentNumber = sourceText(employee?.cedula);
  if (
    !documentType ||
    !PILA_SUPPORTED_COTIZANTE_DOCUMENT_TYPES.has(documentType)
  ) {
    const reason =
      'El tipo de documento no tiene un mapeo aprobado para el MVP PILA; solo se admiten CC, CE, TI, PA y PC.';
    unresolved(3, reason);
    unresolved(4, reason);
  } else {
    put(3, documentType);
    if (!documentNumber) {
      unresolved(4, 'Falta el número de documento congelado en el snapshot.');
    } else if (
      !isValidPilaCotizanteIdentification(documentType, documentNumber)
    ) {
      unresolved(
        4,
        `El número de documento no cumple el formato admitido para ${documentType}; no se corrige ni se trunca.`,
      );
    } else {
      put(4, documentNumber);
    }
  }
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
        ? 'El snapshot v3 a v8 no conserva una lista válida de ubicaciones laborales PILA.'
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
      supportedCoverageStart,
      supportedCoverageEnd,
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
    if (affiliation?.indicadorTarifaEspecialPensiones === '') {
      blank(79);
    } else if (
      ['1', '2', '3', '4'].includes(
        sourceText(affiliation?.indicadorTarifaEspecialPensiones) ?? '',
      )
    ) {
      unresolved(
        79,
        'La tarifa especial de pensiones está registrada, pero las categorías especiales quedan fuera del MVP PILA dependiente 01/00.',
      );
    } else {
      unresolved(
        79,
        'Falta confirmar con soporte vigente que el cotizante usa la tarifa normal de pensiones.',
      );
    }
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
    for (const fieldNumber of [
      5, 6, 31, 32, 33, 34, 35, 74, 75, 76, 77, 78, 79,
    ]) {
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
  const expectedDayValue = standardIngressRetirementEmployee
    ? (frozenIngressRetirementDays as number)
    : standardRetirementEmployee
      ? (frozenRetirementDays as number)
      : standardNewHireEmployee
        ? (frozenEntryDays as number)
        : 30;
  const expectedDayRuleVersion = standardIngressRetirementEmployee
    ? PILA_AT2_V30_ING_RET_DAYS_RULE_VERSION
    : standardRetirementEmployee
      ? 'PILA_RET_DAYS_FROM_APPROVED_PAYROLL_V1'
      : standardNewHireEmployee
        ? 'PILA_ING_DAYS_FROM_APPROVED_PAYROLL_V1'
        : 'PILA_FULL_MONTH_DAYS_V1';
  for (const [fieldNumber, subsystem] of daySources) {
    const source = object(days?.[subsystem]);
    if (
      !hasVacLrEvent &&
      standardSupportedEmployee &&
      source !== null &&
      source?.valor === expectedDayValue &&
      source.reglaVersion === expectedDayRuleVersion &&
      hasNoBlockers(source)
    ) {
      put(fieldNumber, expectedDayValue);
    } else {
      unresolved(
        fieldNumber,
        hasVacLrEvent
          ? `El evento VAC-LR requiere días aprobados por subsistema; no se usa el valor genérico de ${subsystem}.`
          : `Faltan días aprobados y sin bloqueos para ${subsystem}.`,
      );
    }
  }
  const fullMonthPilaInputsApproved =
    standardFullMonthEmployee &&
    daySources.every(([, subsystem]) => {
      const source = object(days?.[subsystem]);
      return (
        source !== null &&
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
  const fullMonthVspPilaInputsApproved =
    standardFullMonthVspEmployee &&
    daySources.every(([, subsystem]) => {
      const source = object(days?.[subsystem]);
      return (
        source !== null &&
        source.valor === 30 &&
        source.reglaVersion === 'PILA_FULL_MONTH_DAYS_V1' &&
        hasNoBlockers(source)
      );
    });
  const newHirePilaInputsApproved =
    standardNewHireEmployee &&
    daySources.every(([, subsystem]) => {
      const source = object(days?.[subsystem]);
      return (
        source !== null &&
        source?.valor === frozenEntryDays &&
        source.reglaVersion === 'PILA_ING_DAYS_FROM_APPROVED_PAYROLL_V1' &&
        hasNoBlockers(source)
      );
    });
  const retirementPilaInputsApproved =
    standardRetirementEmployee &&
    daySources.every(([, subsystem]) => {
      const source = object(days?.[subsystem]);
      return (
        source !== null &&
        source?.valor === frozenRetirementDays &&
        source.reglaVersion === 'PILA_RET_DAYS_FROM_APPROVED_PAYROLL_V1' &&
        hasNoBlockers(source)
      );
    });
  const ingressRetirementPilaInputsApproved =
    standardIngressRetirementEmployee &&
    daySources.every(([, subsystem]) => {
      const source = object(days?.[subsystem]);
      return (
        source !== null &&
        source.valor === frozenIngressRetirementDays &&
        source.reglaVersion === PILA_AT2_V30_ING_RET_DAYS_RULE_VERSION &&
        hasNoBlockers(source)
      );
    });
  const pilaInputsApproved =
    fullMonthPilaInputsApproved ||
    fullMonthVspPilaInputsApproved ||
    newHirePilaInputsApproved ||
    retirementPilaInputsApproved ||
    ingressRetirementPilaInputsApproved;

  if (pilaInputsApproved) {
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
  } else if (fullMonthVspPilaInputsApproved && periodStart) {
    for (const fieldNumber of [
      15, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27, 29, 80, 81,
    ]) {
      blank(fieldNumber);
    }
    put(21, 'X');
    put(30, 0);
    put(82, periodStart);
    for (let fieldNumber = 83; fieldNumber <= 94; fieldNumber += 1) {
      blank(fieldNumber);
    }
  } else if (
    ingressRetirementPilaInputsApproved &&
    entryDate &&
    retirementDate
  ) {
    put(15, 'X');
    put(16, 'X');
    for (const fieldNumber of [17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 29]) {
      blank(fieldNumber);
    }
    put(30, 0);
    put(80, entryDate);
    put(81, retirementDate);
    for (let fieldNumber = 82; fieldNumber <= 94; fieldNumber += 1) {
      blank(fieldNumber);
    }
  } else if (newHirePilaInputsApproved && entryDate) {
    put(15, 'X');
    for (const fieldNumber of [
      16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 29,
    ]) {
      blank(fieldNumber);
    }
    put(30, 0);
    put(80, entryDate);
    for (let fieldNumber = 81; fieldNumber <= 94; fieldNumber += 1) {
      blank(fieldNumber);
    }
  } else if (retirementPilaInputsApproved && retirementDate) {
    blank(15);
    put(16, 'X');
    for (const fieldNumber of [17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 29]) {
      blank(fieldNumber);
    }
    put(30, 0);
    blank(80);
    put(81, retirementDate);
    for (let fieldNumber = 82; fieldNumber <= 94; fieldNumber += 1) {
      blank(fieldNumber);
    }
  } else if (approvedSingleVacLrEvent && vacationStart && vacationEnd) {
    for (const fieldNumber of [
      15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 29,
    ]) {
      blank(fieldNumber);
    }
    put(27, vacationSubtype === 'VACACIONES_DISFRUTADAS' ? 'X' : 'L');
    put(30, 0);
    for (let fieldNumber = 80; fieldNumber <= 88; fieldNumber += 1) {
      blank(fieldNumber);
    }
    put(89, vacationStart);
    put(90, vacationEnd);
    for (let fieldNumber = 91; fieldNumber <= 94; fieldNumber += 1) {
      blank(fieldNumber);
    }
  } else {
    const reason =
      'Este campo solo se propone para un dependiente 01/00 de mes completo, con eventos ING/RET admitidos y aprobados, sin otras novedades ni segmentos.';
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
  const subsystemBases = object(payroll?.ibcPorSubsistema);
  const field40ParafiscalBase = object(subsystemBases?.otrosParafiscales);
  const field40SubsystemsAgree = [
    'pension',
    'salud',
    'riesgos',
    'cajaCompensacion',
  ].every((subsystem) => {
    const source = object(subsystemBases?.[subsystem]);
    return (
      source?.sourceCount === 1 &&
      safeInteger(source.valor, 9) &&
      source.valor === salary?.valor
    );
  });
  const newHireField40Approved = Boolean(
    standardNewHireEmployee &&
    salary?.reglaVersion ===
      PILA_AT2_V30_NEW_HIRE_BASIC_SALARY_FIELD_40_RULE_VERSION &&
    safeInteger(salary.valor, 9) &&
    Array.isArray(salary.bloqueos) &&
    salary.bloqueos.length === 0 &&
    field40ParafiscalBase?.reglaVersion === 'CO_PARAFISCAL_BASE_V2' &&
    field40ParafiscalBase.sourceCount === 1 &&
    field40ParafiscalBase.valor === salary.valor &&
    hasNoBlockers(field40ParafiscalBase) &&
    field40SubsystemsAgree,
  );
  const retirementField40Approved = Boolean(
    standardRetirementEmployee &&
    salary?.reglaVersion ===
      PILA_AT2_V30_RETIREMENT_BASIC_SALARY_FIELD_40_RULE_VERSION &&
    safeInteger(salary.valor, 9) &&
    Array.isArray(salary.bloqueos) &&
    salary.bloqueos.length === 0 &&
    field40ParafiscalBase?.reglaVersion === 'CO_PARAFISCAL_BASE_V2' &&
    field40ParafiscalBase.sourceCount === 1 &&
    field40ParafiscalBase.valor === salary.valor &&
    hasNoBlockers(field40ParafiscalBase) &&
    field40SubsystemsAgree,
  );
  const ingressRetirementField40Approved = Boolean(
    standardIngressRetirementEmployee &&
    salary?.reglaVersion ===
      PILA_AT2_V30_ING_RET_BASIC_SALARY_FIELD_40_RULE_VERSION &&
    safeInteger(salary.valor, 9) &&
    Array.isArray(salary.bloqueos) &&
    salary.bloqueos.length === 0 &&
    field40ParafiscalBase?.reglaVersion === 'CO_PARAFISCAL_BASE_V2' &&
    field40ParafiscalBase.sourceCount === 1 &&
    field40ParafiscalBase.valor === salary.valor &&
    hasNoBlockers(field40ParafiscalBase) &&
    field40SubsystemsAgree,
  );
  const hasPilaEvents = Boolean(
    rootEventRows?.length || payrollEventRows?.length,
  );
  if (
    newHireField40Approved ||
    retirementField40Approved ||
    ingressRetirementField40Approved
  ) {
    put(40, salary?.valor as number);
  } else if (
    (snapshot.payloadVersion === 10 ||
      snapshot.payloadVersion === 11 ||
      snapshot.payloadVersion === 12 ||
      snapshot.payloadVersion === 13) &&
    hasPilaEvents &&
    !fullMonthVspPilaInputsApproved
  ) {
    unresolved(
      40,
      'Para ING y RET se requiere una base prorrateada aprobada; VSP solo se admite desde el primer día del mes con salario fijo e IBC de período completo aprobados.',
    );
  } else if (
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

  const baseSources = [
    [42, 'pension'],
    [43, 'salud'],
    [44, 'riesgos'],
    [45, 'cajaCompensacion'],
  ] as const;
  for (const [fieldNumber, subsystem] of baseSources) {
    const source = object(subsystemBases?.[subsystem]);
    if (
      !hasVacLrEvent &&
      source?.sourceCount === 1 &&
      safeInteger(source.valor, 9)
    ) {
      put(fieldNumber, source.valor);
    } else {
      unresolved(
        fieldNumber,
        hasVacLrEvent
          ? `El evento VAC-LR requiere IBC aprobado por subsistema; no se usa el IBC genérico de ${subsystem}.`
          : `Falta una fuente única y válida de IBC para ${subsystem}.`,
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
      supportedCoverageStart,
      supportedCoverageEnd,
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
    !hasVacLrEvent &&
    (otherParafiscalBase?.reglaVersion === 'CO_PARAFISCAL_BASE_V1' ||
      ((standardNewHireEmployee ||
        standardRetirementEmployee ||
        standardIngressRetirementEmployee) &&
        otherParafiscalBase?.reglaVersion === 'CO_PARAFISCAL_BASE_V2')) &&
    safeInteger(otherParafiscalBase.valor, 9) &&
    hasNoBlockers(otherParafiscalBase)
  ) {
    put(95, otherParafiscalBase.valor);
  } else {
    unresolved(
      95,
      'Falta una base parafiscal congelada con una regla admitida para el escenario y sin bloqueos.',
    );
  }
  let optionalHoursField96RuleVersion:
    | typeof PILA_AT2_V30_OPTIONAL_HOURS_FIELD_96_RULE_VERSION
    | null = null;
  if (standardAffiliation) {
    // AT2 v30 makes hours optional for cotizante 01; no hours are invented.
    values[96] = { value: null, emptyAs: 'spaces' };
    optionalHoursField96RuleVersion =
      PILA_AT2_V30_OPTIONAL_HOURS_FIELD_96_RULE_VERSION;
  } else {
    unresolved(
      96,
      'El campo de horas solo se omite en el MVP para una afiliación dependiente estándar 01/00.',
    );
  }

  let noForeignResidenceDateField97RuleVersion:
    | typeof PILA_AT2_V30_NO_FOREIGN_RESIDENCE_FIELD_97_RULE_VERSION
    | null = null;
  const employeeDocumentType = sourceText(employee?.tipoDocumento);
  if (
    standardAffiliation &&
    (employeeDocumentType === 'CC' || employeeDocumentType === 'TI') &&
    affiliation?.colombianoEnElExterior === false
  ) {
    blank(97);
    noForeignResidenceDateField97RuleVersion =
      PILA_AT2_V30_NO_FOREIGN_RESIDENCE_FIELD_97_RULE_VERSION;
  } else {
    unresolved(
      97,
      affiliation?.colombianoEnElExterior === true
        ? 'El campo 97 es obligatorio cuando el campo 8 indica colombiano en el exterior; falta la fecha de radicación congelada.'
        : 'Se requiere confirmar explícitamente que el trabajador CC/TI no reporta residencia en el exterior para dejar el campo 97 vacío.',
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
    if (!pilaInputsApproved) {
      unresolved(
        input.fieldNumber,
        'El importe candidato requiere un mes completo o un ingreso único con días aprobados y sin otras novedades.',
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
  if (!standardSupportedEmployee) {
    pensionCandidateBlockReason =
      'La tarifa pensional candidata requiere un dependiente 01/00 con cobertura completa o ingreso único aprobado.';
  } else if (!pilaInputsApproved) {
    pensionCandidateBlockReason =
      'El candidato pensional requiere días aprobados y ausencia de novedades distintas al ingreso único soportado.';
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
  } else if (affiliation?.indicadorTarifaEspecialPensiones !== '') {
    pensionCandidateBlockReason = ['1', '2', '3', '4'].includes(
      sourceText(affiliation?.indicadorTarifaEspecialPensiones) ?? '',
    )
      ? 'La tarifa especial de pensiones registrada está fuera del MVP; no se aplican tarifas estándar de 16 %.'
      : 'Falta confirmar con soporte vigente la tarifa normal de pensiones; no se presume el 16 %.';
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

  const fspSubaccounts = object(payroll?.fspSubaccounts);
  if (snapshot.payloadVersion === null || snapshot.payloadVersion < 6) {
    unresolved(
      51,
      'El aporte de solidaridad requiere agregar el IBC pensional por cotizante y validar su obligación; el snapshot no conserva esa base agregada ni una fuente separada de esta subcuenta.',
    );
    unresolved(
      52,
      'El aporte de subsistencia requiere la base pensional agregada y validar la regla vigente por régimen; Payroll no conserva una fuente separada de esta subcuenta.',
    );
  } else {
    const fspSubaccountBlockReason = (() => {
      if (!standardSupportedEmployee || !pilaInputsApproved) {
        return 'Las subcuentas FSP requieren dependiente 01/00, días aprobados y ausencia de novedades distintas al ingreso único soportado.';
      }
      if (
        !pensionBase ||
        pensionBase.sourceCount !== 1 ||
        !safeInteger(pensionBase.valor, 9)
      ) {
        return 'Falta una fuente única y válida de IBC pensional en el snapshot.';
      }
      if (!fspSubaccounts) {
        return 'El snapshot PILA no conserva la evaluación de las subcuentas FSP.';
      }
      if (fspSubaccounts.sourceScope !== 'SINGLE_SOURCE_CONFIRMED') {
        return (
          sourceText(fspSubaccounts.blocker) ??
          'Falta confirmar que el alcance de ingresos pensionales de este cotizante sea una fuente única.'
        );
      }
      if (
        typeof fspSubaccounts.sourceScopeUpdatedAt !== 'string' ||
        Number.isNaN(Date.parse(fspSubaccounts.sourceScopeUpdatedAt)) ||
        sourceText(fspSubaccounts.sourceScopeUpdatedById) === null
      ) {
        return 'La confirmación de fuente única no conserva actor y fecha de declaración.';
      }
      if (
        fspSubaccounts.status !== 'READY' ||
        fspSubaccounts.blocker !== null
      ) {
        return (
          sourceText(fspSubaccounts.blocker) ??
          'La evaluación de subcuentas FSP no está aprobada para este snapshot.'
        );
      }
      const paymentDate = calendarDate(payroll?.fechaPrevistaPagoPila);
      if (
        periodStart >= PILA_FSP_NEW_SYSTEM_EFFECTIVE_FROM ||
        periodEnd >= PILA_FSP_NEW_SYSTEM_EFFECTIVE_FROM ||
        paymentDate === null ||
        paymentDate >= PILA_FSP_NEW_SYSTEM_EFFECTIVE_FROM
      ) {
        return 'El período o la fecha prevista de pago alcanza el 2027-04-01; falta versionar las reglas del nuevo sistema pensional.';
      }
      const ibc = pensionBase.valor;
      const smmlv = fspSubaccounts.smmlv;
      const solidarityAmount = fspSubaccounts.solidaridad;
      const subsistenceAmount = fspSubaccounts.subsistencia;
      const payrollFspAmount = fspSubaccounts.payrollFspAmount;
      if (
        fspSubaccounts.ruleVersion !== PILA_FSP_SUBACCOUNT_RULE_VERSION ||
        fspSubaccounts.roundingRuleVersion !==
          PILA_CONTRIBUTION_ROUNDING_RULE_VERSION ||
        fspSubaccounts.ibcPensionalAgregado !== ibc ||
        !safeInteger(smmlv, 9) ||
        smmlv <= 0 ||
        !safeInteger(solidarityAmount, 9) ||
        !safeInteger(subsistenceAmount, 9) ||
        !safeInteger(payrollFspAmount, 9)
      ) {
        return 'La base, las reglas versionadas o los importes separados del FSP no son válidos.';
      }

      const rates = getFspSubaccountRates(ibc, smmlv);
      const fspRows = contributionConcepts?.filter(
        (concept) => concept.codigo === 'FSP',
      );
      const fspConcept = fspRows?.length === 1 ? fspRows[0] : null;
      const conceptMatches =
        rates.totalBps === 0
          ? (fspRows?.length ?? 0) === 0 && payrollFspAmount === 0
          : fspRows?.length === 1 &&
            fspConcept?.tipo === 'DEDUCTION' &&
            fspConcept.base === ibc &&
            typeof fspConcept.factor === 'number' &&
            Math.abs(fspConcept.factor - rates.totalBps / 10_000) < 1e-9 &&
            fspConcept.valor === payrollFspAmount;
      const subaccountsMatch =
        solidarityAmount + subsistenceAmount === payrollFspAmount &&
        isPilaContributionAmountRoundedUpToHundred(
          periodStart,
          ibc,
          rates.solidarityBps,
          10_000,
          solidarityAmount,
        ) &&
        isPilaContributionAmountRoundedUpToHundred(
          periodStart,
          ibc,
          rates.subsistenceBps,
          10_000,
          subsistenceAmount,
        );
      if (!conceptMatches || !subaccountsMatch) {
        return 'El total de las subcuentas no concilia con el concepto FSP congelado en nómina; no se ajustan importes aprobados.';
      }
      return null;
    })();

    if (fspSubaccountBlockReason) {
      unresolved(51, fspSubaccountBlockReason);
      unresolved(52, fspSubaccountBlockReason);
    } else {
      put(51, fspSubaccounts!.solidaridad as number);
      put(52, fspSubaccounts!.subsistencia as number);
    }
  }
  let voluntaryPensionDeclarationRuleVersion:
    | typeof PILA_AT2_V30_VOLUNTARY_PENSION_DECLARATION_RULE_VERSION
    | null = null;
  const voluntaryPensionDeclaration = object(
    payroll?.voluntaryPensionDeclaration,
  );
  const declarationStatus = sourceText(voluntaryPensionDeclaration?.status);
  const declarationDate = sourceText(voluntaryPensionDeclaration?.declaredAt);
  const declarationActor = sourceText(
    voluntaryPensionDeclaration?.declaredById,
  );
  const declarationHasAuditEvidence =
    declarationDate !== null &&
    !Number.isNaN(Date.parse(declarationDate)) &&
    declarationActor !== null;
  const voluntaryPensionFields = [28, 48, 49, 53] as const;
  if (scope.planillaType !== 'E') {
    const reason =
      'El MVP solo mapea aportes voluntarios para planilla E; otros tipos de planilla no están soportados.';
    for (const fieldNumber of voluntaryPensionFields) {
      unresolved(fieldNumber, reason);
    }
  } else if (periodEnd < periodStart) {
    const reason =
      'El período PILA tiene un intervalo invertido; no se pueden validar los campos de aportes voluntarios.';
    for (const fieldNumber of voluntaryPensionFields) {
      unresolved(fieldNumber, reason);
    }
  } else if (
    !standardSupportedEmployee ||
    !pilaInputsApproved ||
    !standardAffiliation
  ) {
    const reason =
      'Los campos de aportes voluntarios requieren dependiente 01/00, afiliación vigente y ausencia de novedades distintas al ingreso único soportado.';
    for (const fieldNumber of voluntaryPensionFields) {
      unresolved(fieldNumber, reason);
    }
  } else {
    const paymentDate = calendarDate(payroll?.fechaPrevistaPagoPila);
    if (
      periodStart >= PILA_AT2_V30_NEW_PENSION_SYSTEM_EFFECTIVE_FROM ||
      periodEnd >= PILA_AT2_V30_NEW_PENSION_SYSTEM_EFFECTIVE_FROM ||
      paymentDate === null ||
      paymentDate >= PILA_AT2_V30_NEW_PENSION_SYSTEM_EFFECTIVE_FROM
    ) {
      const reason =
        'El período o la fecha prevista de pago alcanza el 2027-04-01; falta revisar la versión PILA aplicable al nuevo sistema pensional.';
      for (const fieldNumber of voluntaryPensionFields) {
        unresolved(fieldNumber, reason);
      }
    } else if (
      snapshot.payloadVersion !== 8 &&
      snapshot.payloadVersion !== 9 &&
      snapshot.payloadVersion !== 10 &&
      snapshot.payloadVersion !== 11 &&
      snapshot.payloadVersion !== 12 &&
      snapshot.payloadVersion !== 13
    ) {
      const reason =
        'El snapshot PILA histórico anterior a v8 no conserva una declaración AVP compatible y no se completa con datos actuales.';
      for (const fieldNumber of voluntaryPensionFields) {
        unresolved(fieldNumber, reason);
      }
    } else if (declarationStatus === 'PRESENT') {
      const reason =
        'La nómina declara aportes voluntarios, pero el MVP aún no captura sus importes ni la fuente para calcular el campo 53.';
      for (const fieldNumber of voluntaryPensionFields) {
        unresolved(fieldNumber, reason);
      }
    } else if (
      declarationStatus !== 'NONE_CONFIRMED' ||
      !declarationHasAuditEvidence
    ) {
      const reason =
        'Falta confirmar y auditar que ni el afiliado ni el aportante realizaron aportes voluntarios en este período; no se infiere su ausencia.';
      for (const fieldNumber of voluntaryPensionFields) {
        unresolved(fieldNumber, reason);
      }
    } else {
      blank(28);
      put(48, 0);
      put(49, 0);
      // AT2 permits field 53 only when field 28 is X; with no AVP it stays blank.
      blank(53);
      voluntaryPensionDeclarationRuleVersion =
        PILA_AT2_V30_VOLUNTARY_PENSION_DECLARATION_RULE_VERSION;
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
  if (!standardSupportedEmployee || !pilaInputsApproved) {
    healthRateBlockReason =
      'La tarifa de salud requiere un dependiente 01/00, días aprobados y ausencia de novedades distintas al ingreso único soportado.';
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
  if (!standardSupportedEmployee) {
    parafiscalRateBlockReason =
      'Las tarifas SENA e ICBF requieren un dependiente 01/00 con cobertura completa o ingreso único aprobado.';
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
  const expectedParafiscalBaseRuleVersion =
    standardNewHireEmployee ||
    standardRetirementEmployee ||
    standardIngressRetirementEmployee
      ? 'CO_PARAFISCAL_BASE_V2'
      : 'CO_PARAFISCAL_BASE_V1';
  const parafiscalBase =
    otherParafiscalBase?.reglaVersion === expectedParafiscalBaseRuleVersion &&
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
  if (!standardSupportedEmployee) {
    ccfRateBlockReason =
      'La tarifa CCF requiere un dependiente 01/00 con cobertura completa o ingreso único aprobado.';
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
      normalPensionTariffField79:
        standardAffiliation &&
        affiliation?.indicadorTarifaEspecialPensiones === ''
          ? PILA_AT2_V30_NORMAL_PENSION_TARIFF_FIELD_79_RULE_VERSION
          : null,
      voluntaryPensionDeclaration: voluntaryPensionDeclarationRuleVersion,
      arlInitialRate: arlRateByClass
        ? PILA_ARL_INITIAL_RATE_RULE_VERSION
        : null,
      contributionRounding: getPilaContributionRoundingRuleVersion(periodStart),
      ccfRate: getPilaCcfStandardRate(periodStart)?.ruleVersion ?? null,
      senaRate: senaStandardRate?.ruleVersion ?? null,
      icbfRate: icbfStandardRate?.ruleVersion ?? null,
      pensionRate: pensionStandardRate?.ruleVersion ?? null,
      healthRate: healthStandardRate?.ruleVersion ?? null,
      fspSubaccounts:
        object(payroll?.fspSubaccounts)?.ruleVersion ===
        PILA_FSP_SUBACCOUNT_RULE_VERSION
          ? PILA_FSP_SUBACCOUNT_RULE_VERSION
          : null,
      noBenefitEventFields: pilaInputsApproved
        ? PILA_AT2_V30_NO_BENEFIT_EVENT_FIELDS_RULE_VERSION
        : null,
      noEventNoveltyFields: fullMonthPilaInputsApproved
        ? PILA_AT2_V30_NO_EVENT_NOVELTY_FIELDS_RULE_VERSION
        : null,
      newHireIngressFields: newHirePilaInputsApproved
        ? PILA_AT2_V30_NEW_HIRE_INGRESS_FIELDS_RULE_VERSION
        : null,
      newHireBasicSalaryField40: newHireField40Approved
        ? PILA_AT2_V30_NEW_HIRE_BASIC_SALARY_FIELD_40_RULE_VERSION
        : null,
      retirementEventFields: retirementPilaInputsApproved
        ? PILA_AT2_V30_RETIREMENT_EVENT_FIELDS_RULE_VERSION
        : null,
      retirementBasicSalaryField40: retirementField40Approved
        ? PILA_AT2_V30_RETIREMENT_BASIC_SALARY_FIELD_40_RULE_VERSION
        : null,
      samePeriodIngressRetirementFields: ingressRetirementPilaInputsApproved
        ? PILA_AT2_V30_ING_RET_FIELDS_RULE_VERSION
        : null,
      ingressRetirementBasicSalaryField40: ingressRetirementField40Approved
        ? PILA_AT2_V30_ING_RET_BASIC_SALARY_FIELD_40_RULE_VERSION
        : null,
      vspEventFields: fullMonthVspPilaInputsApproved
        ? PILA_AT2_V30_SINGLE_FULL_MONTH_VSP_FIELDS_RULE_VERSION
        : null,
      vacLrEventFields: approvedSingleVacLrEvent
        ? PILA_AT2_V30_VAC_LR_EVENT_FIELDS_RULE_VERSION
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
      optionalHoursField96: optionalHoursField96RuleVersion,
      noForeignResidenceDateField97: noForeignResidenceDateField97RuleVersion,
      detailRecordSequence: null,
    },
    values,
    unresolvedFields,
  };
}
