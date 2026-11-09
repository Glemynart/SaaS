export type PayrollPeriodStatus =
  | 'DRAFT'
  | 'CLOSED'
  | 'BORRADOR'
  | 'CALCULADA'
  | 'EN_REVISION'
  | 'APROBADA'
  | 'CAUSADA'
  | 'CERRADA';

export interface PayrollPeriod {
  id: string;
  tenantId: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  fechaPrevistaPagoPila: string | null;
  status: PayrollPeriodStatus;
  empleadosProcesados: number;
  createdAt: string;
}

export interface PayrollRun {
  id: string;
  employeeId: string;
  pilaFspSourceScope: 'UNCONFIRMED' | 'SINGLE_SOURCE_CONFIRMED' | 'MULTIPLE_SOURCES';
  pilaFspSourceScopeUpdatedAt: string | null;
  pilaFspSourceScopeUpdatedById: string | null;
  pilaVoluntaryPensionStatus: 'UNCONFIRMED' | 'NONE_CONFIRMED' | 'PRESENT';
  pilaVoluntaryPensionUpdatedAt: string | null;
  pilaVoluntaryPensionUpdatedById: string | null;
  centroCostoId: string | null;
  totalDevengos: number;
  totalDeducciones: number;
  netoPagar: number;
  centroCosto: {
    id: string;
    codigo: string;
    nombre: string;
    sedeId: string | null;
  } | null;
  employee: {
    id: string;
    primerNombre: string;
    segundoNombre: string | null;
    primerApellido: string;
    segundoApellido: string | null;
    cedula: string;
    cargo: string;
  };
  concepts: PayrollConcept[];
}

export interface PayrollConcept {
  id: string;
  tipo: string;
  nombre: string;
  valor: number;
}

export interface PayrollNovelty {
  id: string;
  employeeId: string;
  tipo: string;
  descripcion: string | null;
  fecha: string;
  valor: number | null;
  employee: {
    id: string;
    primerNombre: string;
    segundoNombre: string | null;
    primerApellido: string;
    segundoApellido: string | null;
  };
}

export type PilaEventCode =
  | 'ING'
  | 'RET'
  | 'VSP'
  | 'VST'
  | 'SLN'
  | 'IGE'
  | 'LMA'
  | 'VAC_LR'
  | 'IRL'
  | 'VCT';

export type PilaVacLrSubtype = 'VACACIONES_DISFRUTADAS' | 'LICENCIA_REMUNERADA';

export interface PayrollPilaEvent {
  id: string;
  tenantId: string;
  payrollPeriodId: string;
  employeeId: string;
  codigo: PilaEventCode;
  subtipo: PilaVacLrSubtype | null;
  fechaInicio: string;
  fechaFin: string | null;
  dias: number | null;
  createdAt: string;
  employee: {
    id: string;
    primerNombre: string;
    segundoNombre: string | null;
    primerApellido: string;
    segundoApellido: string | null;
  };
}

export interface PilaPreparationIssue {
  record: 'APORTANTE_TIPO_1' | 'CABECERA_TIPO_2' | 'DETALLE_TIPO_2' | 'SNAPSHOT';
  fieldNumber: number | null;
  code: string;
  message: string;
  affectedEmployees: PilaPreparationAffectedEmployee[];
  affectedCount: number;
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
    | 'OPERATOR_UPLOAD_NOT_VERIFIED';
  scope: 'FILE_GENERATION' | 'OPERATOR_COMPATIBILITY';
  title: string;
  message: string;
  fields: Array<{
    record: PilaPreparationIssue['record'];
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

export interface PilaAt2V30HeaderCandidate {
  formatVersion: 'AT2_V30';
  supportedSnapshots: boolean;
  tenantId: string | null;
  payrollPeriodId: string | null;
  values: Partial<Record<number, { value: string | number | null; emptyAs?: 'spaces' | 'zeros' }>>;
  unresolvedFields: Array<{
    fieldNumber: number;
    code: string;
    reason: string;
  }>;
}

export interface PilaAt2V30EmployerCandidate {
  formatVersion: 'AT2_V30';
  supportedSnapshots: boolean;
  tenantId: string | null;
  payrollPeriodId: string;
  values: Partial<Record<number, { value: string | number | null; emptyAs?: 'spaces' | 'zeros' }>>;
  unresolvedFields: Array<{ fieldNumber: number; reason: string }>;
}

export interface PilaPreparationReport {
  formatVersion: null;
  normativeSourceStatus: 'RECONCILIATION_PENDING';
  exportReadiness: {
    recordLayoutVersion: 'AT2_V30';
    fileGenerationStatus: 'IMPLEMENTED';
    localValidationStatus: 'PER_EXPORT';
    operatorAcceptanceStatus: 'NOT_VERIFIED';
    blockers: PilaExportReadinessBlocker[];
  };
  period: {
    id: string;
    fechaInicio: string;
    fechaFin: string;
    fechaPrevistaPagoPila: string | null;
  };
  snapshotsRevisados: number;
  pensionTransitionSummary: {
    totalSnapshots: number;
    statusS: number;
    statusN: number;
    sinValorUtilizable: number;
    historicosSinCampo5: number;
    alcanceNoVerificado: number;
    versionIncompatible: number;
  };
  empleadosConDatosPendientes: number;
  empleadosSinBrechasDetectadas: number;
  detailRecordSequence: {
    status: 'CANDIDATE' | 'PENDING';
    candidateRecords: number;
    ruleVersion: string | null;
    pendingReason: string | null;
  };
  detailSequenceCandidates: PilaDetailFieldCandidateStatus[];
  detailContributionCandidates: PilaDetailFieldCandidateStatus[];
  detailSourceFieldCandidates?: PilaDetailFieldCandidateStatus[];
  detailLocationFieldCandidates?: PilaDetailFieldCandidateStatus[];
  detailNoEventFieldCandidates: PilaDetailFieldCandidateStatus[];
  detailAbsentEventCandidates: PilaDetailFieldCandidateStatus[];
  detailStandardDependentEmptyCandidates: PilaDetailFieldCandidateStatus[];
  detailNonExemptCotizanteCandidates: PilaDetailFieldCandidateStatus[];
  detailPrivateEmployerEsapMenCandidates: PilaDetailFieldCandidateStatus[];
  employerCandidate: PilaAt2V30EmployerCandidate;
  headerCandidate: PilaAt2V30HeaderCandidate;
  issues: PilaPreparationIssue[];
  archivoGenerable: boolean;
  estadoArchivo: 'LISTO_PARA_GENERAR' | 'BLOQUEADO';
  mensaje: string;
}

export interface PilaExportSummary {
  id: string;
  createdAt: string;
  status: 'LOCAL_VALIDATED';
  period: {
    fechaInicio: string;
    fechaFin: string;
    fechaPrevistaPagoPila: string | null;
  };
  normativeVersion: string;
  fileFormatVersion: string;
  normativeRuleVersions: string[];
  sourceSnapshotCount: number;
  type1: { sha256: string; sizeBytes: number; recordCount: number };
  type2: {
    sha256: string;
    sizeBytes: number;
    recordCount: number;
    detailRecordCount: number;
  };
  operatorCompatibilityStatus: 'NOT_VERIFIED';
}

export interface PayrollDashboard {
  totalPeriodos: number;
  empleadosLiquidados: number;
  totalDevengos: number;
  totalDeducciones: number;
  totalNeto: number;
  ultimoPeriodo: string | null;
}

export type ServicePremiumLineStatus =
  | 'LISTA'
  | 'BLOQUEADA'
  | 'NO_APLICA'
  | 'APROBADA'
  | 'PROCESANDO'
  | 'DOCUMENTADA'
  | 'ERROR';

export interface ServicePremiumLine {
  id: string;
  status: ServicePremiumLineStatus;
  salaryBase: number | string | null;
  variableSalary: number | string | null;
  transportAllowance: number | string | null;
  serviceDays360: number | null;
  amount: number | string | null;
  blockReason: string | null;
  lastErrorCode: string | null;
  sourceFingerprint: string | null;
  snapshot?: unknown;
  employee: {
    id: string;
    cedula: string;
    primerNombre: string;
    segundoNombre: string | null;
    primerApellido: string;
    segundoApellido: string | null;
  };
  expedienteDoc: { id: string } | null;
}

export interface ServicePremiumBatch {
  id: string;
  anio: number;
  semestre: number;
  version: number;
  formulaVersion: number;
  status:
    | 'BORRADOR'
    | 'APROBADO'
    | 'PROCESANDO'
    | 'COMPLETADO'
    | 'COMPLETADO_CON_BLOQUEOS'
    | 'ERROR'
    | 'ANULADO';
  correctionReason: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  _count?: { lines: number };
  lines?: ServicePremiumLine[];
}

export interface PeriodDetail {
  period: PayrollPeriod;
  runs: PayrollRun[];
  snapshots: PayrollCorrectionTarget[];
  totals: { totalDevengos: number; totalDeducciones: number; totalNeto: number };
  accountingVoucher: PayrollAccountingVoucher | null;
}

export interface PayrollCorrectionTarget {
  id: string;
  employeeId: string;
  centroCostoId: string | null;
  employee: {
    id: string;
    primerNombre: string;
    segundoNombre: string | null;
    primerApellido: string;
    segundoApellido: string | null;
  };
  centroCosto: { id: string; codigo: string; nombre: string } | null;
}

export interface PayrollAccountingMovement {
  linea: number;
  descripcion: string | null;
  debito: number;
  credito: number;
  cuentaCodigo: string;
  cuentaNombre: string;
  centroCostoCodigo: string | null;
  centroCostoNombre: string | null;
}

export interface PayrollAccountingVoucher {
  id: string;
  numero: number | null;
  fecha: string;
  concepto: string;
  estado: string;
  reversado: boolean;
  vigente: boolean;
  totalDebito: number;
  totalCredito: number;
  movimientos: PayrollAccountingMovement[];
}

export interface PayrollAccountingPreflightValidation {
  code: string;
  message: string;
  severity: 'OK' | 'WARNING' | 'ERROR';
  component: string;
}

export type PayrollAccountingResult =
  | {
      status: 'PREFLIGHT_ERROR';
      preflight: {
        status: 'ERROR';
        validations: PayrollAccountingPreflightValidation[];
      };
    }
  | {
      status: 'CAUSADA' | 'YA_CAUSADA';
      payrollPeriodId: string;
      comprobanteId: string;
    };

export type PayrollCorrectionStatus =
  | 'BORRADOR'
  | 'EN_REVISION'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'CANCELADA';

export type PayrollCorrectionIntentPayload =
  | {
      kind: 'SET_CALCULATION_INPUT';
      snapshotId: string;
      input: 'SALARIO_BASE' | 'BONUS' | 'OVERTIME';
      targetAmount: number;
    }
  | { kind: 'MOVE_COST_CENTER'; snapshotId: string; targetCostCenterId: string };

export interface PayrollCorrection {
  id: string;
  payrollPeriodId: string;
  status: PayrollCorrectionStatus;
  descripcion: string;
  createdAt: string;
  intent: unknown;
  materialization: unknown;
  accountingVoucher?: PayrollAccountingVoucher | null;
}

export type PayrollCorrectionAction =
  | 'enviar-revision'
  | 'aprobar'
  | 'rechazar'
  | 'cancelar'
  | 'contabilizar';

export interface PayrollCorrectionAccountingResult {
  status: 'AJUSTADA' | 'YA_AJUSTADA';
  payrollCorrectionId: string;
  comprobanteId: string;
}

export type PayrollCorrectionActionResult = PayrollCorrection | PayrollCorrectionAccountingResult;

export interface PayrollOperationResult {
  created?: number;
  recalculated?: number;
  message: string;
  warnings?: Record<string, string[]>;
  blocks?: Record<string, string[]>;
}

export type PayrollBlockStatus = 'ACTIVE' | 'RESOLVED' | 'EXCLUDED';

export interface PayrollBlock {
  id: string;
  tenantId: string;
  payrollPeriodId: string;
  employeeId: string;
  code: string;
  message: string;
  status: PayrollBlockStatus;
  detectedAt: string;
  resolvedAt: string | null;
  excludedAt: string | null;
  excludedById: string | null;
  exclusionReason: string | null;
  employee: {
    id: string;
    primerNombre: string;
    segundoNombre: string | null;
    primerApellido: string;
    segundoApellido: string | null;
    cedula: string;
    cargo: string;
  };
  excludedBy: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
  } | null;
}

type ApiEnvelope = { message?: string };
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const b = (await r.json().catch(() => ({}))) as ApiEnvelope;
  if (!r.ok) throw new Error(b.message ?? 'Error');
  return b as T;
}

export const payrollApi = {
  getDashboard: () => req<PayrollDashboard>('/api/payroll/dashboard'),
  getPeriods: () => req<PayrollPeriod[]>('/api/payroll/periods'),
  createPeriod: (d: {
    nombre: string;
    fechaInicio: string;
    fechaFin: string;
    fechaPrevistaPagoPila?: string | null;
  }) => req<PayrollPeriod>('/api/payroll/periods', { method: 'POST', body: JSON.stringify(d) }),
  updatePilaPaymentDate: (id: string, fechaPrevistaPagoPila: string | null) =>
    req<PayrollPeriod>(`/api/payroll/periods/${id}/fecha-prevista-pago-pila`, {
      method: 'PATCH',
      body: JSON.stringify({ fechaPrevistaPagoPila }),
    }),
  updatePilaFspSourceScope: (runId: string, sourceScope: PayrollRun['pilaFspSourceScope']) =>
    req<
      Pick<
        PayrollRun,
        | 'id'
        | 'employeeId'
        | 'pilaFspSourceScope'
        | 'pilaFspSourceScopeUpdatedAt'
        | 'pilaFspSourceScopeUpdatedById'
      >
    >(`/api/payroll/runs/${runId}/pila-fsp-source-scope`, {
      method: 'PATCH',
      body: JSON.stringify({ sourceScope }),
    }),
  updatePilaVoluntaryPensionStatus: (
    runId: string,
    status: PayrollRun['pilaVoluntaryPensionStatus'],
  ) =>
    req<
      Pick<
        PayrollRun,
        | 'id'
        | 'employeeId'
        | 'pilaVoluntaryPensionStatus'
        | 'pilaVoluntaryPensionUpdatedAt'
        | 'pilaVoluntaryPensionUpdatedById'
      >
    >(`/api/payroll/runs/${runId}/pila-voluntary-pension-status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getPeriod: (id: string) => req<PeriodDetail>(`/api/payroll/periods/${id}`),
  getCorrections: (periodId: string) =>
    req<PayrollCorrection[]>(`/api/payroll/periods/${periodId}/corrections`),
  createCorrection: (
    periodId: string,
    payload: { descripcion: string; intents: PayrollCorrectionIntentPayload[] },
  ) =>
    req<PayrollCorrection>(`/api/payroll/periods/${periodId}/corrections`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  generatePayroll: (id: string) =>
    req<PayrollOperationResult>(`/api/payroll/periods/${id}/generate`, {
      method: 'POST',
      body: '{}',
    }),
  recalculatePayroll: (id: string) =>
    req<PayrollOperationResult>(`/api/payroll/periods/${id}/recalculate`, {
      method: 'POST',
      body: '{}',
    }),
  enviarARevision: (id: string) =>
    req<PayrollPeriod>(`/api/payroll/periods/${id}/enviar-revision`, {
      method: 'POST',
      body: '{}',
    }),
  aprobar: (id: string) =>
    req<PayrollPeriod>(`/api/payroll/periods/${id}/aprobar`, { method: 'POST', body: '{}' }),
  contabilizar: (id: string) =>
    req<PayrollAccountingResult>(`/api/payroll/periods/${id}/contabilizar`, {
      method: 'POST',
      body: '{}',
    }),
  transitionCorrection: (id: string, action: PayrollCorrectionAction, motivo?: string) =>
    req<PayrollCorrectionActionResult>(`/api/payroll/corrections/${id}/${action}`, {
      method: 'POST',
      body: JSON.stringify(motivo ? { motivo } : {}),
    }),
  rechazar: (id: string, motivo?: string) =>
    req<PayrollPeriod>(`/api/payroll/periods/${id}/rechazar`, {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    }),
  reabrir: (id: string) =>
    req<PayrollPeriod>(`/api/payroll/periods/${id}/reabrir`, { method: 'POST', body: '{}' }),
  getBlocks: (periodId: string) => req<PayrollBlock[]>(`/api/payroll/periods/${periodId}/blocks`),
  excludeBlock: (blockId: string, motivo?: string) =>
    req<PayrollBlock>(`/api/payroll/blocks/${blockId}/exclude`, {
      method: 'PATCH',
      body: JSON.stringify({ motivo }),
    }),
  getNovelties: (employeeId?: string) =>
    req<PayrollNovelty[]>(`/api/payroll/novelties${employeeId ? `?employeeId=${employeeId}` : ''}`),
  getPilaEvents: (periodId: string) =>
    req<PayrollPilaEvent[]>(`/api/payroll/periods/${periodId}/pila-events`),
  getPilaPreparation: (periodId: string) =>
    req<PilaPreparationReport>(`/api/payroll/periods/${periodId}/pila-preparation`),
  getPilaExports: (periodId: string) =>
    req<PilaExportSummary[]>(`/api/payroll/periods/${periodId}/pila-exports`),
  createPilaExport: (periodId: string) =>
    req<PilaExportSummary>(`/api/payroll/periods/${periodId}/pila-exports`, {
      method: 'POST',
      body: '{}',
    }),
  createPilaEvent: (
    periodId: string,
    payload: {
      employeeId: string;
      codigo: PilaEventCode;
      subtipo?: PilaVacLrSubtype;
      fechaInicio: string;
      fechaFin?: string;
      dias?: number;
    },
  ) =>
    req<PayrollPilaEvent>(`/api/payroll/periods/${periodId}/pila-events`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deletePilaEvent: (eventId: string) =>
    req<{ deleted: true }>(`/api/payroll/pila-events/${eventId}`, { method: 'DELETE' }),
  createNovelty: (d: {
    employeeId: string;
    tipo: string;
    descripcion?: string;
    fecha: string;
    valor?: number;
  }) => req<PayrollNovelty>('/api/payroll/novelties', { method: 'POST', body: JSON.stringify(d) }),
  getServicePremiumBatches: () => req<ServicePremiumBatch[]>('/api/payroll/service-premiums'),
  getServicePremiumBatch: (id: string) =>
    req<ServicePremiumBatch>(`/api/payroll/service-premiums/${id}`),
  createServicePremiumBatch: (payload: { year: number; semester: number }) =>
    req<ServicePremiumBatch>('/api/payroll/service-premiums', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  approveServicePremiumBatch: (id: string) =>
    req<ServicePremiumBatch>(`/api/payroll/service-premiums/${id}/approve`, {
      method: 'POST',
      body: '{}',
    }),
  retryServicePremiumBatch: (id: string) =>
    req<{ batchId: string; retriedLines: number; status: string }>(
      `/api/payroll/service-premiums/${id}/retry`,
      { method: 'POST', body: '{}' },
    ),
  correctServicePremiumBatch: (id: string, reason: string) =>
    req<ServicePremiumBatch>(`/api/payroll/service-premiums/${id}/corrections`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};
