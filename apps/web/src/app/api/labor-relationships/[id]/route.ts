import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return forward(request, context, 'GET');
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return forward(request, context, 'PATCH');
}

async function forward(request: NextRequest, context: RouteContext, method: 'GET' | 'PATCH') {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const { id } = await context.params;
    const data = await backendFetch(
      `/labor-relationships/${id}`,
      {
        method,
        ...(method === 'PATCH' && { body: await request.text() }),
      },
      auth.token,
    );

    const response = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
