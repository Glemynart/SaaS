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
import type { PilaSnapshotPreparationInput } from './pila-preparation';

type JsonRecord = Record<string, unknown>;

export interface PilaAt2V30DetailCandidate {
  formatVersion: typeof PILA_AT2_V30_FORMAT_VERSION;
  supportedSnapshot: boolean;
  employeeId: string;
  tenantId: string | null;
  payrollPeriodId: string | null;
  normativeRuleVersions: {
    arlInitialRate: typeof PILA_ARL_INITIAL_RATE_RULE_VERSION | null;
  };
  values: Partial<Record<number, PilaAt2V30FieldInput>>;
  unresolvedFields: Array<{ fieldNumber: number; reason: string }>;
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
  const supportedSnapshot =
    snapshot.payloadVersion === 2 &&
    root?.schemaVersion === 2 &&
    employee !== null &&
    employer !== null &&
    employerPila !== null &&
    period !== null &&
    tenantId !== null &&
    payrollPeriodId !== null &&
    periodStart !== null &&
    periodEnd !== null &&
    sourceText(employee.employeeId) === snapshot.employeeId;

  if (!supportedSnapshot || !periodStart || !periodEnd) {
    for (const field of PILA_AT2_V30_RECORD_LAYOUTS.contributorDetailType2
      .fields) {
      unresolved(
        field.fieldNumber,
        'Se requiere un snapshot PILA v2 válido y atribuible a un tenant y período.',
      );
    }
    return {
      formatVersion: PILA_AT2_V30_FORMAT_VERSION,
      supportedSnapshot: false,
      employeeId: snapshot.employeeId,
      tenantId,
      payrollPeriodId,
      normativeRuleVersions: { arlInitialRate: null },
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
      unresolved(7, 'Falta un tipo de documento soportado para el campo 7.');
      unresolved(8, 'Falta un tipo de documento soportado para el campo 8.');
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
    putText(33, affiliation?.epsCodigo, 'la EPS');
    putText(35, affiliation?.cajaCompensacionCodigo, 'la caja de compensación');
    putText(77, affiliation?.arlCodigo, 'la ARL del cotizante');
    putText(78, affiliation?.arlClaseRiesgo, 'la clase de riesgo afiliada');
  } else {
    for (const fieldNumber of [5, 6, 31, 33, 35, 77, 78]) {
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

  const contributionConcepts = objectRows(payroll?.concepts);
  const mapContributionAmountCandidate = (input: {
    fieldNumber: number;
    code: string;
    base: JsonRecord | null;
    requireExplicitNonExemption?: boolean;
    expectedFactor?: number | null;
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
        'No hay una tarifa ARL versionada aplicable a la clase de riesgo y al período congelados.',
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
      concept.tipo !== 'EMPLOYER_CONTRIBUTION' ||
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
        'El factor ARL del snapshot no coincide con la tarifa inicial versionada para la clase de riesgo congelada.',
      );
      return null;
    }
    put(input.fieldNumber, concept.valor);
    return concept;
  };

  const arlConcept = mapContributionAmountCandidate({
    fieldNumber: 63,
    code: 'ARL',
    base:
      object(subsystemBases?.riesgos)?.sourceCount === 1
        ? object(subsystemBases?.riesgos)
        : null,
    expectedFactor: arlInitialRate?.factor ?? null,
  });
  if (arlInitialRate && arlConcept) {
    put(61, arlInitialRate.fieldValue);
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
  mapContributionAmountCandidate({
    fieldNumber: 65,
    code: 'CAJA',
    base:
      object(subsystemBases?.cajaCompensacion)?.sourceCount === 1
        ? object(subsystemBases?.cajaCompensacion)
        : null,
  });
  mapContributionAmountCandidate({
    fieldNumber: 67,
    code: 'SENA',
    base:
      otherParafiscalBase?.reglaVersion === 'CO_PARAFISCAL_BASE_V1' &&
      hasNoBlockers(otherParafiscalBase)
        ? otherParafiscalBase
        : null,
    requireExplicitNonExemption: true,
  });
  mapContributionAmountCandidate({
    fieldNumber: 69,
    code: 'ICBF',
    base:
      otherParafiscalBase?.reglaVersion === 'CO_PARAFISCAL_BASE_V1' &&
      hasNoBlockers(otherParafiscalBase)
        ? otherParafiscalBase
        : null,
    requireExplicitNonExemption: true,
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
    employeeId: snapshot.employeeId,
    tenantId,
    payrollPeriodId,
    normativeRuleVersions: {
      arlInitialRate: arlRateByClass
        ? PILA_ARL_INITIAL_RATE_RULE_VERSION
        : null,
    },
    values,
    unresolvedFields,
  };
}
