import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

const allowed = new Set([
  'libro-diario',
  'libro-mayor',
  'balance-prueba',
  'balance-general',
  'estado-resultados',
  'auxiliares/tercero',
  'auxiliares/centro-costo',
]);
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ report: string[] }> },
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
    const { report } = await params;
    const path = report.join('/');
    if (!allowed.has(path))
      return NextResponse.json({ message: 'Reporte no encontrado' }, { status: 404 });
    const query = request.nextUrl.searchParams.toString();
    const data = await backendFetch(
      `/accounting/reportes/${path}${query ? `?${query}` : ''}`,
      { method: 'GET' },
      auth.token,
    );
    const response = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
