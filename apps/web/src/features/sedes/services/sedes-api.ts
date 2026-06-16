export interface MunicipioRef {
  id: string;
  nombre: string;
  departamento: string;
}

export interface Sede {
  id: string;
  tenantId: string;
  nombre: string;
  direccion: string | null;
  municipioId: string | null;
  municipio: MunicipioRef | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetSedesParams {
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

export const sedesApi = {
  getAll: async (params?: GetSedesParams) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.activo !== undefined) searchParams.set('activo', String(params.activo));

    const qs = searchParams.toString();
    return request<Sede[]>(`/api/sedes${qs ? `?${qs}` : ''}`);
  },

  getById: async (id: string) => {
    return request<Sede>(`/api/sedes/${id}`);
  },

  create: async (data: Partial<Sede>) => {
    return request<Sede>('/api/sedes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async ({ id, data }: { id: string; data: Partial<Sede> }) => {
    return request<Sede>(`/api/sedes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};
