import type { PilaAt2V30FieldInput } from './pila-at2-v30-record-serializer';
import { mapPilaAt2V30EmployerCandidate } from './pila-at2-v30-employer-mapper';
import type { PilaSnapshotPreparationInput } from './pila-preparation';

type JsonRecord = Record<string, unknown>;

export interface PilaAt2V30HeaderCandidate {
  formatVersion: 'AT2_V30';
  supportedSnapshots: boolean;
  tenantId: string | null;
  payrollPeriodId: string | null;
  payrollRunId: string | null;
  snapshotCountMatchesExpected: boolean;
  values: Partial<Record<number, PilaAt2V30FieldInput>>;
  unresolvedFields: Array<{ fieldNumber: number; reason: string }>;
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
 * accepts snapshot payloads from one tenant, payroll period, and payroll run.
 * The caller must supply the approved run's expected snapshot count; totals
 * remain unresolved when it does not match. This function cannot establish
 * approval from payloads alone and does not serialize a record.
 */
export function mapPilaAt2V30HeaderCandidate(input: {
  snapshots: readonly PilaSnapshotPreparationInput[];
  expectedApprovedSnapshotCount: number;
}): PilaAt2V30HeaderCandidate {
  const values: Partial<Record<number, PilaAt2V30FieldInput>> = {};
  const unresolvedFields: Array<{ fieldNumber: number; reason: string }> = [];
  const unresolved = (fieldNumber: number, reason: string) => {
    if (!unresolvedFields.some((field) => field.fieldNumber === fieldNumber)) {
      unresolvedFields.push({ fieldNumber, reason });
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
      payroll,
      affiliations,
      ccfBase,
      payrollRunId: text(payroll?.payrollRunId),
      tenantId: text(employer?.tenantId),
      payrollPeriodId: text(period?.payrollPeriodId),
      periodStart: calendarDate(period?.fechaInicio),
      periodEnd: calendarDate(period?.fechaFin),
    };
  });

  const tenantIds = new Set(parsed.map((item) => item.tenantId));
  const payrollPeriodIds = new Set(parsed.map((item) => item.payrollPeriodId));
  const payrollRunIds = new Set(parsed.map((item) => item.payrollRunId));
  const periodRanges = new Set(
    parsed.map((item) => `${item.periodStart ?? ''}:${item.periodEnd ?? ''}`),
  );
  const snapshotCountMatchesExpected =
    Number.isSafeInteger(input.expectedApprovedSnapshotCount) &&
    input.expectedApprovedSnapshotCount >= 0 &&
    input.expectedApprovedSnapshotCount === parsed.length;
  const supportedSnapshots =
    parsed.length > 0 &&
    parsed.every(
      ({ snapshot, root, employer, employerPila, employee, period, payroll }) =>
        snapshot.payloadVersion === 2 &&
        root?.schemaVersion === 2 &&
        employer !== null &&
        employerPila !== null &&
        employee !== null &&
        period !== null &&
        text(employee.employeeId) === snapshot.employeeId &&
        text(employer.tenantId) !== null &&
        text(period.payrollPeriodId) !== null &&
        payroll !== null &&
        text(payroll.payrollRunId) !== null &&
        calendarDate(period.fechaInicio) !== null &&
        calendarDate(period.fechaFin) !== null,
    ) &&
    tenantIds.size === 1 &&
    payrollPeriodIds.size === 1 &&
    payrollRunIds.size === 1 &&
    periodRanges.size === 1;
  const tenantId = tenantIds.size === 1 ? (parsed[0]?.tenantId ?? null) : null;
  const payrollPeriodId =
    payrollPeriodIds.size === 1 ? (parsed[0]?.payrollPeriodId ?? null) : null;
  const payrollRunId =
    payrollRunIds.size === 1 ? (parsed[0]?.payrollRunId ?? null) : null;

  if (!supportedSnapshots) {
    for (let fieldNumber = 1; fieldNumber <= 22; fieldNumber += 1) {
      unresolved(
        fieldNumber,
        'Se requiere un conjunto de snapshots PILA v2 del mismo tenant, período y ejecución de nómina.',
      );
    }
    return {
      formatVersion: 'AT2_V30',
      supportedSnapshots: false,
      tenantId,
      payrollPeriodId,
      payrollRunId,
      snapshotCountMatchesExpected,
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
      payrollRunId,
      snapshotCountMatchesExpected,
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
  unresolved(2, 'AT2 asigna la modalidad de planilla al operador.');
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

  unresolved(15, 'AT2 asigna este período de pago al operador.');
  if (isFullCalendarMonth) {
    put(16, periodStart.slice(0, 7));
  } else {
    unresolved(16, 'El snapshot no cubre un mes calendario completo.');
  }
  unresolved(17, 'El número de radicación lo asigna el operador.');
  unresolved(18, 'La fecha de pago efectiva la asigna el operador.');

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
  } else if (
    !snapshotCountMatchesExpected ||
    !isFullCalendarMonth ||
    !standardContributorSnapshots
  ) {
    unresolved(
      19,
      !snapshotCountMatchesExpected
        ? 'El conjunto no coincide con el número de snapshots aprobadas esperado para la ejecución.'
        : 'El conjunto debe contener una afiliación dependiente 01/00 que cubra el período por empleado.',
    );
    unresolved(
      20,
      !snapshotCountMatchesExpected
        ? 'El conjunto no coincide con el número de snapshots aprobadas esperado para la ejecución.'
        : 'Solo se calcula el candidato CCF para el escenario dependiente estándar 01/00.',
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
  unresolved(22, 'AT2 asigna el código del operador al sistema del operador.');

  return {
    formatVersion: 'AT2_V30',
    supportedSnapshots: true,
    tenantId,
    payrollPeriodId,
    payrollRunId,
    snapshotCountMatchesExpected,
    values,
    unresolvedFields,
  };
}
