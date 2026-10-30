import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

const ACTION_PATHS: Record<string, string> = {
  'enviar-revision': 'enviar-revision',
  aprobar: 'aprobar',
  rechazar: 'rechazar',
  cancelar: 'cancelar',
  contabilizar: 'contabilizar',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    const { id, action } = await params;
    const path = ACTION_PATHS[action];
    if (!path) return NextResponse.json({ message: 'Acción no encontrada' }, { status: 404 });
    const payload = await request.json().catch(() => ({}));
    const data = await backendFetch(
      `/payroll/corrections/${id}/${path}`,
      { method: 'POST', body: JSON.stringify(payload) },
      auth.token,
    );
    const response = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
