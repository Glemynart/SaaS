import { PilaEventCode } from '@prisma/client';
import { roundPeso } from './calculator/payroll-calculator';

type MunicipalitySource = {
  id: string;
  codigo: string;
  nombre: string;
  departamento: string;
} | null;

export type PilaSourceContextInput = {
  capturedAt: Date;
  tenant: {
    id: string;
    razonSocial: string;
    nit: string;
    digitoVerif: string;
    direccion: string | null;
    telefono: string | null;
    email: string | null;
    representanteLegal: string | null;
    aportesExonerados: boolean;
    municipio: MunicipalitySource;
    pilaClaseAportante: string | null;
    pilaTipoDocumentoAportante: string | null;
    pilaNaturalezaJuridica: string | null;
    pilaTipoPersona: string | null;
    pilaFormaPresentacion: string | null;
    pilaCodigoSucursal: string | null;
    pilaNombreSucursal: string | null;
    pilaCodigoActividadEconomica: string | null;
    pilaCodigoArlAportante: string | null;
    pilaTipoAportante: string | null;
    pilaFax: string | null;
    pilaRepresentanteTipoDocumento: string | null;
    pilaRepresentanteNumeroDocumento: string | null;
    pilaRepresentantePrimerApellido: string | null;
    pilaRepresentanteSegundoApellido: string | null;
    pilaRepresentantePrimerNombre: string | null;
    pilaRepresentanteSegundoNombre: string | null;
    pilaFechaMatriculaMercantil: Date | null;
    pilaBeneficioLey1429: boolean | null;
    pilaBeneficioCcfLey1429: boolean | null;
    pilaAportesExoneradosConfirmado: boolean | null;
    pilaSinAccionEspecial: boolean | null;
  };
  employee: {
    id: string;
    tipoDocumento: string | null;
    cedula: string | null;
    primerNombre: string | null;
    segundoNombre: string | null;
    primerApellido: string | null;
    segundoApellido: string | null;
    fechaNacimiento: Date | null;
    fechaIngreso: Date | null;
    fechaRetiro: Date | null;
    tipoSalarioPila: 'X' | 'F' | 'V' | null;
  };
  period: {
    id: string;
    fechaInicio: Date;
    fechaFin: Date;
  };
  contract: {
    id: string;
    tipo: string;
    estado: string;
    fechaInicio: Date;
    fechaFin: Date | null;
    salario: number;
    sedeId: string | null;
    claseRiesgoArl: number | null;
  } | null;
  worksite: {
    id: string;
    nombre: string;
    direccion: string | null;
    municipio: MunicipalitySource;
  } | null;
  pilaWorkLocations?: Array<{
    id: string;
    tenantId: string;
    municipioId: string;
    municipio: MunicipalitySource;
    vigenteDesde: Date;
    vigenteHasta: Date | null;
  }>;
  affiliations: Array<{
    id: string;
    tipoCotizanteCodigo: string;
    subtipoCotizanteCodigo: string | null;
    epsCodigo: string;
    epsNombre: string;
    fondoPensionCodigo: string;
    fondoPensionNombre: string;
    arlCodigo: string;
    arlNombre: string;
    arlClaseRiesgo: string;
    cajaCompensacionCodigo: string;
    cajaCompensacionNombre: string;
    cajaCompensacionDepartamentoCodigo?: string | null;
    extranjeroNoObligadoPension?: boolean | null;
    colombianoEnElExterior?: boolean | null;
    vigenteDesde: Date;
    vigenteHasta: Date | null;
    versionCaptura: string;
  }>;
  pilaEvents: Array<{
    id: string;
    codigo: PilaEventCode;
    fechaInicio: Date;
    fechaFin: Date | null;
    dias: number | null;
  }>;
  riskAssignments?: Array<{
    id: string;
    tenantId: string;
    codigoActividadEconomica: string;
    formatoNormativoVersion: string;
    vigenteDesde: Date;
    vigenteHasta: Date | null;
    centroTrabajo: {
      id: string;
      tenantId: string;
      sedeId: string | null;
      arlCodigo: string;
      codigoCentro: string;
      nombre: string;
    };
  }>;
};

export type PilaSourceContext = ReturnType<typeof buildPilaSourceContext>;
export type PilaRiskAssignmentSource = NonNullable<
  PilaSourceContextInput['riskAssignments']
>[number];

export function buildPilaRiskAssignmentsSnapshot(
  assignments: readonly PilaRiskAssignmentSource[] = [],
) {
  return assignments.map((assignment) => ({
    assignmentId: assignment.id,
    tenantId: assignment.tenantId,
    codigoActividadEconomica: assignment.codigoActividadEconomica,
    formatoNormativoVersion: assignment.formatoNormativoVersion,
    vigenteDesde: calendarDate(assignment.vigenteDesde)!,
    vigenteHasta: calendarDate(assignment.vigenteHasta),
    centroTrabajo: {
      centroTrabajoId: assignment.centroTrabajo.id,
      tenantId: assignment.centroTrabajo.tenantId,
      sedeId: assignment.centroTrabajo.sedeId,
      arlCodigo: assignment.centroTrabajo.arlCodigo,
      codigoCentro: assignment.centroTrabajo.codigoCentro,
      nombre: assignment.centroTrabajo.nombre,
    },
  }));
}

export function buildPilaWorkLocationsSnapshot(
  locations: NonNullable<PilaSourceContextInput['pilaWorkLocations']>,
) {
  return locations.map((location) => ({
    assignmentId: location.id,
    tenantId: location.tenantId,
    municipioId: location.municipioId,
    municipio: location.municipio,
    vigenteDesde: calendarDate(location.vigenteDesde),
    vigenteHasta: calendarDate(location.vigenteHasta),
  }));
}

export type PilaSnapshotNovelty = {
  noveltyId: string;
  tipo: string;
  descripcion: string | null;
  fecha: string | null;
  valor: number | null;
};

export type PilaSnapshotEvent = {
  eventId: string;
  codigo: PilaEventCode;
  fechaInicio: string;
  fechaFin: string | null;
  dias: number | null;
};

export function buildPilaSourceContext(input: PilaSourceContextInput) {
  return {
    schemaVersion: 3,
    capturedAt: input.capturedAt.toISOString(),
    period: {
      payrollPeriodId: input.period.id,
      fechaInicio: calendarDate(input.period.fechaInicio),
      fechaFin: calendarDate(input.period.fechaFin),
    },
    employer: {
      tenantId: input.tenant.id,
      razonSocial: input.tenant.razonSocial,
      nit: input.tenant.nit,
      digitoVerif: input.tenant.digitoVerif,
      direccion: input.tenant.direccion,
      telefono: input.tenant.telefono,
      email: input.tenant.email,
      representanteLegal: input.tenant.representanteLegal,
      aportesExonerados: input.tenant.aportesExonerados,
      municipio: input.tenant.municipio,
      pila: {
        claseAportante: input.tenant.pilaClaseAportante ?? null,
        tipoDocumentoAportante: input.tenant.pilaTipoDocumentoAportante ?? null,
        naturalezaJuridica: input.tenant.pilaNaturalezaJuridica ?? null,
        tipoPersona: input.tenant.pilaTipoPersona ?? null,
        formaPresentacion: input.tenant.pilaFormaPresentacion ?? null,
        codigoSucursal: input.tenant.pilaCodigoSucursal ?? null,
        nombreSucursal: input.tenant.pilaNombreSucursal ?? null,
        codigoActividadEconomica:
          input.tenant.pilaCodigoActividadEconomica ?? null,
        codigoArlAportante: input.tenant.pilaCodigoArlAportante ?? null,
        tipoAportante: input.tenant.pilaTipoAportante ?? null,
        fax: input.tenant.pilaFax ?? null,
        representanteTipoDocumento:
          input.tenant.pilaRepresentanteTipoDocumento ?? null,
        representanteNumeroDocumento:
          input.tenant.pilaRepresentanteNumeroDocumento ?? null,
        representantePrimerApellido:
          input.tenant.pilaRepresentantePrimerApellido ?? null,
        representanteSegundoApellido:
          input.tenant.pilaRepresentanteSegundoApellido ?? null,
        representantePrimerNombre:
          input.tenant.pilaRepresentantePrimerNombre ?? null,
        representanteSegundoNombre:
          input.tenant.pilaRepresentanteSegundoNombre ?? null,
        fechaMatriculaMercantil: calendarDate(
          input.tenant.pilaFechaMatriculaMercantil ?? null,
        ),
        beneficioLey1429: input.tenant.pilaBeneficioLey1429 ?? null,
        beneficioCcfLey1429: input.tenant.pilaBeneficioCcfLey1429 ?? null,
        aportesExoneradosConfirmado:
          input.tenant.pilaAportesExoneradosConfirmado ?? null,
        sinAccionEspecial: input.tenant.pilaSinAccionEspecial ?? null,
      },
    },
    employee: {
      employeeId: input.employee.id,
      tipoDocumento: input.employee.tipoDocumento,
      cedula: input.employee.cedula,
      primerNombre: input.employee.primerNombre,
      segundoNombre: input.employee.segundoNombre,
      primerApellido: input.employee.primerApellido,
      segundoApellido: input.employee.segundoApellido,
      fechaNacimiento: calendarDate(input.employee.fechaNacimiento),
      fechaIngreso: calendarDate(input.employee.fechaIngreso),
      fechaRetiro: calendarDate(input.employee.fechaRetiro),
      tipoSalarioPila: input.employee.tipoSalarioPila,
    },
    contract: input.contract
      ? {
          contractId: input.contract.id,
          tipo: input.contract.tipo,
          estado: input.contract.estado,
          fechaInicio: calendarDate(input.contract.fechaInicio),
          fechaFin: calendarDate(input.contract.fechaFin),
          salario: input.contract.salario,
          sedeId: input.contract.sedeId,
          claseRiesgoArl: input.contract.claseRiesgoArl,
        }
      : null,
    worksite: input.worksite
      ? {
          sedeId: input.worksite.id,
          nombre: input.worksite.nombre,
          direccion: input.worksite.direccion,
          municipio: input.worksite.municipio,
        }
      : null,
    pilaWorkLocations: buildPilaWorkLocationsSnapshot(
      input.pilaWorkLocations ?? [],
    ),
    affiliations: input.affiliations.map((affiliation) => ({
      affiliationId: affiliation.id,
      tipoCotizanteCodigo: affiliation.tipoCotizanteCodigo,
      subtipoCotizanteCodigo: affiliation.subtipoCotizanteCodigo,
      epsCodigo: affiliation.epsCodigo,
      epsNombre: affiliation.epsNombre,
      fondoPensionCodigo: affiliation.fondoPensionCodigo,
      fondoPensionNombre: affiliation.fondoPensionNombre,
      arlCodigo: affiliation.arlCodigo,
      arlNombre: affiliation.arlNombre,
      arlClaseRiesgo: affiliation.arlClaseRiesgo,
      cajaCompensacionCodigo: affiliation.cajaCompensacionCodigo,
      cajaCompensacionNombre: affiliation.cajaCompensacionNombre,
      cajaCompensacionDepartamentoCodigo:
        affiliation.cajaCompensacionDepartamentoCodigo ?? null,
      extranjeroNoObligadoPension:
        affiliation.extranjeroNoObligadoPension ?? null,
      colombianoEnElExterior: affiliation.colombianoEnElExterior ?? null,
      vigenteDesde: calendarDate(affiliation.vigenteDesde),
      vigenteHasta: calendarDate(affiliation.vigenteHasta),
      versionCaptura: affiliation.versionCaptura,
    })),
    pilaEvents: input.pilaEvents.map((event) => ({
      eventId: event.id,
      codigo: event.codigo,
      fechaInicio: calendarDate(event.fechaInicio)!,
      fechaFin: calendarDate(event.fechaFin),
      dias: event.dias,
    })),
    pilaRiskAssignments: buildPilaRiskAssignmentsSnapshot(
      input.riskAssignments,
    ),
  };
}

export function buildPilaSourceSnapshot(input: {
  context: PilaSourceContext;
  payroll: {
    runId: string;
    parametroLegalId?: string | null;
    legalParameters?: Record<string, unknown>;
    fechaPrevistaPagoPila: Date | null;
    salarioBasico: number | null;
    salarioIntegral: boolean;
    ibc: number | null;
    concepts: Array<{
      id?: string;
      codigo: string | null;
      tipo: string;
      base: number | null;
      factor: number | null;
      valor: number;
    }>;
    novelties: PilaSnapshotNovelty[];
  };
}) {
  const concepts = input.payroll.concepts.map((concept) => ({
    conceptId: concept.id ?? null,
    codigo: concept.codigo,
    tipo: concept.tipo,
    base: concept.base,
    factor: concept.factor,
    valor: concept.valor,
  }));
  const salaryType = resolvePilaSalaryType(
    input.payroll.salarioIntegral,
    input.context.employee.tipoSalarioPila,
  );
  const diasCotizadosPorSubsistema = buildPilaDaysBySubsystem(
    input.context,
    input.payroll.novelties,
  );

  return {
    ...input.context,
    schemaVersion: 4,
    pilaRiskAssignments: input.context.pilaRiskAssignments ?? [],
    payroll: {
      payrollRunId: input.payroll.runId,
      payrollCalculationParameters: buildPilaPayrollCalculationParameters(
        input.payroll.parametroLegalId ?? null,
        input.payroll.legalParameters ?? null,
      ),
      fechaPrevistaPagoPila: calendarDate(input.payroll.fechaPrevistaPagoPila),
      salarioBasico: input.payroll.salarioBasico,
      salarioBasicoCampo40: validatePilaBasicSalary(
        input.payroll.salarioBasico,
      ),
      tipoSalario: salaryType.valor,
      tipoSalarioBloqueos: salaryType.bloqueos,
      ibc: input.payroll.ibc,
      diasCotizadosPorSubsistema,
      pilaEvents: input.context.pilaEvents.map((event) => ({ ...event })),
      ibcPorSubsistema: {
        pension: payrollConceptBaseSource(
          input.payroll.concepts,
          'PENSION_EMP',
          'DEDUCTION',
        ),
        salud: payrollConceptBaseSource(
          input.payroll.concepts,
          'SALUD_EMP',
          'DEDUCTION',
        ),
        riesgos: payrollConceptBaseSource(
          input.payroll.concepts,
          'ARL',
          'EMPLOYER_CONTRIBUTION',
        ),
        cajaCompensacion: payrollConceptBaseSource(
          input.payroll.concepts,
          'CAJA',
          'EMPLOYER_CONTRIBUTION',
        ),
        otrosParafiscales: otherParafiscalBaseSource({
          context: input.context,
          concepts: input.payroll.concepts,
          salarioBasico: input.payroll.salarioBasico,
          salarioIntegral: input.payroll.salarioIntegral,
          tipoSalario: salaryType.valor,
          novelties: input.payroll.novelties,
          diasCotizadosPorSubsistema,
        }),
      },
      concepts,
      novelties: input.payroll.novelties.map((novelty) => ({ ...novelty })),
    },
  };
}

function buildPilaPayrollCalculationParameters(
  parametroLegalId: string | null,
  legalParameters: Record<string, unknown> | null,
) {
  const smmlv = legalParameters?.smmlv;
  const rawTramos = legalParameters?.fspTramos;
  const fspTramos = Array.isArray(rawTramos)
    ? rawTramos.map((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return null;
        }
        const tramo = value as Record<string, unknown>;
        const desdeSmmlv = tramo.desdeSmmlv;
        const hastaSmmlv = tramo.hastaSmmlv;
        const pct = tramo.pct;
        if (
          typeof desdeSmmlv !== 'number' ||
          !Number.isFinite(desdeSmmlv) ||
          desdeSmmlv < 0 ||
          (hastaSmmlv !== null &&
            (typeof hastaSmmlv !== 'number' ||
              !Number.isFinite(hastaSmmlv) ||
              hastaSmmlv < desdeSmmlv)) ||
          typeof pct !== 'number' ||
          !Number.isFinite(pct) ||
          pct < 0
        ) {
          return null;
        }
        return { desdeSmmlv, hastaSmmlv, pct };
      })
    : null;
  const hasValidTramos = fspTramos !== null && fspTramos.every(Boolean);

  return {
    sourceVersion: 'PAYROLL_LEGAL_PARAMETERS_V1',
    parametroLegalId,
    smmlv:
      typeof smmlv === 'number' && Number.isFinite(smmlv) && smmlv > 0
        ? smmlv
        : null,
    fspTramos: hasValidTramos ? fspTramos : null,
  };
}

function buildPilaDaysBySubsystem(
  context: PilaSourceContext,
  novelties: PilaSnapshotNovelty[],
) {
  const blockers: string[] = [];
  const { fechaInicio, fechaFin } = context.period;

  if (!fechaInicio || !fechaFin) {
    blockers.push('PERIODO_SIN_FECHAS');
  } else if (!isFullCalendarMonth(fechaInicio, fechaFin)) {
    blockers.push('PERIODO_NO_ES_MES_CALENDARIO_COMPLETO');
  }

  const employee = context.employee;
  if (
    !employee.fechaIngreso ||
    !fechaInicio ||
    !fechaFin ||
    employee.fechaIngreso > fechaInicio ||
    (employee.fechaRetiro !== null && employee.fechaRetiro < fechaFin)
  ) {
    blockers.push('EMPLEADO_NO_CUBRE_TODO_EL_PERIODO');
  }

  const contract = context.contract;
  if (
    !contract ||
    !contract.fechaInicio ||
    !fechaInicio ||
    !fechaFin ||
    contract.fechaInicio > fechaInicio ||
    (contract.fechaFin !== null && contract.fechaFin < fechaFin)
  ) {
    blockers.push('CONTRATO_NO_CUBRE_TODO_EL_PERIODO');
  }

  if (novelties.some(({ tipo }) => !['BONUS', 'OVERTIME'].includes(tipo))) {
    blockers.push('HAY_NOVEDADES_SIN_SEGMENTACION_PILA');
  }
  if (context.pilaEvents.length > 0) {
    blockers.push('HAY_EVENTOS_PILA_SIN_SEGMENTACION');
  }

  const affiliation =
    context.affiliations.length === 1 ? context.affiliations[0] : null;
  if (!affiliation) {
    blockers.push('AFILIACION_NO_UNICA_EN_EL_PERIODO');
  } else {
    if (affiliation.tipoCotizanteCodigo !== '01') {
      blockers.push('COTIZANTE_FUERA_DEL_MVP_ESTANDAR');
    }
    if (affiliation.subtipoCotizanteCodigo === null) {
      blockers.push('SUBTIPO_COTIZANTE_SIN_CONFIRMAR');
    } else if (affiliation.subtipoCotizanteCodigo !== '00') {
      blockers.push('COTIZANTE_FUERA_DEL_MVP_ESTANDAR');
    }
    if (
      !affiliation.vigenteDesde ||
      !fechaInicio ||
      !fechaFin ||
      affiliation.vigenteDesde > fechaInicio ||
      (affiliation.vigenteHasta !== null && affiliation.vigenteHasta < fechaFin)
    ) {
      blockers.push('AFILIACION_NO_CUBRE_TODO_EL_PERIODO');
    }
  }

  const value = blockers.length === 0 ? 30 : null;
  const evidence = {
    reglaVersion: 'PILA_FULL_MONTH_DAYS_V1',
    fundamento: 'COBERTURA_COMPLETA_MES_CALENDARIO_DEPENDIENTE',
    periodo: { fechaInicio, fechaFin },
    empleadoId: employee.employeeId,
    contratoId: contract?.contractId ?? null,
    afiliacionId: affiliation?.affiliationId ?? null,
    bloqueos: blockers,
  };

  return {
    pension: { valor: value, ...evidence },
    salud: { valor: value, ...evidence },
    riesgos: { valor: value, ...evidence },
    cajaCompensacion: { valor: value, ...evidence },
  };
}

function isFullCalendarMonth(fechaInicio: string, fechaFin: string): boolean {
  const start = new Date(`${fechaInicio}T00:00:00.000Z`);
  const end = new Date(`${fechaFin}T00:00:00.000Z`);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.getUTCDate() !== 1 ||
    start.getUTCFullYear() !== end.getUTCFullYear() ||
    start.getUTCMonth() !== end.getUTCMonth()
  ) {
    return false;
  }

  const lastDayOfMonth = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return end.getUTCDate() === lastDayOfMonth;
}

function payrollConceptBaseSource(
  concepts: Array<{
    id?: string;
    codigo: string | null;
    tipo: string;
    base: number | null;
  }>,
  codigo: string,
  tipo: string,
) {
  const sources = concepts.filter(
    (concept) => concept.codigo === codigo && concept.tipo === tipo,
  );
  const value = sources.length === 1 ? sources[0].base : null;

  return {
    valor: value !== null && Number.isFinite(value) ? value : null,
    sourceCount: sources.length,
    conceptIds: sources.flatMap((source) => (source.id ? [source.id] : [])),
  };
}

function otherParafiscalBaseSource(input: {
  context: PilaSourceContext;
  concepts: Array<{
    id?: string;
    codigo: string | null;
    tipo: string;
    valor: number;
  }>;
  salarioBasico: number | null;
  salarioIntegral: boolean;
  tipoSalario: 'X' | 'F' | 'V' | null;
  novelties: PilaSnapshotNovelty[];
  diasCotizadosPorSubsistema: ReturnType<typeof buildPilaDaysBySubsystem>;
}) {
  const salaryConcepts = input.concepts.filter(
    (concept) =>
      concept.codigo === 'SALARIO_BASE' && concept.tipo === 'EARNING',
  );
  const overtimeConcepts = input.concepts.filter(
    (concept) => concept.codigo === 'OVERTIME' && concept.tipo === 'EARNING',
  );
  const transportConcepts = input.concepts.filter(
    (concept) => concept.codigo === 'AUX_TRANSP' && concept.tipo === 'EARNING',
  );
  const earningConcepts = input.concepts.filter(
    (concept) => concept.tipo === 'EARNING',
  );
  const unsupportedEarnings = earningConcepts.filter(
    (concept) =>
      !['SALARIO_BASE', 'OVERTIME', 'AUX_TRANSP'].includes(
        concept.codigo ?? '',
      ),
  );
  const sources = [...salaryConcepts, ...overtimeConcepts];
  const sourceIds = sources.flatMap((concept) =>
    concept.id ? [concept.id] : [],
  );
  const blockers: string[] = [];

  if (
    Object.values(input.diasCotizadosPorSubsistema).some(
      ({ valor }) => valor !== 30,
    )
  ) {
    blockers.push('IBC_OTROS_PARAFISCALES_REQUIERE_MES_COMPLETO');
  }
  if (
    salaryConcepts.length !== 1 ||
    input.salarioBasico === null ||
    !Number.isSafeInteger(input.salarioBasico) ||
    input.salarioBasico < 0 ||
    salaryConcepts[0]?.valor !== input.salarioBasico
  ) {
    blockers.push('IBC_OTROS_PARAFISCALES_SALARIO_BASE_AUSENTE_O_AMBIGUO');
  }
  if (overtimeConcepts.length > 1 || transportConcepts.length > 1) {
    blockers.push('IBC_OTROS_PARAFISCALES_CONCEPTOS_DUPLICADOS');
  }
  if (unsupportedEarnings.length > 0) {
    blockers.push('IBC_OTROS_PARAFISCALES_DEVENGO_SIN_CLASIFICAR');
  }

  const bonusNovelty = input.novelties.some(({ tipo }) => tipo === 'BONUS');
  if (bonusNovelty) {
    blockers.push('IBC_OTROS_PARAFISCALES_BONUS_SIN_NATURALEZA');
  }
  if (
    input.novelties.some(({ tipo }) => !['OVERTIME', 'BONUS'].includes(tipo))
  ) {
    blockers.push('IBC_OTROS_PARAFISCALES_NOVEDAD_SIN_BASE_APROBADA');
  }
  if (input.context.pilaEvents.length > 0) {
    blockers.push('IBC_OTROS_PARAFISCALES_EVENTO_PILA_SIN_BASE_APROBADA');
  }
  if (input.tipoSalario !== (input.salarioIntegral ? 'X' : 'F')) {
    blockers.push('IBC_OTROS_PARAFISCALES_TIPO_SALARIO_FUERA_DE_REGLA');
  }

  const overtimeNoveltyValues = input.novelties
    .filter(({ tipo }) => tipo === 'OVERTIME')
    .map(({ valor }) => valor);
  if (
    overtimeNoveltyValues.some(
      (value) => value === null || !Number.isSafeInteger(value) || value < 0,
    )
  ) {
    blockers.push('IBC_OTROS_PARAFISCALES_HORAS_EXTRA_SIN_VALOR');
  }
  const overtimeNoveltyTotal = overtimeNoveltyValues.reduce<number>(
    (total, value) => total + (value ?? 0),
    0,
  );
  const overtimeConceptValue = overtimeConcepts[0]?.valor ?? 0;
  if (
    (overtimeNoveltyValues.length > 0 && overtimeConcepts.length !== 1) ||
    (overtimeConcepts.length > 0 && overtimeNoveltyValues.length === 0) ||
    (overtimeConcepts.length === 1 &&
      (!Number.isSafeInteger(overtimeConceptValue) ||
        overtimeConceptValue < 0)) ||
    overtimeConceptValue !== overtimeNoveltyTotal
  ) {
    blockers.push('IBC_OTROS_PARAFISCALES_HORAS_EXTRA_NO_COINCIDEN');
  }

  const salaryValue = input.salarioBasico ?? 0;
  const salaryAndOvertime = salaryValue + overtimeConceptValue;
  if (!Number.isSafeInteger(salaryAndOvertime) || salaryAndOvertime < 0) {
    blockers.push('IBC_OTROS_PARAFISCALES_BASE_NO_VALIDA');
  }
  const value = input.salarioIntegral
    ? roundPeso(salaryAndOvertime * 0.7)
    : salaryAndOvertime;
  if (value > 999_999_999) {
    blockers.push('IBC_OTROS_PARAFISCALES_EXCEDE_LONGITUD_AT2');
  }

  return {
    valor: blockers.length === 0 ? value : null,
    sourceCount: sources.length,
    conceptIds: sourceIds,
    reglaVersion: 'CO_PARAFISCAL_BASE_V1',
    fundamento: 'LEY_21_1982_ART_17_LEY_344_1996_ART_17_LEY_789_2002_ART_49',
    bloqueos: blockers,
  };
}

function resolvePilaSalaryType(
  salarioIntegral: boolean,
  declared: 'X' | 'F' | 'V' | null,
): { valor: 'X' | 'F' | 'V' | null; bloqueos: string[] } {
  if (salarioIntegral) {
    return declared === null || declared === 'X'
      ? { valor: 'X', bloqueos: [] }
      : { valor: null, bloqueos: ['TIPO_SALARIO_PILA_CONTRADICTORIO'] };
  }
  if (declared === 'F' || declared === 'V') {
    return { valor: declared, bloqueos: [] };
  }
  if (declared === 'X') {
    return { valor: null, bloqueos: ['TIPO_SALARIO_PILA_CONTRADICTORIO'] };
  }
  return { valor: null, bloqueos: ['TIPO_SALARIO_PILA_SIN_DECLARAR'] };
}

function validatePilaBasicSalary(salarioBasico: number | null): {
  valor: number | null;
  bloqueos: string[];
} {
  if (
    salarioBasico === null ||
    !Number.isSafeInteger(salarioBasico) ||
    salarioBasico < 0
  ) {
    return { valor: null, bloqueos: ['SALARIO_BASICO_CAMPO_40_NO_VALIDO'] };
  }

  return { valor: salarioBasico, bloqueos: [] };
}

function calendarDate(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}
