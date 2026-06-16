export interface GeneratedDocument {
  id: string;
  tenantId: string;
  employeeId: string;
  templateId: string;
  nombre: string;
  contenidoFinal: string;
  pdfUrl: string | null;
  tipo: string;
  createdAt: string;
  employee: {
    id: string;
    nombre?: string | null;
    apellido?: string | null;
    primerNombre: string;
    segundoNombre: string | null;
    primerApellido: string;
    segundoApellido: string | null;
    cedula: string;
    cargo: string;
    tipoDocumento?: string;
  };
  template: {
    id: string;
    nombre: string;
    tipo: string;
  };
}

export interface GetGeneratedDocumentsParams {
  page?: number;
  limit?: number;
  search?: string;
  employeeId?: string;
  tipo?: string;
}

export interface CreateGeneratedDocumentPayload {
  employeeId: string;
  templateId: string;
  nombre: string;
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

export const generatedDocumentsApi = {
  getAll: async (params?: GetGeneratedDocumentsParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.employeeId) searchParams.set('employeeId', params.employeeId);
    if (params?.tipo) searchParams.set('tipo', params.tipo);

    const qs = searchParams.toString();
    return request<PaginatedResponse<GeneratedDocument>>(
      `/api/generated-documents${qs ? `?${qs}` : ''}`,
    );
  },

  getById: async (id: string) => {
    return request<GeneratedDocument>(`/api/generated-documents/${id}`);
  },

  generate: async (payload: CreateGeneratedDocumentPayload) => {
    return request<GeneratedDocument>('/api/generated-documents/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  delete: async (id: string) => {
    return request<GeneratedDocument>(`/api/generated-documents/${id}`, {
      method: 'DELETE',
    });
  },

  generatePdf: async (id: string) => {
    return request<{ id: string; pdfUrl: string; nombre: string }>(
      `/api/generated-documents/${id}/generate-pdf`,
      { method: 'POST', body: '{}' },
    );
  },

  getPdfUrl: (id: string) => {
    return `/api/generated-documents/${id}/pdf`;
  },
};
