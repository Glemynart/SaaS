export type LoteEstado =
  | 'PENDIENTE'
  | 'EN_PROCESO'
  | 'COMPLETADO'
  | 'COMPLETADO_CON_ERRORES'
  | 'FALLIDO';

export interface LoteErrorEntry {
  empleadoId: string;
  cedula: string;
  error: string;
}

export interface Lote {
  id: string;
  tenantId: string;
  nombreLote: string;
  estado: LoteEstado;
  total: number;
  procesados: number;
  fallidos: number;
  tipoContrato: string | null;
  fechaInicioContrato: string | null;
  fechaFinContrato: string | null;
  iniciadoAt: string | null;
  completadoAt: string | null;
  erroresLog: LoteErrorEntry[];
  documentTemplate: { id: string; nombre: string };
  sede: { id: string; nombre: string } | null;
  creadoPor: { id: string; nombre: string; email: string };
  _count: { contratos: number };
  createdAt: string;
  updatedAt: string;
}

export interface LoteSummary {
  id: string;
  nombreLote: string;
  estado: LoteEstado;
  total: number;
  procesados: number;
  fallidos: number;
  iniciadoAt: string | null;
  completadoAt: string | null;
  documentTemplate: { id: string; nombre: string };
  sede: { id: string; nombre: string } | null;
  _count: { contratos: number };
  createdAt: string;
}

export interface LoteProgress {
  id: string;
  estado: LoteEstado;
  total: number;
  procesados: number;
  fallidos: number;
  iniciadoAt: string | null;
  completadoAt: string | null;
  erroresLog: LoteErrorEntry[];
  porcentaje: number;
}

export interface GetLotesParams {
  page?: number;
  limit?: number;
  search?: string;
  estado?: LoteEstado;
}

export interface CreateLotePayload {
  nombre: string;
  templateId: string;
  empleadoIds: string[];
  sedeId?: string;
  tipoContrato?: string;
  fechaInicio?: string;
  fechaFin?: string;
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

export const lotesApi = {
  getAll: async (params?: GetLotesParams) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', params.page.toString());
    if (params?.limit) sp.set('limit', params.limit.toString());
    if (params?.search) sp.set('search', params.search);
    if (params?.estado) sp.set('estado', params.estado);
    const qs = sp.toString();
    return request<PaginatedResponse<LoteSummary>>(`/api/contracts/lotes${qs ? `?${qs}` : ''}`);
  },

  getById: async (id: string) => {
    return request<Lote>(`/api/contracts/lotes/${id}`);
  },

  getProgress: async (id: string) => {
    return request<LoteProgress>(`/api/contracts/lotes/${id}/progress`);
  },

  create: async (data: CreateLotePayload) => {
    return request<Lote>('/api/contracts/lotes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  process: async (id: string) => {
    return request<Lote>(`/api/contracts/lotes/${id}/process`, { method: 'POST' });
  },

  retry: async (id: string) => {
    return request<Lote>(`/api/contracts/lotes/${id}/retry`, { method: 'POST' });
  },
};
