export interface PayrollPeriod {
  id: string;
  tenantId: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  status: string;
  empleadosProcesados: number;
  createdAt: string;
}

export interface PayrollRun {
  id: string;
  employeeId: string;
  totalDevengos: number;
  totalDeducciones: number;
  netoPagar: number;
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
  totals: { totalDevengos: number; totalDeducciones: number; totalNeto: number };
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
  closePeriod: (id: string) =>
    req<PayrollPeriod>(`/api/payroll/periods/${id}/close`, { method: 'PATCH', body: '{}' }),
  generatePayroll: (id: string) =>
    req<{ created: number; message: string }>(`/api/payroll/periods/${id}/generate`, {
      method: 'POST',
      body: '{}',
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
