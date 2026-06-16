import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, jsonError } from '@/lib/server-api';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const { id } = await params;

    const backendResponse = await fetch(`${API_URL}/generated-documents/${id}/pdf`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    if (!backendResponse.ok) {
      const error = await backendResponse.json().catch(() => ({}));
      return NextResponse.json(
        { message: error.message ?? 'Error al obtener el PDF' },
        { status: backendResponse.status },
      );
    }

    const pdfBuffer = await backendResponse.arrayBuffer();
    const response = new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline`,
      },
    });

    auth.response.cookies.getAll().forEach((c) => response.cookies.set(c));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
