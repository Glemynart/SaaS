import type { NextRequest, NextResponse } from 'next/server';
import type { AuthUser } from '@/types/auth';

export const ACCESS_COOKIE = 'saas_access_token';
export const REFRESH_COOKIE = 'saas_refresh_token';
export const USER_COOKIE = 'saas_user';

const isProduction = process.env.NODE_ENV === 'production';
const accessMaxAge = 60 * 14;
const refreshMaxAge = 60 * 60 * 24 * 7;

export function setSessionCookies(
  response: NextResponse,
  session: { accessToken: string; refreshToken?: string; user?: AuthUser },
) {
  response.cookies.set(ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: accessMaxAge,
  });

  if (session.refreshToken) {
    response.cookies.set(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
      maxAge: refreshMaxAge,
    });
  }

  if (session.user) {
    response.cookies.set(USER_COOKIE, encodeUser(session.user), {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
      maxAge: refreshMaxAge,
    });
  }
}

export function clearSessionCookies(response: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, USER_COOKIE]) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
      maxAge: 0,
    });
  }
}

export function readUserCookie(request: NextRequest): AuthUser | null {
  const value = request.cookies.get(USER_COOKIE)?.value;
  if (!value) return null;

  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as AuthUser;
  } catch {
    return null;
  }
}

function encodeUser(user: AuthUser) {
  return Buffer.from(JSON.stringify(user), 'utf8').toString('base64url');
}
