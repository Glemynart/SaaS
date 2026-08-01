import type { ContractualProfile } from '@/features/contractual-profiles/services/contractual-profiles-api';

export interface LaborRelationship {
  id: string;
  tenantId: string;
  empleadoId: string;
  perfilContractualId: string;
  perfilContractual: ContractualProfile;
  vigenteDesde: string;
  vigenteHasta: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
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

export const laborRelationshipsApi = {
  getAll: async (params?: { empleadoId?: string; activo?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.empleadoId) searchParams.set('empleadoId', params.empleadoId);
    if (params?.activo !== undefined) searchParams.set('activo', String(params.activo));

    const qs = searchParams.toString();
    return request<LaborRelationship[]>(`/api/labor-relationships${qs ? `?${qs}` : ''}`);
  },

  create: async (data: {
    empleadoId: string;
    perfilContractualId: string;
    vigenteDesde: string;
    vigenteHasta?: string;
  }) =>
    request<LaborRelationship>('/api/labor-relationships', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: async ({
    id,
    data,
  }: {
    id: string;
    data: {
      perfilContractualId?: string;
      vigenteDesde?: string;
      vigenteHasta?: string;
      activo?: boolean;
    };
  }) =>
    request<LaborRelationship>(`/api/labor-relationships/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
