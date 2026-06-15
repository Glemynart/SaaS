import { NextResponse, type NextRequest } from 'next/server';
import { clearSessionCookies, REFRESH_COOKIE } from '@/lib/auth-cookies';
import { backendFetch } from '@/lib/server-api';

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    await backendFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }).catch(() => null);
  }

  const response = NextResponse.json({ message: 'Sesion cerrada.' });
  clearSessionCookies(response);
  return response;
}
