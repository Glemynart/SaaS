import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

async function proxy(request: NextRequest, method: string, path: string, body?: string) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  try {
    const data = await backendFetch(path, { method, body }, auth.token);
    const res = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  } catch (e) {
    return jsonError(e);
  }
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  return proxy(request, 'PATCH', `/billing/invoices/${id}/status`, JSON.stringify(body));
}
