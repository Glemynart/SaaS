import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    const { eventId } = await params;
    const data = await backendFetch(
      `/payroll/pila-events/${eventId}`,
      { method: 'DELETE' },
      auth.token,
    );
    const response = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
