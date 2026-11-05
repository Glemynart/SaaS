import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    const body = await request.json();
    const data = await backendFetch(
      '/electronic-invoicing/profiles',
      { method: 'PUT', body: JSON.stringify(body) },
      auth.token,
    );
    const response = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
