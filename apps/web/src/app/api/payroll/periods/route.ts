import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    const data = await backendFetch('/payroll/periods', { method: 'GET' }, auth.token);
    const res = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    const body = await request.json();
    const data = await backendFetch(
      '/payroll/periods',
      { method: 'POST', body: JSON.stringify(body) },
      auth.token,
    );
    const res = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  } catch (error) {
    return jsonError(error);
  }
}
