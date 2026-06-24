import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

type RouteParams = { params: Promise<{ id: string; action?: string[] }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const { id, action } = await params;
    const suffix = action?.length ? `/${action.join('/')}` : '';
    const data = await backendFetch(
      `/contracts/lotes/${id}${suffix}`,
      { method: 'GET' },
      auth.token,
    );

    const res = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const { id, action } = await params;
    const suffix = action?.length ? `/${action.join('/')}` : '';
    const body = await request.text();
    const data = await backendFetch(
      `/contracts/lotes/${id}${suffix}`,
      { method: 'POST', ...(body ? { body } : {}) },
      auth.token,
    );

    const res = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  } catch (error) {
    return jsonError(error);
  }
}
