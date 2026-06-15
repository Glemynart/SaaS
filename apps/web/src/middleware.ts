import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth-cookies';

const publicRoutes = ['/login', '/registro'];
const privateRoutes = ['/dashboard', '/perfil'];
const allowedRoles = new Set(['ADMIN', 'OPERADOR']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const hasSession = Boolean(accessToken || refreshToken);

  if (pathname === '/') {
    return NextResponse.redirect(new URL(hasSession ? '/dashboard' : '/login', request.url));
  }

  if (publicRoutes.some((route) => pathname.startsWith(route)) && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (privateRoutes.some((route) => pathname.startsWith(route)) && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (privateRoutes.some((route) => pathname.startsWith(route)) && accessToken) {
    const role = readRole(accessToken);
    if (role && !allowedRoles.has(role)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/registro', '/dashboard/:path*', '/perfil/:path*'],
};

function readRole(token: string) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const decoded = JSON.parse(atob(padded)) as { rol?: string };
    return decoded.rol ?? null;
  } catch {
    return null;
  }
}
