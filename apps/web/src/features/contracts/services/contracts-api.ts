export interface ContractEmployee {
  id: string;
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
  cedula: string;
  cargo: string;
  tipoDocumento?: string;
}

export interface ContractSede {
  id: string;
  nombre: string;
}

export interface ContractGeneratedDocument {
  id: string;
  nombre: string;
  pdfUrl: string | null;
  expedienteDocId: string | null;
}

export interface Contract {
  id: string;
  tenantId: string;
  employeeId: string;
  tipo: string;
  estado: string;
  cargo: string;
  salario: number;
  fechaInicio: string;
  fechaFin: string | null;
  createdAt: string;
  updatedAt: string;
  empleado: ContractEmployee;
  sede: ContractSede | null;
  plantilla: { id: string; nombre: string } | null;
  lote: { id: string; estado: string } | null;
  generatedDocument?: ContractGeneratedDocument | null;
}

export interface GetContractsParams {
  page?: number;
  limit?: number;
  search?: string;
  employeeId?: string;
  estado?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

type ApiEnvelope<T> = T & { message?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok) throw new Error(body.message ?? 'No se pudo completar la solicitud.');
  return body as T;
}

export const contractsApi = {
  getAll: async (params?: GetContractsParams) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', params.page.toString());
    if (params?.limit) sp.set('limit', params.limit.toString());
    if (params?.search) sp.set('search', params.search);
    if (params?.employeeId) sp.set('employeeId', params.employeeId);
    if (params?.estado) sp.set('estado', params.estado);
    const qs = sp.toString();
    return request<PaginatedResponse<Contract>>(`/api/contracts${qs ? `?${qs}` : ''}`);
  },

  getById: async (id: string) => {
    return request<Contract>(`/api/contracts/${id}`);
  },

  create: async (data: CreateContractPayload) => {
    return request<Contract>('/api/contracts', { method: 'POST', body: JSON.stringify(data) });
  },

  updateStatus: async (id: string, estado: string) => {
    return request<Contract>(`/api/contracts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    });
  },
};

export interface CreateContractPayload {
  employeeId: string;
  tipo: string;
  cargo: string;
  salario: number;
  fechaInicio: string;
  fechaFin?: string;
  sedeId?: string;
}
