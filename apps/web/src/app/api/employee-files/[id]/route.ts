import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const data = await backendFetch(`/employee-files/${id}`, { method: 'DELETE' }, auth.token);

    const finalResponse = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((c) => finalResponse.cookies.set(c));
    return finalResponse;
  } catch (error) {
    return jsonError(error);
  }
}
