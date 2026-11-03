import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, jsonError } from '@/lib/server-api';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const formData = await request.formData();
    const backendResponse = await fetch(`${API_URL}/employees/import/pila-work-locations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
      body: formData,
    });
    const data = await backendResponse.json().catch(() => ({}));
    if (!backendResponse.ok) {
      return NextResponse.json(
        {
          message: data.message ?? 'Error al importar ubicaciones laborales PILA.',
          errors: data.errors,
        },
        { status: backendResponse.status },
      );
    }

    const response = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
