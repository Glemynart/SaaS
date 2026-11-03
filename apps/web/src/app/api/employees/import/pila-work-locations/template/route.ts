import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, jsonError } from '@/lib/server-api';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const backendResponse = await fetch(
      `${API_URL}/employees/import/pila-work-locations/template`,
      { headers: { Authorization: `Bearer ${auth.token}` } },
    );
    if (!backendResponse.ok) {
      const data = await backendResponse.json().catch(() => ({}));
      return NextResponse.json(
        { message: data.message ?? 'Error al generar la plantilla de ubicaciones PILA.' },
        { status: backendResponse.status },
      );
    }

    const response = new NextResponse(await backendResponse.arrayBuffer(), {
      headers: {
        'Content-Type': XLSX_MIME,
        'Content-Disposition': 'attachment; filename="plantilla_ubicaciones_laborales_pila.xlsx"',
      },
    });
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
