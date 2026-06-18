export interface ExpedienteDoc {
  id: string;
  tenantId: string;
  empleadoId: string;
  generatedDocumentId: string | null;
  contratoId: string | null;
  nombre: string;
  categoria: string;
  storageKey: string;
  mimeType: string;
  tamanoBytes: number;
  descripcion: string | null;
  version: number;
  createdAt: string;
  generatedDocument?: { id: string; nombre: string; tipo: string } | null;
}

export interface ExpedienteDocsStats {
  total: number;
  byCategory: Record<string, number>;
  ultimoDocumento: string | null;
}

export interface ExpedienteDocsResponse {
  docs: ExpedienteDoc[];
  stats: ExpedienteDocsStats;
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

export const expedienteDocsApi = {
  getByEmployee: async (employeeId: string) => {
    return request<ExpedienteDocsResponse>(`/api/employees/${employeeId}/expediente`);
  },

  delete: async (id: string) => {
    return request<ExpedienteDoc>(`/api/expediente-docs/${id}`, { method: 'DELETE' });
  },
};
