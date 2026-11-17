import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, jsonError } from '@/lib/server-api';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    const { id } = await params;
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      return NextResponse.json({ message: 'Ruta no disponible' }, { status: 404 });
    }
    const backendResponse = await fetch(
      `${API_URL}/payroll/disbursements/${encodeURIComponent(id)}/support`,
      { headers: { Authorization: `Bearer ${auth.token}` }, cache: 'no-store' },
    );
    if (!backendResponse.ok) {
      const error = await backendResponse.json().catch(() => ({}));
      const response = NextResponse.json(
        { message: error.message ?? 'No se pudo descargar el soporte.' },
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

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    const { id } = await params;
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      return NextResponse.json({ message: 'Ruta no disponible' }, { status: 404 });
    }
    const contentType = request.headers.get('content-type');
    if (
      !request.body ||
      !contentType ||
      !/^multipart\/form-data\s*;\s*boundary=.+$/i.test(contentType)
    ) {
      return NextResponse.json({ message: 'Adjunte un archivo de soporte.' }, { status: 400 });
    }
    const backendResponse = await fetch(
      `${API_URL}/payroll/disbursements/${encodeURIComponent(id)}/support`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': contentType,
        },
        body: request.body,
        duplex: 'half',
        cache: 'no-store',
      } as RequestInit & { duplex: 'half' },
    );
    const body = await backendResponse.json().catch(() => ({}));
    const response = NextResponse.json(body, { status: backendResponse.status });
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
