import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, jsonError } from '@/lib/server-api';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const backendResponse = await fetch(`${API_URL}/tenant-branding/firma`, {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: 'no-store',
    });

    if (!backendResponse.ok) {
      const error = await backendResponse.json().catch(() => ({}));
      return NextResponse.json(
        { message: error.message ?? 'Error al obtener la firma' },
        { status: backendResponse.status },
      );
    }

    const body = await backendResponse.arrayBuffer();
    const response = new NextResponse(body, {
      headers: {
        'Content-Type': backendResponse.headers.get('Content-Type') ?? 'application/octet-stream',
        'Cache-Control': 'private, no-store',
      },
    });

    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
