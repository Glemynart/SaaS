export interface DocumentTemplate {
  id: string;
  tenantId: string;
  nombre: string;
  descripcion: string | null;
  tipo: DocumentTemplateType;
  contenido: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type DocumentTemplateType = 'CONTRACT' | 'CERTIFICATION' | 'LETTER' | 'MEMO';

export interface GetDocumentTemplatesParams {
  page?: number;
  limit?: number;
  search?: string;
  tipo?: DocumentTemplateType;
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

export const documentTemplatesApi = {
  getAll: async (params?: GetDocumentTemplatesParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.tipo) searchParams.set('tipo', params.tipo);

    const qs = searchParams.toString();
    return request<PaginatedResponse<DocumentTemplate>>(
      `/api/document-templates${qs ? `?${qs}` : ''}`,
    );
  },

  getById: async (id: string) => {
    return request<DocumentTemplate>(`/api/document-templates/${id}`);
  },

  create: async (data: {
    nombre: string;
    descripcion?: string;
    tipo: DocumentTemplateType;
    contenido: string;
  }) => {
    return request<DocumentTemplate>('/api/document-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async ({ id, data }: { id: string; data: Partial<DocumentTemplate> }) => {
    return request<DocumentTemplate>(`/api/document-templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string) => {
    return request<DocumentTemplate>(`/api/document-templates/${id}`, {
      method: 'DELETE',
    });
  },

  duplicate: async (id: string, nombre?: string) => {
    return request<DocumentTemplate>(`/api/document-templates/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify(nombre ? { nombre } : {}),
    });
  },

  toggleActive: async (id: string) => {
    return request<DocumentTemplate>(`/api/document-templates/${id}/toggle`, {
      method: 'PATCH',
      body: '{}',
    });
  },

  seedDefaults: async () => {
    return request<{ created: number; message: string }>('/api/document-templates/seed', {
      method: 'POST',
      body: '{}',
    });
  },
};
