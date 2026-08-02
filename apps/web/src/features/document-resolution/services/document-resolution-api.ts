import { getApiErrorMessage } from '@/lib/error-message';

export type ResolutionStatus = 'RESUELTO' | 'BLOQUEADO';

export interface DocumentResolutionEmployee {
  id: string;
  primerNombre?: string;
  segundoNombre?: string | null;
  primerApellido?: string;
  segundoApellido?: string | null;
}

export interface DocumentResolutionItem {
  empleado: DocumentResolutionEmployee;
  vinculoUtilizado: { id: string } | null;
  perfilContractual: { id: string; codigo: string; nombre: string } | null;
  tipoDocumental: string;
  plantillaSeleccionada: { id: string; nombre: string } | null;
  estado: ResolutionStatus;
  motivoBloqueo: string | null;
}

export interface DocumentResolutionPayload {
  loteId: string;
  fechaProceso?: string;
}

export interface DocumentResolutionConfirmation {
  plans: Array<{ id: string }>;
  exclusions: Array<{ id: string }>;
}

async function request<T>(path: string, payload: DocumentResolutionPayload): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, 'No se pudo resolver la campaña.'));
  }

  return body as T;
}

export const documentResolutionApi = {
  preview: (payload: DocumentResolutionPayload) =>
    request<DocumentResolutionItem[]>('/api/document-resolution/preview', payload),
  confirm: (payload: DocumentResolutionPayload) =>
    request<DocumentResolutionConfirmation>('/api/document-resolution/confirm', payload),
};
