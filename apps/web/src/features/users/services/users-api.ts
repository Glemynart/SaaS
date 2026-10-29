import { getApiErrorMessage } from '@/lib/error-message';

export type ManagedUserRole = 'ADMIN' | 'OPERADOR';

export interface ManagedUser {
  id: string;
  createdAt: string;
  updatedAt: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: ManagedUserRole;
  activo: boolean;
  lastLoginAt: string | null;
}

export interface CreateManagedUserPayload {
  email: string;
  nombre: string;
  apellido: string;
  passwordPlain: string;
  rol: ManagedUserRole;
}

export interface UpdateManagedUserPayload {
  email?: string;
  nombre?: string;
  apellido?: string;
  rol?: ManagedUserRole;
  activo?: boolean;
}

export interface UserInvitationSummary {
  id: string;
  createdAt: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: ManagedUserRole;
  expiresAt: string;
  lastSentAt: string;
}

export type CreateUserInvitationPayload = Omit<CreateManagedUserPayload, 'passwordPlain'>;

type ApiEnvelope<T> = T & { message?: unknown };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok) {
    throw new Error(getApiErrorMessage(body, 'No se pudo completar la solicitud.'));
  }
  return body as T;
}

export const usersApi = {
  getAll: async () => request<ManagedUser[]>('/api/users'),
  getInvitations: async () => request<UserInvitationSummary[]>('/api/users/invitations'),

  create: async (data: CreateManagedUserPayload) =>
    request<ManagedUser>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createInvitation: async (data: CreateUserInvitationPayload) =>
    request<UserInvitationSummary>('/api/users/invitations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  resendInvitation: async (id: string) =>
    request<UserInvitationSummary>(`/api/users/invitations/${id}/resend`, {
      method: 'POST',
    }),

  revokeInvitation: async (id: string) =>
    request<{ message: string }>(`/api/users/invitations/${id}/revoke`, {
      method: 'POST',
    }),

  update: async ({ id, data }: { id: string; data: UpdateManagedUserPayload }) =>
    request<ManagedUser>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
