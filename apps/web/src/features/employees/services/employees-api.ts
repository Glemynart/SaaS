import { getApiErrorMessage } from '@/lib/error-message';

export interface Employee {
  id: string;
  tenantId: string;
  cedula: string;
  tipoDocumento: 'CC' | 'CE' | 'TI' | 'PA' | 'NIT' | 'PEP' | 'PPT';
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
  email: string | null;
  telefono: string | null;
  fechaNacimiento: string | null;
  cargo: string;
  dependencia: string | null;
  sede: string | null;
  sedeId: string | null;
  sedeRef: { id: string; nombre: string; activo?: boolean } | null;
  salario: number;
  tipoContrato: string;
  fechaIngreso: string;
  estado: string;
  eps: string | null;
  arl: string | null;
  fondoPension: string | null;
  cajaCompensacion: string | null;
  municipioExpedicionDocId: string | null;
  salarioIntegral: boolean;
  jornadaLaboral: string | null;
  fechaRetiro: string | null;
  motivoRetiro: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SocialSecurityAffiliation {
  id: string;
  tenantId: string;
  empleadoId: string;
  tipoCotizanteCodigo: string;
  subtipoCotizanteCodigo: string | null;
  epsCodigo: string;
  epsNombre: string;
  fondoPensionCodigo: string;
  fondoPensionNombre: string;
  arlCodigo: string;
  arlNombre: string;
  arlClaseRiesgo: string;
  cajaCompensacionCodigo: string;
  cajaCompensacionNombre: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
  formatoNormativoVersion: string;
  registradoPorId: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateSocialSecurityAffiliation = Omit<
  SocialSecurityAffiliation,
  | 'id'
  | 'tenantId'
  | 'empleadoId'
  | 'formatoNormativoVersion'
  | 'registradoPorId'
  | 'createdAt'
  | 'updatedAt'
>;

export interface GetEmployeesParams {
  page?: number;
  limit?: number;
  search?: string;
  estado?: string;
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

type ApiEnvelope<T> = T & { message?: unknown };

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
    throw new Error(getApiErrorMessage(body, 'No se pudo completar la solicitud.'));
  }

  return body as T;
}

export const employeesApi = {
  getAll: async (params?: GetEmployeesParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.estado) searchParams.set('estado', params.estado);

    const qs = searchParams.toString();
    return request<PaginatedResponse<Employee>>(`/api/employees${qs ? `?${qs}` : ''}`);
  },

  getById: async (id: string) => {
    return request<Employee>(`/api/employees/${id}`);
  },

  getSocialSecurityAffiliations: async (id: string) => {
    return request<SocialSecurityAffiliation[]>(
      `/api/employees/${id}/afiliaciones-seguridad-social`,
    );
  },

  createSocialSecurityAffiliation: async ({
    employeeId,
    data,
  }: {
    employeeId: string;
    data: CreateSocialSecurityAffiliation;
  }) => {
    return request<SocialSecurityAffiliation>(
      `/api/employees/${employeeId}/afiliaciones-seguridad-social`,
      { method: 'POST', body: JSON.stringify(data) },
    );
  },

  closeSocialSecurityAffiliation: async ({
    employeeId,
    affiliationId,
    vigenteHasta,
  }: {
    employeeId: string;
    affiliationId: string;
    vigenteHasta: string;
  }) => {
    return request<SocialSecurityAffiliation>(
      `/api/employees/${employeeId}/afiliaciones-seguridad-social/${affiliationId}`,
      { method: 'PATCH', body: JSON.stringify({ vigenteHasta }) },
    );
  },

  create: async (data: Partial<Employee>) => {
    return request<Employee>('/api/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async ({ id, data }: { id: string; data: Partial<Employee> }) => {
    return request<Employee>(`/api/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string) => {
    return request<Employee>(`/api/employees/${id}`, {
      method: 'DELETE',
    });
  },

  importFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/employees/import', {
      method: 'POST',
      body: formData,
    });
    const body = (await response.json().catch(() => ({}))) as ApiEnvelope<{
      imported: number;
      message: string;
      errors?: { fila: number; campo: string; mensaje: string }[];
    }>;
    if (!response.ok) {
      throw new ImportError(
        getApiErrorMessage(
          body,
          'No pudimos importar los empleados. Corrige los errores y vuelve a intentarlo.',
        ),
        body.errors ?? [],
      );
    }
    return body as { imported: number; message: string };
  },

  downloadTemplate: async () => {
    const response = await fetch('/api/employees/import/template');
    if (!response.ok) throw new Error('Error al descargar la plantilla.');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_empleados.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};

export class ImportError extends Error {
  constructor(
    message: string,
    public readonly errors: { fila: number; campo: string; mensaje: string }[],
  ) {
    super(message);
    this.name = 'ImportError';
  }
}
