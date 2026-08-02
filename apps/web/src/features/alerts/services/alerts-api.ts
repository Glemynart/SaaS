export interface AlertItem {
  id: string;
  tenantId: string;
  employeeId: string | null;
  expedienteDocId: string | null;
  titulo: string;
  descripcion: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'RESOLVED';
  dueDate: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  employee: {
    id: string;
    primerNombre: string;
    segundoNombre: string | null;
    primerApellido: string;
    segundoApellido: string | null;
    cedula: string;
    cargo: string;
  } | null;
  expedienteDoc: { id: string; nombre: string; categoria: string } | null;
}

export interface AlertStats {
  open: number;
  resolved: number;
  critical: number;
}

export interface AlertsResponse {
  data: AlertItem[];
  stats: AlertStats;
  meta: { total: number; page: number; limit: number; totalPages: number };
}

type ApiEnvelope = { message?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope;
  if (!response.ok) throw new Error(body.message ?? 'No se pudo completar la solicitud.');
  return body as T;
}

export const alertsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    severity?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', params.page.toString());
    if (params?.limit) sp.set('limit', params.limit.toString());
    if (params?.status) sp.set('status', params.status);
    if (params?.severity) sp.set('severity', params.severity);
    const qs = sp.toString();
    return request<AlertsResponse>(`/api/alerts${qs ? `?${qs}` : ''}`);
  },

  resolve: async (id: string) => {
    return request<AlertItem>(`/api/alerts/${id}/resolve`, { method: 'PATCH', body: '{}' });
  },

  generateContractAlerts: async () => {
    return request<{ created: number; message: string }>('/api/alerts/generate-contract-alerts', {
      method: 'POST',
      body: '{}',
    });
  },

  generateMissingDocAlerts: async () => {
    return request<{ created: number; message: string }>(
      '/api/alerts/generate-missing-doc-alerts',
      { method: 'POST', body: '{}' },
    );
  },
};
