import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const { id } = await context.params;
    const data = await backendFetch(
      `/contractual-profiles/${id}/status`,
      { method: 'PATCH', body: await request.text() },
      auth.token,
    );

    const response = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
