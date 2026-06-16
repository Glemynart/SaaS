export interface Employee {
  id: string;
  tenantId: string;
  cedula: string;
  tipoDocumento: 'CC' | 'CE' | 'TI' | 'PA' | 'NIT' | 'PEP' | 'PPT';
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
  email: string | null;
  telefono: string | null;
  fechaNacimiento: string | null;
  cargo: string;
  dependencia: string | null;
  sede: string | null;
  sedeId: string | null;
  sedeRef: { id: string; nombre: string } | null;
  salario: number;
  tipoContrato: string;
  fechaIngreso: string;
  estado: string;
  eps: string | null;
  arl: string | null;
  fondoPension: string | null;
  cajaCompensacion: string | null;
  municipioExpedicionDocId: string | null;
  salarioIntegral: boolean;
  jornadaLaboral: string | null;
  fechaRetiro: string | null;
  motivoRetiro: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetEmployeesParams {
  page?: number;
  limit?: number;
  search?: string;
  estado?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

type ApiEnvelope<T> = T & { message?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

  if (!response.ok) {
    throw new Error(body.message ?? 'No se pudo completar la solicitud.');
  }

  return body as T;
}

export const employeesApi = {
  getAll: async (params?: GetEmployeesParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.estado) searchParams.set('estado', params.estado);

    const qs = searchParams.toString();
    return request<PaginatedResponse<Employee>>(`/api/employees${qs ? `?${qs}` : ''}`);
  },

  getById: async (id: string) => {
    return request<Employee>(`/api/employees/${id}`);
  },

  create: async (data: Partial<Employee>) => {
    return request<Employee>('/api/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async ({ id, data }: { id: string; data: Partial<Employee> }) => {
    return request<Employee>(`/api/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string) => {
    return request<Employee>(`/api/employees/${id}`, {
      method: 'DELETE',
    });
  },
};
