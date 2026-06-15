import { NextResponse, type NextRequest } from 'next/server';
import { REFRESH_COOKIE, readUserCookie, setSessionCookies } from '@/lib/auth-cookies';
import { backendFetch, jsonError } from '@/lib/server-api';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
    if (!refreshToken) {
      return NextResponse.json({ message: 'La sesion expiro.' }, { status: 401 });
    }

    const tokens = await backendFetch<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      },
    );

    const response = NextResponse.json({ ok: true });
    setSessionCookies(response, {
      ...tokens,
      user: readUserCookie(request) ?? undefined,
    });

    return response;
  } catch (error) {
    return jsonError(error);
  }
}
