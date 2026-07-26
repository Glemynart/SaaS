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

export type TipoDocumentoTercero = 'CC' | 'CE' | 'TI' | 'PA' | 'NIT' | 'PEP' | 'PPT';
export type TipoPersona = 'NATURAL' | 'JURIDICA';

export interface Tercero {
  id: string;
  tenantId: string;
  tipoDocumento: TipoDocumentoTercero;
  numeroDocumento: string;
  digitoVerificacion: string | null;
  tipoPersona: TipoPersona;
  razonSocial: string | null;
  primerNombre: string | null;
  segundoNombre: string | null;
  primerApellido: string | null;
  segundoApellido: string | null;
  nombreComercial: string | null;
  esCliente: boolean;
  esProveedor: boolean;
  esEmpleado: boolean;
  esEntidadGubernamental: boolean;
  esBanco: boolean;
  responsabilidadesFiscales: string[];
  regimenSimple: boolean;
  granContribuyente: boolean;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  municipioId: string | null;
  activo: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TerceroFilters {
  search?: string;
  esCliente?: boolean;
  esProveedor?: boolean;
  activo?: boolean;
}

export interface TerceroPayload {
  tipoDocumento: TipoDocumentoTercero;
  numeroDocumento: string;
  digitoVerificacion?: string;
  tipoPersona: TipoPersona;
  razonSocial?: string;
  primerNombre?: string;
  segundoNombre?: string;
  primerApellido?: string;
  segundoApellido?: string;
  nombreComercial?: string;
  esCliente?: boolean;
  esProveedor?: boolean;
  esEmpleado?: boolean;
  esEntidadGubernamental?: boolean;
  esBanco?: boolean;
  responsabilidadesFiscales?: string[];
  regimenSimple?: boolean;
  granContribuyente?: boolean;
  email?: string;
  telefono?: string;
  direccion?: string;
  municipioId?: string;
  activo?: boolean;
}

export type TerceroUpdatePayload = Omit<
  Partial<TerceroPayload>,
  'tipoDocumento' | 'numeroDocumento'
>;

export interface CentroCosto {
  id: string;
  tenantId: string;
  codigo: string;
  nombre: string;
  sedeId: string | null;
  activo: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CentroCostoFilters {
  search?: string;
  activo?: boolean;
}

export interface CentroCostoPayload {
  codigo: string;
  nombre: string;
  sedeId?: string;
  activo?: boolean;
}

export interface CentroCostoUpdatePayload {
  nombre?: string;
  sedeId?: string;
  activo?: boolean;
}

export type EstadoPeriodo = 'ABIERTO' | 'CERRADO';

export interface PeriodoContable {
  id: string;
  tenantId: string;
  anio: number;
  mes: number;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoPeriodo;
  cerradoAt: string | null;
  cerradoPorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PeriodoContableFilters {
  anio?: number;
  estado?: EstadoPeriodo;
}

export interface ValidacionCierrePeriodo {
  procede: boolean;
  bloqueos: string[];
}

export interface CerrarPeriodoResult {
  cerrado: boolean;
  yaEstabaCerrado: boolean;
  bloqueos?: string[];
}

export interface ReabrirPeriodoResult {
  reabierto: boolean;
  yaEstabaAbierto: boolean;
  bloqueos?: string[];
}

export interface CerrarAnioResult {
  posteado: boolean;
  yaEstabaPosteado: boolean;
  sinResultados?: boolean;
  diciembreCerrado: boolean;
  comprobanteIds?: string[];
  bloqueos?: string[];
}

export interface TipoComprobante {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
}
export interface ManualJournalLine {
  cuentaId: string;
  terceroId?: string;
  centroCostoId?: string;
  debito: number;
  credito: number;
  baseGravable?: number;
  descripcion?: string;
}
export interface ManualJournalPayload {
  tipoComprobanteId: string;
  periodoId: string;
  fecha: string;
  concepto: string;
  lineas: ManualJournalLine[];
}
export interface ManualJournalResult {
  id: string;
  numero?: number | null;
  estado?: string;
  [key: string]: unknown;
}
export interface ReportQuery {
  [key: string]: string | number | boolean | undefined;
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

function toTerceroQueryString(filters?: TerceroFilters) {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.esCliente !== undefined) params.set('esCliente', String(filters.esCliente));
  if (filters?.esProveedor !== undefined) params.set('esProveedor', String(filters.esProveedor));
  if (filters?.activo !== undefined) params.set('activo', String(filters.activo));
  const query = params.toString();
  return query ? `?${query}` : '';
}

function toCentroCostoQueryString(filters?: CentroCostoFilters) {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.activo !== undefined) params.set('activo', String(filters.activo));
  const query = params.toString();
  return query ? `?${query}` : '';
}

function toPeriodoQueryString(filters?: PeriodoContableFilters) {
  const params = new URLSearchParams();
  if (filters?.anio !== undefined) params.set('anio', String(filters.anio));
  if (filters?.estado) params.set('estado', filters.estado);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function toReportQueryString(filters?: ReportQuery) {
  const params = new URLSearchParams();
  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
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
  terceros: {
    getAll: (filters?: TerceroFilters) =>
      request<Tercero[]>(`/api/accounting/terceros${toTerceroQueryString(filters)}`),
    create: (data: TerceroPayload) =>
      request<Tercero>('/api/accounting/terceros', { method: 'POST', body: JSON.stringify(data) }),
    update: ({ id, data }: { id: string; data: TerceroUpdatePayload }) =>
      request<Tercero>(`/api/accounting/terceros/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  centrosCosto: {
    getAll: (filters?: CentroCostoFilters) =>
      request<CentroCosto[]>(`/api/accounting/centros-costo${toCentroCostoQueryString(filters)}`),
    create: (data: CentroCostoPayload) =>
      request<CentroCosto>('/api/accounting/centros-costo', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: ({ id, data }: { id: string; data: CentroCostoUpdatePayload }) =>
      request<CentroCosto>(`/api/accounting/centros-costo/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  periodos: {
    getAll: (filters?: PeriodoContableFilters) =>
      request<PeriodoContable[]>(
        `/api/accounting/periodos-contables${toPeriodoQueryString(filters)}`,
      ),
    create: (data: { anio: number; mes: number }) =>
      request<PeriodoContable>('/api/accounting/periodos-contables', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    generarAnio: (anio: number) =>
      request<PeriodoContable[]>('/api/accounting/periodos-contables/generar-anio', {
        method: 'POST',
        body: JSON.stringify({ anio }),
      }),
  },
  cierres: {
    validar: (periodoId: string) =>
      request<ValidacionCierrePeriodo>(`/api/accounting/cierres/periodos/${periodoId}/validar`),
    cerrar: (periodoId: string) =>
      request<CerrarPeriodoResult>(`/api/accounting/cierres/periodos/${periodoId}/cerrar`, {
        method: 'POST',
      }),
    reabrir: ({ periodoId, motivo }: { periodoId: string; motivo: string }) =>
      request<ReabrirPeriodoResult>(`/api/accounting/cierres/periodos/${periodoId}/reabrir`, {
        method: 'POST',
        body: JSON.stringify({ motivo }),
      }),
    cerrarAnio: (anio: number) =>
      request<CerrarAnioResult>(`/api/accounting/cierres/anios/${anio}/cerrar`, { method: 'POST' }),
  },
  tiposComprobante: {
    getAll: () => request<TipoComprobante[]>('/api/accounting/tipos-comprobante?activo=true'),
  },
  comprobantes: {
    registrar: (data: ManualJournalPayload) =>
      request<ManualJournalResult>('/api/accounting/comprobantes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    anular: ({ id, motivo }: { id: string; motivo: string }) =>
      request<ManualJournalResult>(`/api/accounting/comprobantes/${id}/anular`, {
        method: 'POST',
        body: JSON.stringify({ motivo }),
      }),
  },
  reportes: {
    get: <T>(path: string, filters?: ReportQuery) =>
      request<T>(`/api/accounting/reportes/${path}${toReportQueryString(filters)}`),
  },
};
