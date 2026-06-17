import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, jsonError } from '@/lib/server-api';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const backendResponse = await fetch(`${API_URL}/employees/import/template`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    if (!backendResponse.ok) {
      return NextResponse.json({ message: 'Error al generar la plantilla.' }, { status: 500 });
    }

    const buffer = await backendResponse.arrayBuffer();

    const response = new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="plantilla_empleados.xlsx"',
      },
    });

    auth.response.cookies.getAll().forEach((c) => response.cookies.set(c));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
