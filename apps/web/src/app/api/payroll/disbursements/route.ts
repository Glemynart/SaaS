import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    const data = await backendFetch(
      `/payroll/disbursements${request.nextUrl.search}`,
      {},
      auth.token,
    );
    const response = NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    const data = await backendFetch(
      '/payroll/disbursements',
      { method: 'POST', body: JSON.stringify(await request.json()) },
      auth.token,
    );
    const response = NextResponse.json(data, { status: 201 });
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
