import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, jsonError } from '@/lib/server-api';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const formData = await request.formData();

    const backendResponse = await fetch(`${API_URL}/tenant-branding/upload-firma`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
      body: formData,
    });

    if (!backendResponse.ok) {
      const error = await backendResponse.json().catch(() => ({}));
      return NextResponse.json(
        { message: error.message ?? 'Error al subir la firma' },
        { status: backendResponse.status },
      );
    }

    const data = await backendResponse.json();
    const finalResponse = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((c) => finalResponse.cookies.set(c));
    return finalResponse;
  } catch (error) {
    return jsonError(error);
  }
}
