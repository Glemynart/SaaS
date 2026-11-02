import type { PilaAt2V30FieldInput } from './pila-at2-v30-record-serializer';

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

function object(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
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

/**
 * Builds source candidates for AT2 v30 employer file fields from one frozen
 * PayrollSnapshot PILA payload. This does not validate or serialize a record.
 * Fields assigned by the operator and sources not frozen in the payload stay
 * unresolved; callers must keep the local preflight as a separate gate.
 */
export function mapPilaAt2V30EmployerCandidate(
  input: PilaAt2V30EmployerCandidateInput,
): PilaAt2V30EmployerCandidate {
  const root = object(input.payload);
  const employer = object(root?.employer);
  const employerPila = object(employer?.pila);
  const tenantId = valueText(employer?.tenantId);
  const supportedSnapshot =
    input.payloadVersion === 2 &&
    root?.schemaVersion === 2 &&
    tenantId !== null;
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
        'Se requiere un snapshot PILA v2 con datos congelados del aportante.',
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
  putRequiredText(2, employerPila.tipoDocumentoAportante);
  putRequiredText(3, employer.nit);

  const personType = valueText(employerPila.tipoPersona);
  if (personType === 'N') {
    // AT2 v30 specifies zero for a natural person's verification digit.
    put(4, '0');
  } else {
    putRequiredText(4, employer.digitoVerif);
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
  putRequiredText(16, employerPila.fax);
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
    putRequiredText(18, employerPila.representanteNumeroDocumento);
    put(19, '0');
    putRequiredText(20, employerPila.representanteTipoDocumento);
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

  unresolved(28, 'AT2 asigna el código del operador; no está en el snapshot.');
  unresolved(
    29,
    'El período/código de pago lo asigna el operador; no se infiere.',
  );
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
