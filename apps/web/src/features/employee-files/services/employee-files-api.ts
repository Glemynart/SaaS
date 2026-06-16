export interface EmployeeFile {
  id: string;
  tenantId: string;
  employeeId: string;
  generatedDocumentId: string | null;
  nombre: string;
  categoria: string;
  archivoUrl: string;
  mimeType: string | null;
  tamanoBytes: number | null;
  observaciones: string | null;
  createdAt: string;
  employee?: {
    id: string;
    primerNombre: string;
    segundoNombre: string | null;
    primerApellido: string;
    segundoApellido: string | null;
  };
  generatedDocument?: { id: string; nombre: string; tipo: string } | null;
}

export interface EmployeeFilesStats {
  total: number;
  byCategory: Record<string, number>;
  ultimoDocumento: string | null;
}

export interface EmployeeFilesResponse {
  files: EmployeeFile[];
  stats: EmployeeFilesStats;
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

export const employeeFilesApi = {
  getByEmployee: async (employeeId: string) => {
    return request<EmployeeFilesResponse>(`/api/employees/${employeeId}/files`);
  },

  delete: async (id: string) => {
    return request<EmployeeFile>(`/api/employee-files/${id}`, { method: 'DELETE' });
  },
};
