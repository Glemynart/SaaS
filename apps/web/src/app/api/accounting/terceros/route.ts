import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

async function proxy(request: NextRequest, method: 'GET' | 'POST', path: string, body?: string) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const data = await backendFetch(path, { method, body }, auth.token);
    const response = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  return proxy(request, 'GET', `/accounting/terceros${query ? `?${query}` : ''}`);
}

export async function POST(request: NextRequest) {
  return proxy(request, 'POST', '/accounting/terceros', JSON.stringify(await request.json()));
}
