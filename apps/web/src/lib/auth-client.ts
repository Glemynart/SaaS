import type {
  AuthUser,
  ForgotPasswordPayload,
  LoginPayload,
  MessageResponse,
  RegisterPayload,
  RegisterResponse,
  ResetPasswordPayload,
  ValidateResetTokenPayload,
  ValidateResetTokenResponse,
} from '@/types/auth';

type ApiEnvelope<T> = T & {
  message?: string;
};

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

export const authClient = {
  login: (payload: LoginPayload) =>
    request<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  register: (payload: RegisterPayload) =>
    request<RegisterResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () =>
    request<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    }),
  me: () => request<{ user: AuthUser }>('/api/auth/me'),
  forgotPassword: (payload: ForgotPasswordPayload) =>
    request<MessageResponse>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resetPassword: (payload: ResetPasswordPayload) =>
    request<MessageResponse>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  validateResetToken: (payload: ValidateResetTokenPayload) =>
    request<ValidateResetTokenResponse>('/api/auth/validate-reset-token', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
