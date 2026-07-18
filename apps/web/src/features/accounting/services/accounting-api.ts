export type ClaseContable =
  | 'ACTIVO'
  | 'PASIVO'
  | 'PATRIMONIO'
  | 'INGRESOS'
  | 'GASTOS'
  | 'COSTOS_VENTAS'
  | 'COSTOS_PRODUCCION'
  | 'CUENTAS_ORDEN_DEUDORAS'
  | 'CUENTAS_ORDEN_ACREEDORAS';

export type NaturalezaContable = 'DEBITO' | 'CREDITO';

export interface CuentaContable {
  id: string;
  tenantId: string | null;
  codigo: string;
  nombre: string;
  claseContable: ClaseContable;
  naturaleza: NaturalezaContable;
  nivel: number;
  cuentaPadreId: string | null;
  imputable: boolean;
  esCuentaSistema: boolean;
  requiereTercero: boolean;
  requiereCentroCosto: boolean;
  requiereBase: boolean;
  activa: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CuentaContableFilters {
  search?: string;
  claseContable?: ClaseContable;
  imputable?: boolean;
  activa?: boolean;
}

export interface CuentaContablePayload {
  codigo: string;
  nombre: string;
  claseContable: ClaseContable;
  naturaleza: NaturalezaContable;
  nivel: number;
  cuentaPadreId?: string;
  imputable?: boolean;
  requiereTercero?: boolean;
  requiereCentroCosto?: boolean;
  requiereBase?: boolean;
  activa?: boolean;
}

export interface CuentaContableUpdatePayload {
  nombre?: string;
  imputable?: boolean;
  requiereTercero?: boolean;
  requiereCentroCosto?: boolean;
  requiereBase?: boolean;
  activa?: boolean;
}

export interface CuentaSistemaMap {
  id: string;
  tenantId: string;
  rol: string;
  cuentaId: string;
  cuenta: Pick<CuentaContable, 'id' | 'codigo' | 'nombre'>;
  descripcion: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CuentaSistemaMapPayload {
  rol: string;
  cuentaId: string;
  descripcion?: string;
  activo?: boolean;
}

export interface CuentaSistemaMapUpdatePayload {
  cuentaId?: string;
  descripcion?: string;
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

  if (!response.ok) throw new Error(body.message ?? 'No se pudo completar la solicitud.');
  return body as T;
}

function toQueryString(filters?: CuentaContableFilters) {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.claseContable) params.set('claseContable', filters.claseContable);
  if (filters?.imputable !== undefined) params.set('imputable', String(filters.imputable));
  if (filters?.activa !== undefined) params.set('activa', String(filters.activa));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const accountingApi = {
  cuentas: {
    getAll: (filters?: CuentaContableFilters) =>
      request<CuentaContable[]>(`/api/accounting/cuentas-contables${toQueryString(filters)}`),
    create: (data: CuentaContablePayload) =>
      request<CuentaContable>('/api/accounting/cuentas-contables', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: ({ id, data }: { id: string; data: CuentaContableUpdatePayload }) =>
      request<CuentaContable>(`/api/accounting/cuentas-contables/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  mapas: {
    getAll: () => request<CuentaSistemaMap[]>('/api/accounting/cuenta-sistema-map'),
    create: (data: CuentaSistemaMapPayload) =>
      request<CuentaSistemaMap>('/api/accounting/cuenta-sistema-map', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: ({ id, data }: { id: string; data: CuentaSistemaMapUpdatePayload }) =>
      request<CuentaSistemaMap>(`/api/accounting/cuenta-sistema-map/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
};
