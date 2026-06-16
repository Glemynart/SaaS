import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();

    const data = await backendFetch(
      `/sedes${queryString ? `?${queryString}` : ''}`,
      { method: 'GET' },
      auth.token,
    );

    const finalResponse = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((c) => finalResponse.cookies.set(c));
    return finalResponse;
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
      '/sedes',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      auth.token,
    );

    const finalResponse = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((c) => finalResponse.cookies.set(c));
    return finalResponse;
  } catch (error) {
    return jsonError(error);
  }
}
