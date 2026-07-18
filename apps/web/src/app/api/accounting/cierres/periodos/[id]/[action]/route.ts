import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

async function proxy(
  request: NextRequest,
  method: 'GET' | 'POST',
  params: Promise<{ id: string; action: string }>,
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const { id, action } = await params;
    if (!['validar', 'cerrar', 'reabrir'].includes(action)) {
      return NextResponse.json({ message: 'Operación no encontrada' }, { status: 404 });
    }
    const body =
      method === 'POST' ? JSON.stringify(await request.json().catch(() => ({}))) : undefined;
    const data = await backendFetch(
      `/accounting/cierres/periodos/${id}/${action}`,
      { method, body },
      auth.token,
    );
    const response = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  return proxy(request, 'GET', params);
}

export function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  return proxy(request, 'POST', params);
}
