import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const data = await backendFetch('/pila-centros-trabajo', { method: 'GET' }, auth.token);
    const response = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const body = await request.json();
    const data = await backendFetch(
      '/pila-centros-trabajo',
      { method: 'POST', body: JSON.stringify(body) },
      auth.token,
    );
    const response = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
