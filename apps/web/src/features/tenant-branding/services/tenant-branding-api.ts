export interface TenantBranding {
  razonSocial: string;
  nit: string;
  nombre: string;
  logoUrl: string | null;
  representanteLegal: string | null;
  firmaRepresentanteUrl: string | null;
}

export interface PilaEmployerProfile {
  razonSocial: string;
  nit: string;
  aportesExonerados: boolean;
  pilaTipoDocumentoAportante: string | null;
  pilaNaturalezaJuridica: string | null;
  pilaTipoPersona: string | null;
  pilaFormaPresentacion: string | null;
  pilaCodigoSucursal: string | null;
  pilaNombreSucursal: string | null;
  pilaCodigoActividadEconomica: string | null;
  pilaCodigoArlAportante: string | null;
  pilaTipoAportante: string | null;
  pilaFax: string | null;
  pilaRepresentanteTipoDocumento: string | null;
  pilaRepresentanteNumeroDocumento: string | null;
  pilaRepresentantePrimerApellido: string | null;
  pilaRepresentanteSegundoApellido: string | null;
  pilaRepresentantePrimerNombre: string | null;
  pilaRepresentanteSegundoNombre: string | null;
  pilaFechaMatriculaMercantil: string | null;
  pilaBeneficioLey1429: boolean | null;
  pilaBeneficioCcfLey1429: boolean | null;
  pilaAportesExoneradosConfirmado: boolean | null;
  pilaSinAccionEspecial: boolean | null;
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

  update: async (data: Partial<TenantBranding>) => {
    return request<TenantBranding>('/api/tenant-branding', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  getPilaProfile: async () => {
    return request<PilaEmployerProfile>('/api/tenant-branding/pila');
  },

  updatePilaProfile: async (data: Partial<PilaEmployerProfile>) => {
    return request<PilaEmployerProfile>('/api/tenant-branding/pila', {
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
