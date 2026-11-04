import type { PilaAt2V30FieldInput } from './pila-at2-v30-record-serializer';
import {
  isValidPilaEmployerIdentification,
  isValidPilaRepresentativeIdentification,
  PILA_SUPPORTED_EMPLOYER_DOCUMENT_TYPES,
  PILA_SUPPORTED_REPRESENTATIVE_DOCUMENT_TYPES,
} from './pila-document-identity';

type JsonRecord = Record<string, unknown>;

export interface PilaAt2V30EmployerCandidateInput {
  payloadVersion: number | null;
  payload: unknown;
}

export interface PilaAt2V30EmployerCandidate {
  formatVersion: 'AT2_V30';
  supportedSnapshot: boolean;
  tenantId: string | null;
  values: Partial<Record<number, PilaAt2V30FieldInput>>;
  unresolvedFields: Array<{ fieldNumber: number; reason: string }>;
}

export interface PilaAt2V30EmployerAggregateCandidate {
  formatVersion: 'AT2_V30';
  supportedSnapshots: boolean;
  tenantId: string | null;
  payrollPeriodId: string;
  values: Partial<Record<number, PilaAt2V30FieldInput>>;
  unresolvedFields: Array<{ fieldNumber: number; reason: string }>;
}

export interface PilaAt2V30EmployerAggregateInput {
  expectedTenantId: string | null;
  period: {
    id: string;
    fechaInicio: Date;
    fechaFin: Date;
  };
  snapshots: ReadonlyArray<
    PilaAt2V30EmployerCandidateInput & { employeeId: string }
  >;
}

function object(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function supportedPilaSnapshot(
  payloadVersion: number | null,
  root: JsonRecord | null,
): boolean {
  return (
    (payloadVersion === 2 ||
      payloadVersion === 3 ||
      payloadVersion === 4 ||
      payloadVersion === 5 ||
      payloadVersion === 6 ||
      payloadVersion === 7) &&
    root?.schemaVersion === payloadVersion
  );
}

function valueText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim().length > 0 ? value : null;
}

function calendarDate(value: unknown): string | null {
  const normalized = valueText(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === normalized
    ? normalized.replaceAll('-', '')
    : null;
}

function isoDate(value: Date): string | null {
  return Number.isNaN(value.getTime())
    ? null
    : value.toISOString().slice(0, 10).replaceAll('-', '');
}

function employerPeriod(snapshot: PilaAt2V30EmployerCandidateInput) {
  const root = object(snapshot.payload);
  const employee = object(root?.employee);
  const employer = object(root?.employer);
  const period = object(root?.period);
  return {
    supported:
      supportedPilaSnapshot(snapshot.payloadVersion, root) &&
      employee !== null &&
      employer !== null &&
      object(employer.pila) !== null &&
      valueText(employee.employeeId) !== null,
    employeeId: valueText(employee?.employeeId),
    tenantId: valueText(employer?.tenantId),
    payrollPeriodId: valueText(period?.payrollPeriodId),
    fechaInicio: calendarDate(period?.fechaInicio),
    fechaFin: calendarDate(period?.fechaFin),
  };
}

/**
 * Builds source candidates for AT2 v30 employer file fields from one frozen
 * PayrollSnapshot PILA v2/v3/v4/v5/v6/v7 payload. This does not validate or serialize a record.
 * Fields assigned by the operator are explicit blank-position candidates;
 * sources not frozen in the payload stay unresolved. The candidate input
 * convention still requires operator verification before compatibility claims.
 */
export function mapPilaAt2V30EmployerCandidate(
  input: PilaAt2V30EmployerCandidateInput,
): PilaAt2V30EmployerCandidate {
  const root = object(input.payload);
  const employer = object(root?.employer);
  const employerPila = object(employer?.pila);
  const tenantId = valueText(employer?.tenantId);
  const supportedSnapshot =
    supportedPilaSnapshot(input.payloadVersion, root) && tenantId !== null;
  const values: Partial<Record<number, PilaAt2V30FieldInput>> = {};
  const unresolvedFields: Array<{ fieldNumber: number; reason: string }> = [];
  const unresolved = (fieldNumber: number, reason: string) => {
    unresolvedFields.push({ fieldNumber, reason });
  };
  const put = (fieldNumber: number, value: string | number) => {
    values[fieldNumber] = { value };
  };
  const putBlank = (fieldNumber: number) => {
    values[fieldNumber] = { value: null, emptyAs: 'spaces' };
  };
  const putNumericZeros = (fieldNumber: number) => {
    values[fieldNumber] = { value: null, emptyAs: 'zeros' };
  };
  const putRequiredText = (fieldNumber: number, value: unknown) => {
    const normalized = valueText(value);
    if (normalized === null) {
      unresolved(fieldNumber, 'No hay un valor explícito en el snapshot.');
    } else {
      put(fieldNumber, normalized);
    }
  };

  if (!supportedSnapshot || !employer || !employerPila) {
    for (let fieldNumber = 1; fieldNumber <= 34; fieldNumber += 1) {
      unresolved(
        fieldNumber,
        'Se requiere un snapshot PILA v2, v3 o v4 con datos congelados del aportante.',
      );
    }
    return {
      formatVersion: 'AT2_V30',
      supportedSnapshot: false,
      tenantId,
      values,
      unresolvedFields,
    };
  }

  putRequiredText(1, employer.razonSocial);
  const personType = valueText(employerPila.tipoPersona);
  const employerDocumentType = valueText(employerPila.tipoDocumentoAportante);
  const employerIdentification = valueText(employer.nit);
  const employerDocumentTypeSupported = Boolean(
    employerDocumentType &&
    PILA_SUPPORTED_EMPLOYER_DOCUMENT_TYPES.has(employerDocumentType),
  );
  const employerDocumentCompatible = !(
    personType === 'N' && employerDocumentType === 'NI'
  );
  if (employerDocumentTypeSupported && employerDocumentCompatible) {
    put(2, employerDocumentType!);
  } else {
    unresolved(
      2,
      employerDocumentCompatible
        ? 'Falta un tipo de documento del aportante soportado por AT2 v30.'
        : 'El tipo de documento NI no corresponde a un aportante persona natural.',
    );
  }
  if (
    employerDocumentTypeSupported &&
    employerDocumentCompatible &&
    employerIdentification &&
    isValidPilaEmployerIdentification(
      employerDocumentType!,
      employerIdentification,
    )
  ) {
    put(3, employerIdentification);
  } else {
    unresolved(
      3,
      'La identificación del aportante no cumple el formato del tipo declarado; no se corrige ni se trunca.',
    );
  }

  if (personType === 'N') {
    if (valueText(employer.digitoVerif) === '0') {
      // AT2 v30 specifies zero for a natural person's verification digit.
      put(4, '0');
    } else {
      unresolved(
        4,
        'AT2 v30 requiere que el dígito de verificación de una persona natural sea 0.',
      );
    }
  } else if (personType === 'J') {
    const verificationDigit = valueText(employer.digitoVerif);
    if (verificationDigit && /^\d$/.test(verificationDigit)) {
      put(4, verificationDigit);
    } else {
      unresolved(
        4,
        'La persona jurídica requiere un dígito de verificación de una posición; el operador valida el cálculo DIAN.',
      );
    }
  } else {
    unresolved(4, 'Falta confirmar el tipo de persona del aportante.');
  }

  const presentation = valueText(employerPila.formaPresentacion);
  if (presentation === 'U') {
    putBlank(5);
    putBlank(6);
  } else if (presentation === 'S') {
    const branchCode = valueText(employerPila.codigoSucursal);
    putRequiredText(5, branchCode);
    putRequiredText(6, valueText(employerPila.nombreSucursal) ?? branchCode);
  } else {
    unresolved(5, 'Falta confirmar la forma de presentación del aportante.');
    unresolved(6, 'Falta confirmar la forma de presentación del aportante.');
  }

  putRequiredText(7, employerPila.claseAportante);
  putRequiredText(8, employerPila.naturalezaJuridica);
  putRequiredText(9, employerPila.tipoPersona);
  putRequiredText(10, employerPila.formaPresentacion);
  putRequiredText(11, employer.direccion);

  const municipality = object(employer.municipio);
  const municipalityCode = valueText(municipality?.codigo);
  if (municipalityCode && /^\d{5}$/.test(municipalityCode)) {
    // DIVIPOLA uses DDMMM: AT2 stores municipality MMM and department DD.
    put(12, municipalityCode.slice(2));
    put(13, municipalityCode.slice(0, 2));
  } else {
    unresolved(
      12,
      'El snapshot no contiene un código DIVIPOLA de cinco dígitos.',
    );
    unresolved(
      13,
      'El snapshot no contiene un código DIVIPOLA de cinco dígitos.',
    );
  }

  putRequiredText(14, employerPila.codigoActividadEconomica);
  putRequiredText(15, employer.telefono);
  if (valueText(employerPila.fax) === null) {
    // AT2 v30 makes fax non-mandatory and specifies zero-fill for numeric
    // fields. Keep this as a candidate; operator acceptance is still pending.
    putNumericZeros(16);
  } else {
    putRequiredText(16, employerPila.fax);
  }
  if (valueText(employer.email) === null) {
    // Email is optional and alphanumeric AT2 fields are blank-filled.
    putBlank(17);
  } else {
    putRequiredText(17, employer.email);
  }

  if (personType === 'N') {
    putBlank(18);
    put(19, '0');
    putBlank(20);
    putBlank(21);
    putBlank(22);
    putBlank(23);
    putBlank(24);
  } else if (personType === 'J') {
    const representativeDocumentType = valueText(
      employerPila.representanteTipoDocumento,
    );
    const representativeIdentification = valueText(
      employerPila.representanteNumeroDocumento,
    );
    if (
      representativeDocumentType &&
      PILA_SUPPORTED_REPRESENTATIVE_DOCUMENT_TYPES.has(
        representativeDocumentType,
      )
    ) {
      put(20, representativeDocumentType);
      if (
        representativeIdentification &&
        isValidPilaRepresentativeIdentification(
          representativeDocumentType,
          representativeIdentification,
        )
      ) {
        put(18, representativeIdentification);
      } else {
        unresolved(
          18,
          'La identificación del representante no cumple el formato del tipo declarado; no se corrige ni se trunca.',
        );
      }
    } else {
      unresolved(
        18,
        'Falta un tipo de documento soportado para la identificación del representante.',
      );
      unresolved(
        20,
        'Falta un tipo de documento soportado para la identificación del representante.',
      );
    }
    put(19, '0');
    putRequiredText(21, employerPila.representantePrimerApellido);
    if (valueText(employerPila.representanteSegundoApellido) === null) {
      putBlank(22);
    } else {
      putRequiredText(22, employerPila.representanteSegundoApellido);
    }
    putRequiredText(23, employerPila.representantePrimerNombre);
    if (valueText(employerPila.representanteSegundoNombre) === null) {
      putBlank(24);
    } else {
      putRequiredText(24, employerPila.representanteSegundoNombre);
    }
  } else {
    for (const fieldNumber of [18, 19, 20, 21, 22, 23, 24]) {
      unresolved(
        fieldNumber,
        'Falta confirmar el tipo de persona del aportante.',
      );
    }
  }

  if (employerPila.sinAccionEspecial === true) {
    putBlank(25);
    put(26, '0');
    putBlank(27);
  } else {
    for (const fieldNumber of [25, 26, 27]) {
      unresolved(
        fieldNumber,
        'El snapshot no confirma que el aportante esté libre de acción especial.',
      );
    }
  }

  // AT2 v30 assigns both values to the operator's system. Keep the fixed-width
  // positions explicit and blank; do not source them from the tenant snapshot.
  putBlank(28);
  putBlank(29);
  putRequiredText(30, employerPila.tipoAportante);

  if (employerPila.beneficioLey1429 === false) {
    putBlank(31);
    putBlank(32);
  } else if (employerPila.beneficioLey1429 === true) {
    const registrationDate = calendarDate(employerPila.fechaMatriculaMercantil);
    if (registrationDate) {
      put(31, registrationDate);
    } else {
      unresolved(
        31,
        'Falta una fecha de matrícula mercantil congelada y válida.',
      );
    }
    const domicileMunicipalityCode = valueText(municipality?.codigo);
    if (domicileMunicipalityCode && /^\d{5}$/.test(domicileMunicipalityCode)) {
      // ADR-013 identifies the frozen employer domicile as the source.
      put(32, domicileMunicipalityCode.slice(0, 2));
    } else {
      unresolved(
        32,
        'Falta el DIVIPOLA confirmado del domicilio principal del aportante.',
      );
    }
  } else {
    unresolved(31, 'Falta confirmar si aplica el beneficio de Ley 1429.');
    unresolved(32, 'Falta confirmar si aplica el beneficio de Ley 1429.');
  }

  if (
    typeof employer.aportesExonerados === 'boolean' &&
    typeof employerPila.aportesExoneradosConfirmado === 'boolean' &&
    employerPila.aportesExoneradosConfirmado === employer.aportesExonerados
  ) {
    put(33, employer.aportesExonerados ? 'S' : 'N');
  } else {
    unresolved(
      33,
      'La exoneración no está confirmada contra el dato congelado del aportante.',
    );
  }

  if (typeof employerPila.beneficioCcfLey1429 === 'boolean') {
    put(34, employerPila.beneficioCcfLey1429 ? 'S' : 'N');
  } else {
    unresolved(
      34,
      'Falta una respuesta explícita sobre el beneficio CCF de Ley 1429.',
    );
  }

  return {
    formatVersion: 'AT2_V30',
    supportedSnapshot: true,
    tenantId,
    values,
    unresolvedFields,
  };
}

/**
 * Aggregates the type 1 employer record only when every approved snapshot is
 * structurally tied to the requested tenant period and all employee-level
 * candidates agree. It never fills gaps from current tenant master data.
 */
export function mapPilaAt2V30EmployerAggregateCandidate(
  input: PilaAt2V30EmployerAggregateInput,
): PilaAt2V30EmployerAggregateCandidate {
  const expectedStart = isoDate(input.period.fechaInicio);
  const expectedEnd = isoDate(input.period.fechaFin);
  const parsed = input.snapshots.map((snapshot) => ({
    snapshot,
    scope: employerPeriod(snapshot),
    candidate: mapPilaAt2V30EmployerCandidate(snapshot),
  }));
  const tenantIds = new Set(
    parsed
      .map(({ scope }) => scope.tenantId)
      .filter((id): id is string => id !== null),
  );
  const duplicateEmployee =
    new Set(parsed.map(({ snapshot }) => snapshot.employeeId)).size !==
    parsed.length;
  const scopeReasons: string[] = [];

  if (parsed.length === 0) {
    scopeReasons.push('No hay snapshots aprobados para este período.');
  }
  if (duplicateEmployee) {
    scopeReasons.push(
      'Hay más de un snapshot aprobado para el mismo empleado.',
    );
  }
  if (
    parsed.some(
      ({ snapshot, scope, candidate }) =>
        !scope.supported ||
        !candidate.supportedSnapshot ||
        !scope.employeeId ||
        scope.employeeId !== snapshot.employeeId,
    )
  ) {
    scopeReasons.push(
      'Se requiere un snapshot PILA v2, v3 o v4 con empleado y datos congelados del aportante consistentes.',
    );
  }
  if (tenantIds.size !== 1 || parsed.some(({ scope }) => !scope.tenantId)) {
    scopeReasons.push('Los snapshots no comparten un tenant identificable.');
  }
  if (!input.expectedTenantId) {
    scopeReasons.push(
      'Falta el contexto del tenant autenticado para confirmar el aportante.',
    );
  } else if (
    tenantIds.size === 1 &&
    [...tenantIds][0] !== input.expectedTenantId
  ) {
    scopeReasons.push(
      'El tenant congelado en los snapshots no coincide con el tenant autenticado.',
    );
  }
  if (
    parsed.some(
      ({ scope }) =>
        scope.payrollPeriodId !== input.period.id ||
        scope.fechaInicio !== expectedStart ||
        scope.fechaFin !== expectedEnd,
    )
  ) {
    scopeReasons.push(
      'El período congelado en los snapshots no coincide con el período aprobado solicitado.',
    );
  }

  const tenantId =
    tenantIds.size === 1 && [...tenantIds][0] === input.expectedTenantId
      ? input.expectedTenantId
      : null;
  const values: Partial<Record<number, PilaAt2V30FieldInput>> = {};
  const unresolvedFields: Array<{ fieldNumber: number; reason: string }> = [];
  const allFields = Array.from({ length: 34 }, (_, index) => index + 1);
  if (scopeReasons.length > 0) {
    const reason = [...new Set(scopeReasons)].join(' ');
    for (const fieldNumber of allFields)
      unresolvedFields.push({ fieldNumber, reason });
    return {
      formatVersion: 'AT2_V30',
      supportedSnapshots: false,
      tenantId,
      payrollPeriodId: input.period.id,
      values,
      unresolvedFields,
    };
  }

  for (const fieldNumber of allFields) {
    const candidates = parsed.map(({ candidate }) => ({
      value: candidate.values[fieldNumber],
      reason: candidate.unresolvedFields.find(
        (field) => field.fieldNumber === fieldNumber,
      )?.reason,
    }));
    const first = candidates[0]?.value;
    if (
      first &&
      candidates.every(
        ({ value }) =>
          value !== undefined &&
          value.value === first.value &&
          value.emptyAs === first.emptyAs,
      )
    ) {
      values[fieldNumber] = { ...first };
      continue;
    }

    const reasons = candidates.map(({ reason }) => reason).filter(Boolean);
    const sameUnresolvedReason =
      reasons.length === candidates.length &&
      reasons.every((reason) => reason === reasons[0]);
    unresolvedFields.push({
      fieldNumber,
      reason: sameUnresolvedReason
        ? reasons[0]!
        : 'El campo falta o presenta valores diferentes entre los snapshots aprobados.',
    });
  }

  return {
    formatVersion: 'AT2_V30',
    supportedSnapshots: true,
    tenantId,
    payrollPeriodId: input.period.id,
    values,
    unresolvedFields,
  };
}
