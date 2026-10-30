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
  status: PayrollPeriodStatus;
  empleadosProcesados: number;
  createdAt: string;
}

export interface PayrollRun {
  id: string;
  employeeId: string;
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

export interface PayrollDashboard {
  totalPeriodos: number;
  empleadosLiquidados: number;
  totalDevengos: number;
  totalDeducciones: number;
  totalNeto: number;
  ultimoPeriodo: string | null;
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
  createPeriod: (d: { nombre: string; fechaInicio: string; fechaFin: string }) =>
    req<PayrollPeriod>('/api/payroll/periods', { method: 'POST', body: JSON.stringify(d) }),
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
  createNovelty: (d: {
    employeeId: string;
    tipo: string;
    descripcion?: string;
    fecha: string;
    valor?: number;
  }) => req<PayrollNovelty>('/api/payroll/novelties', { method: 'POST', body: JSON.stringify(d) }),
};
