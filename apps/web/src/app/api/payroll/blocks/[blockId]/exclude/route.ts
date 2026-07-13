import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> },
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    const { blockId } = await params;
    const body = await request.json().catch(() => ({}));
    const data = await backendFetch(
      `/payroll/blocks/${blockId}/exclude`,
      { method: 'PATCH', body: JSON.stringify(body) },
      auth.token,
    );
    const res = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  } catch (error) {
    return jsonError(error);
  }
}
