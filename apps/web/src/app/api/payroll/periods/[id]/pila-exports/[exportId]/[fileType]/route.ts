import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, jsonError } from '@/lib/server-api';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type RouteContext = {
  params: Promise<{ id: string; exportId: string; fileType: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    const { id, exportId, fileType } = await params;
    const path = [exportId, fileType].map(encodeURIComponent).join('/');
    const backendResponse = await fetch(
      `${API_URL}/payroll/periods/${encodeURIComponent(id)}/pila-exports/${path}`,
      {
        headers: { Authorization: `Bearer ${auth.token}` },
        cache: 'no-store',
      },
    );

    if (!backendResponse.ok) {
      const error = await backendResponse.json().catch(() => ({}));
      const response = NextResponse.json(
        { message: error.message ?? 'No se pudo descargar el archivo PILA.' },
        { status: backendResponse.status },
      );
      auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
      return response;
    }

    const response = new NextResponse(await backendResponse.arrayBuffer(), {
      headers: {
        'Content-Type': backendResponse.headers.get('Content-Type') ?? 'application/octet-stream',
        'Content-Disposition': backendResponse.headers.get('Content-Disposition') ?? 'attachment',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
