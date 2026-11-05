export type IssuerEnvironment = 'HABILITACION' | 'PRODUCCION';
export type NumberingRangeStatus = 'INACTIVO' | 'AGOTADO' | 'FUTURO' | 'VENCIDO' | 'VIGENTE';

export interface ElectronicInvoiceNumberingRange {
  id: string;
  createdAt: string;
  numeroAutorizacion: string;
  fechaAutorizacion: string;
  vigenciaDesde: string;
  vigenciaHasta: string;
  prefijo: string;
  numeroDesde: number;
  numeroHasta: number;
  ultimoNumeroAsignado: number;
  siguienteNumero: number | null;
  estado: 'ACTIVO' | 'INACTIVO';
  estadoOperativo: NumberingRangeStatus;
  motivoInactivacion: string | null;
}

export interface ElectronicInvoiceIssuerProfile {
  id: string;
  ambiente: IssuerEnvironment;
  responsabilidadesTributarias: string[];
  rangos: ElectronicInvoiceNumberingRange[];
}

export interface ElectronicInvoiceConfiguration {
  identidadFiscal: {
    razonSocial: string;
    nombre: string;
    nit: string;
    digitoVerif: string;
    direccion: string | null;
    ciudad: string | null;
    departamento: string | null;
    municipioId: string | null;
    telefono: string | null;
    email: string | null;
  };
  perfiles: ElectronicInvoiceIssuerProfile[];
}

type ApiEnvelope = { message?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope;
  if (!response.ok) throw new Error(body.message ?? 'No fue posible guardar la configuración.');
  return body as T;
}

export const electronicInvoicingApi = {
  getConfiguration: () =>
    request<ElectronicInvoiceConfiguration>('/api/electronic-invoicing/configuration'),
  upsertProfile: (input: {
    ambiente: IssuerEnvironment;
    responsabilidadesTributarias: string[];
    motivo: string;
  }) =>
    request<ElectronicInvoiceIssuerProfile>('/api/electronic-invoicing/profiles', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  createRange: (input: {
    ambiente: IssuerEnvironment;
    numeroAutorizacion: string;
    fechaAutorizacion: string;
    vigenciaDesde: string;
    vigenciaHasta: string;
    prefijo: string;
    numeroDesde: number;
    numeroHasta: number;
    motivo: string;
  }) =>
    request<ElectronicInvoiceNumberingRange>('/api/electronic-invoicing/ranges', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  deactivateRange: (id: string, motivo: string) =>
    request<ElectronicInvoiceNumberingRange>(
      `/api/electronic-invoicing/ranges/${encodeURIComponent(id)}/deactivate`,
      { method: 'PATCH', body: JSON.stringify({ motivo }) },
    ),
};
