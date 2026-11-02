import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

type RouteContext = {
  params: Promise<{ id: string; locationId: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const { id, locationId } = await params;
    const body = await request.json();
    const data = await backendFetch(
      `/employees/${id}/ubicaciones-laborales-pila/${locationId}`,
      { method: 'PATCH', body: JSON.stringify(body) },
      auth.token,
    );
    const response = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
