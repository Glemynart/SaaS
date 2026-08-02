export interface ExpedienteDoc {
  id: string;
  tenantId: string;
  empleadoId: string;
  generatedDocumentId: string | null;
  contratoId: string | null;
  familiaId: string;
  reemplazaId: string | null;
  nombre: string;
  categoria: string;
  storageKey: string;
  mimeType: string;
  tamanoBytes: number;
  descripcion: string | null;
  version: number;
  vigente: boolean;
  createdAt: string;
  familia?: { id: string; nombre: string; categoria: string } | null;
  generatedDocument?: { id: string; nombre: string; tipo: string } | null;
}

export interface ExpedienteDocHistory {
  family: {
    id: string;
    tenantId: string;
    empleadoId: string;
    categoria: string;
    nombre: string;
    descripcion: string | null;
  };
  revisions: ExpedienteDoc[];
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
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope;
  if (!response.ok) throw new Error(body.message ?? 'No se pudo completar la solicitud.');
  return body as T;
}

export const expedienteDocsApi = {
  getByEmployee: async (employeeId: string) => {
    return request<ExpedienteDocsResponse>(`/api/employees/${employeeId}/expediente`);
  },

  uploadManual: async (
    employeeId: string,
    file: File,
    categoria: string,
    familiaId?: string | null,
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('categoria', categoria);
    if (familiaId) formData.append('familiaId', familiaId);
    return request<ExpedienteDoc>(`/api/employees/${employeeId}/expediente`, {
      method: 'POST',
      body: formData,
    });
  },

  delete: async (id: string) => {
    return request<ExpedienteDoc>(`/api/expediente-docs/${id}`, { method: 'DELETE' });
  },

  getHistory: async (id: string) => {
    return request<ExpedienteDocHistory>(`/api/expediente-docs/${id}/history`);
  },

  getDownloadUrl: (id: string) => `/api/expediente-docs/${id}/download`,
};
