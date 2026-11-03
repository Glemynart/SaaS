import type { PilaAt2V30FieldInput } from './pila-at2-v30-record-serializer';
import { mapPilaAt2V30EmployerCandidate } from './pila-at2-v30-employer-mapper';
import type { PilaSnapshotPreparationInput } from './pila-preparation';

type JsonRecord = Record<string, unknown>;

export interface PilaAt2V30HeaderCandidate {
  formatVersion: 'AT2_V30';
  supportedSnapshots: boolean;
  tenantId: string | null;
  payrollPeriodId: string | null;
  values: Partial<Record<number, PilaAt2V30FieldInput>>;
  unresolvedFields: Array<{
    fieldNumber: number;
    code: string;
    reason: string;
  }>;
}

function object(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim().length > 0 ? value : null;
}

function calendarDate(value: unknown): string | null {
  const normalized = text(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === normalized
    ? normalized
    : null;
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
 * Maps candidate type 2 header fields from one snapshot set. It only
 * accepts snapshots matching the authenticated tenant and approved period,
 * refuses totals if a contributor is duplicated or outside the standard MVP,
 * and represents operator-assigned fields as explicit blank-position
 * candidates. It does not serialize a record or establish operator acceptance.
 */
export function mapPilaAt2V30HeaderCandidate(input: {
  expectedTenantId: string | null;
  period: {
    id: string;
    fechaInicio: Date;
    fechaFin: Date;
  };
  snapshots: readonly PilaSnapshotPreparationInput[];
}): PilaAt2V30HeaderCandidate {
  const values: Partial<Record<number, PilaAt2V30FieldInput>> = {};
  const unresolvedFields: Array<{
    fieldNumber: number;
    code: string;
    reason: string;
  }> = [];
  const unresolved = (
    fieldNumber: number,
    reason: string,
    code = 'AT2_HEADER_FIELD_UNRESOLVED',
  ) => {
    if (!unresolvedFields.some((field) => field.fieldNumber === fieldNumber)) {
      unresolvedFields.push({ fieldNumber, code, reason });
    }
  };
  const put = (fieldNumber: number, value: string | number) => {
    values[fieldNumber] = { value };
  };
  const putBlank = (fieldNumber: number) => {
    values[fieldNumber] = { value: null, emptyAs: 'spaces' };
  };

  const parsed = input.snapshots.map((snapshot) => {
    const root = object(snapshot.payload);
    const employer = object(root?.employer);
    const employee = object(root?.employee);
    const period = object(root?.period);
    const employerPila = object(employer?.pila);
    const affiliations = Array.isArray(root?.affiliations)
      ? root.affiliations.map(object)
      : null;
    const payroll = object(root?.payroll);
    const subsystemBases = object(payroll?.ibcPorSubsistema);
    const ccfBase = object(subsystemBases?.cajaCompensacion)?.valor;
    return {
      snapshot,
      root,
      employer,
      employerPila,
      employee,
      period,
      affiliations,
      ccfBase,
      tenantId: text(employer?.tenantId),
      payrollPeriodId: text(period?.payrollPeriodId),
      periodStart: calendarDate(period?.fechaInicio),
      periodEnd: calendarDate(period?.fechaFin),
    };
  });

  const tenantIds = new Set(parsed.map((item) => item.tenantId));
  const payrollPeriodIds = new Set(parsed.map((item) => item.payrollPeriodId));
  const periodRanges = new Set(
    parsed.map((item) => `${item.periodStart ?? ''}:${item.periodEnd ?? ''}`),
  );
  const expectedStart = Number.isNaN(input.period.fechaInicio.getTime())
    ? null
    : input.period.fechaInicio.toISOString().slice(0, 10);
  const expectedEnd = Number.isNaN(input.period.fechaFin.getTime())
    ? null
    : input.period.fechaFin.toISOString().slice(0, 10);
  const expectedTenantId = text(input.expectedTenantId);
  const matchesApprovedScope =
    expectedTenantId !== null &&
    expectedStart !== null &&
    expectedEnd !== null &&
    parsed.every(
      ({ tenantId, payrollPeriodId, periodStart, periodEnd }) =>
        tenantId === expectedTenantId &&
        payrollPeriodId === input.period.id &&
        periodStart === expectedStart &&
        periodEnd === expectedEnd,
    );
  const supportedSnapshots =
    parsed.length > 0 &&
    parsed.every(
      ({ snapshot, root, employer, employerPila, employee, period }) =>
        (snapshot.payloadVersion === 2 || snapshot.payloadVersion === 3) &&
        root?.schemaVersion === snapshot.payloadVersion &&
        employer !== null &&
        employerPila !== null &&
        employee !== null &&
        period !== null &&
        text(employee.employeeId) === snapshot.employeeId &&
        text(employer.tenantId) !== null &&
        text(period.payrollPeriodId) !== null &&
        calendarDate(period.fechaInicio) !== null &&
        calendarDate(period.fechaFin) !== null,
    ) &&
    tenantIds.size === 1 &&
    payrollPeriodIds.size === 1 &&
    periodRanges.size === 1 &&
    matchesApprovedScope;
  const tenantId = supportedSnapshots ? expectedTenantId : null;
  const payrollPeriodId = supportedSnapshots ? input.period.id : null;

  if (!supportedSnapshots) {
    const reason = expectedTenantId
      ? 'Se requiere un conjunto de snapshots PILA v2 que coincida con el tenant autenticado y el período aprobado.'
      : 'Falta el contexto del tenant autenticado para revisar la cabecera PILA.';
    for (let fieldNumber = 1; fieldNumber <= 22; fieldNumber += 1) {
      unresolved(fieldNumber, reason);
    }
    return {
      formatVersion: 'AT2_V30',
      supportedSnapshots: false,
      tenantId,
      payrollPeriodId,
      values,
      unresolvedFields,
    };
  }

  const firstSnapshot = parsed[0];
  if (!firstSnapshot?.periodStart || !firstSnapshot.periodEnd) {
    for (let fieldNumber = 1; fieldNumber <= 22; fieldNumber += 1) {
      unresolved(
        fieldNumber,
        'Falta el período congelado en el primer snapshot.',
      );
    }
    return {
      formatVersion: 'AT2_V30',
      supportedSnapshots: false,
      tenantId,
      payrollPeriodId,
      values,
      unresolvedFields,
    };
  }
  const periodStart = firstSnapshot.periodStart;
  const periodEnd = firstSnapshot.periodEnd;
  const isFullCalendarMonth = fullCalendarMonth(periodStart, periodEnd);
  const employerCandidates = parsed.map(({ snapshot }) =>
    mapPilaAt2V30EmployerCandidate(snapshot),
  );

  put(1, '01');
  putBlank(2);
  put(3, '1');
  const mapSharedEmployerField = (
    headerField: number,
    employerField: number,
  ) => {
    const candidates = employerCandidates.map(
      (candidate) => candidate.values[employerField],
    );
    const first = candidates[0];
    if (
      first &&
      candidates.every(
        (candidate) =>
          candidate !== undefined &&
          candidate.value === first.value &&
          candidate.emptyAs === first.emptyAs,
      )
    ) {
      values[headerField] = { ...first };
    } else {
      unresolved(
        headerField,
        'El campo de aportante correspondiente falta o no coincide entre snapshots.',
      );
    }
  };

  mapSharedEmployerField(4, 1);
  mapSharedEmployerField(5, 2);
  mapSharedEmployerField(6, 3);
  mapSharedEmployerField(7, 4);
  put(8, 'E');
  putBlank(9);
  putBlank(10);
  mapSharedEmployerField(11, 10);
  mapSharedEmployerField(12, 5);
  mapSharedEmployerField(13, 6);

  const employerArlCodes = parsed.map(({ employerPila }) =>
    text(employerPila?.codigoArlAportante),
  );
  const employerArlCode = employerArlCodes[0];
  if (
    employerArlCode &&
    employerArlCodes.every((code) => code === employerArlCode)
  ) {
    put(14, employerArlCode);
  } else {
    unresolved(14, 'Falta un código ARL del aportante único y congelado.');
  }

  putBlank(15);
  if (isFullCalendarMonth) {
    put(16, periodStart.slice(0, 7));
  } else {
    unresolved(16, 'El snapshot no cubre un mes calendario completo.');
  }
  putBlank(17);
  putBlank(18);

  const employeeIds = parsed.map(({ snapshot }) => snapshot.employeeId);
  const duplicateEmployees = new Set(employeeIds).size !== employeeIds.length;
  const standardContributorSnapshots = parsed.every(({ affiliations }) => {
    if (!affiliations || affiliations.length !== 1 || !affiliations[0]) {
      return false;
    }
    const affiliation = affiliations[0];
    const affiliationStart = calendarDate(affiliation.vigenteDesde);
    const affiliationEnd =
      affiliation.vigenteHasta === null
        ? null
        : calendarDate(affiliation.vigenteHasta);
    return (
      text(affiliation.tipoCotizanteCodigo) === '01' &&
      text(affiliation.subtipoCotizanteCodigo) === '00' &&
      affiliationStart !== null &&
      affiliationStart <= periodStart &&
      (affiliation.vigenteHasta === null ||
        (affiliationEnd !== null && affiliationEnd >= periodEnd))
    );
  });

  if (duplicateEmployees) {
    unresolved(
      19,
      'Hay más de un snapshot para un empleado; no se escoge una versión automáticamente.',
    );
    unresolved(
      20,
      'Hay más de un snapshot para un empleado; no se suma un IBC duplicado.',
    );
  } else if (!isFullCalendarMonth || !standardContributorSnapshots) {
    unresolved(
      19,
      'El conjunto debe contener una afiliación dependiente 01/00 que cubra el período por empleado.',
    );
    unresolved(
      20,
      'Solo se calcula el candidato CCF para el escenario dependiente estándar 01/00.',
    );
  } else {
    if (employeeIds.length <= 99_999) {
      put(19, employeeIds.length);
    } else {
      unresolved(19, 'El conteo de cotizantes excede el ancho AT2 N5.');
    }
    const ccfBases = parsed.map(({ ccfBase }) => ccfBase);
    if (
      ccfBases.every(
        (value) =>
          typeof value === 'number' &&
          Number.isSafeInteger(value) &&
          value >= 0 &&
          String(value).length <= 9,
      )
    ) {
      const totalCcfIbc = (ccfBases as number[]).reduce(
        (total, value) => total + value,
        0,
      );
      if (
        Number.isSafeInteger(totalCcfIbc) &&
        String(totalCcfIbc).length <= 12
      ) {
        put(20, totalCcfIbc);
      } else {
        unresolved(
          20,
          'La suma candidata del IBC CCF excede el ancho AT2 N12.',
          'AT2_HEADER_CCF_IBC_TOTAL_SUPERA_LONGITUD',
        );
      }
    } else {
      unresolved(
        20,
        'Falta un IBC CCF numérico y congelado para cada cotizante incluido.',
      );
    }
  }

  mapSharedEmployerField(21, 30);
  putBlank(22);

  return {
    formatVersion: 'AT2_V30',
    supportedSnapshots: true,
    tenantId,
    payrollPeriodId,
    values,
    unresolvedFields,
  };
}
