import type { ContractualProfile } from '@/features/contractual-profiles/services/contractual-profiles-api';
import type {
  DocumentTemplate,
  DocumentTemplateType,
} from '@/features/document-templates/services/document-templates-api';

export interface DocumentProfileConfiguration {
  id: string;
  tenantId: string;
  perfilContractualId: string;
  tipoDocumental: DocumentTemplateType;
  plantillaId: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  perfilContractual: ContractualProfile;
  plantilla: DocumentTemplate;
}

export interface CreateDocumentProfileConfigurationInput {
  perfilContractualId: string;
  tipoDocumental: DocumentTemplateType;
  plantillaId: string;
  vigenteDesde: string;
  vigenteHasta?: string;
  activo?: boolean;
}

export interface UpdateDocumentProfileConfigurationInput {
  plantillaId?: string;
  vigenteDesde?: string;
  vigenteHasta?: string | null;
  activo?: boolean;
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

export const documentProfileConfigurationsApi = {
  getAll: () => request<DocumentProfileConfiguration[]>('/api/document-profile-configurations'),

  create: (data: CreateDocumentProfileConfigurationInput) =>
    request<DocumentProfileConfiguration>('/api/document-profile-configurations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: ({ id, data }: { id: string; data: UpdateDocumentProfileConfigurationInput }) =>
    request<DocumentProfileConfiguration>(`/api/document-profile-configurations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
