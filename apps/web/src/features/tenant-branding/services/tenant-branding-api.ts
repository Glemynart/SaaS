export interface TenantBranding {
  razonSocial: string;
  nit: string;
  nombre: string;
  logoUrl: string | null;
  representanteLegal: string | null;
  firmaRepresentanteUrl: string | null;
}

interface ApiEnvelope {
  message?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });

  const body = (await response.json().catch(() => ({}))) as ApiEnvelope;

  if (!response.ok) {
    throw new Error(body.message ?? 'No se pudo completar la solicitud.');
  }

  return body as T;
}

export const tenantBrandingApi = {
  get: async () => {
    return request<TenantBranding>('/api/tenant-branding');
  },

  update: async (data: { representanteLegal?: string }) => {
    return request<TenantBranding>('/api/tenant-branding', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  uploadLogo: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<TenantBranding>('/api/tenant-branding/upload-logo', {
      method: 'POST',
      body: formData,
    });
  },

  uploadFirma: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<TenantBranding>('/api/tenant-branding/upload-firma', {
      method: 'POST',
      body: formData,
    });
  },
};
