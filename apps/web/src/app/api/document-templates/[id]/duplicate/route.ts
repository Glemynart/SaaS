import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    const data = await backendFetch(
      `/document-templates/${id}/duplicate`,
      { method: 'POST', body: JSON.stringify(body) },
      auth.token,
    );

    const finalResponse = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((c) => finalResponse.cookies.set(c));
    return finalResponse;
  } catch (error) {
    return jsonError(error);
  }
}
