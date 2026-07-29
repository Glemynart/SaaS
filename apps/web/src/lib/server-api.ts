import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  readUserCookie,
  setSessionCookies,
} from '@/lib/auth-cookies';
import type { AuthUser, LoginResponse } from '@/types/auth';

const backendUrl =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type ApiErrorBody = {
  message?: string | string[];
  error?: string;
};

type BackendMe = {
  userId?: string;
  id?: string;
  tenantId: string;
  rol: string;
  email: string;
};

export class BackendError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function backendFetch<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = null;
    }

    const message = Array.isArray(body?.message)
      ? body.message.join(' ')
      : (body?.message ?? body?.error ?? 'No se pudo completar la solicitud.');

    throw new BackendError(message, response.status);
  }

  return (await response.json()) as T;
}

export function jsonError(error: unknown) {
  if (error instanceof BackendError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { message: 'Ocurrio un problema inesperado. Intenta nuevamente.' },
    { status: 500 },
  );
}

export function loginJsonError(error: unknown) {
  if (error instanceof BackendError && [400, 401, 403].includes(error.status)) {
    return NextResponse.json({ message: 'Credenciales inválidas.' }, { status: 401 });
  }

  return jsonError(error);
}

export async function refreshAccessToken(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const tokens = await backendFetch<{ accessToken: string; refreshToken: string }>(
    '/auth/refresh',
    {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    },
  );

  return tokens;
}

export async function getAuthenticatedUser(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const cookieUser = readUserCookie(request);

  if (accessToken) {
    try {
      const payload = await backendFetch<BackendMe>('/auth/me', {}, accessToken);
      const user = mergeUsers(normalizeMe(payload), cookieUser);
      return { user, response: NextResponse.json({ user }), token: accessToken };
    } catch (error) {
      if (!(error instanceof BackendError) || error.status !== 401) {
        throw error;
      }
    }
  }

  const tokens = await refreshAccessToken(request);
  if (!tokens) {
    return null;
  }

  const payload = await backendFetch<BackendMe>('/auth/me', {}, tokens.accessToken);
  const user = mergeUsers(normalizeMe(payload), cookieUser);
  const response = NextResponse.json({ user });
  setSessionCookies(response, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user,
  });

  return { user, response, token: tokens.accessToken };
}

export function loginResponse(body: LoginResponse) {
  const response = NextResponse.json({ user: body.user });
  setSessionCookies(response, body);
  return response;
}

function mergeUsers(payload: AuthUser, cookieUser: AuthUser | null): AuthUser {
  return {
    ...cookieUser,
    ...payload,
    nombre: cookieUser?.nombre ?? payload.nombre,
    apellido: cookieUser?.apellido ?? payload.apellido,
    tenantNombre: cookieUser?.tenantNombre ?? payload.tenantNombre,
  };
}

function normalizeMe(payload: BackendMe): AuthUser {
  return {
    id: payload.id ?? payload.userId ?? '',
    tenantId: payload.tenantId,
    email: payload.email,
    rol: payload.rol === 'ADMIN' ? 'ADMIN' : 'OPERADOR',
  };
}
