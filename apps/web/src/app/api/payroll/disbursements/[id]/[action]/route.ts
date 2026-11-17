import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

type RouteContext = { params: Promise<{ id: string; action: string }> };
const ALLOWED_ACTIONS = new Set(['verify', 'cancel', 'reversals']);

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    const { id, action } = await params;
    if (!ALLOWED_ACTIONS.has(action) || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      return NextResponse.json({ message: 'Ruta no disponible' }, { status: 404 });
    }
    const data = await backendFetch(
      `/payroll/disbursements/${encodeURIComponent(id)}/${action}`,
      { method: 'POST', body: JSON.stringify(await request.json()) },
      auth.token,
    );
    const response = NextResponse.json(data, { status: action === 'reversals' ? 201 : 200 });
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
