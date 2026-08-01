export interface ContractualProfile {
  id: string;
  tenantId: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetContractualProfilesParams {
  search?: string;
  activo?: boolean;
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

export const contractualProfilesApi = {
  getAll: async (params?: GetContractualProfilesParams) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.activo !== undefined) searchParams.set('activo', String(params.activo));

    const qs = searchParams.toString();
    return request<ContractualProfile[]>(`/api/contractual-profiles${qs ? `?${qs}` : ''}`);
  },

  create: async (data: { codigo: string; nombre: string; descripcion?: string }) =>
    request<ContractualProfile>('/api/contractual-profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: async ({ id, data }: { id: string; data: { nombre?: string; descripcion?: string } }) =>
    request<ContractualProfile>(`/api/contractual-profiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateStatus: async ({ id, activo }: { id: string; activo: boolean }) =>
    request<ContractualProfile>(`/api/contractual-profiles/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ activo }),
    }),
};
