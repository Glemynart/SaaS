import { NextRequest, NextResponse } from 'next/server';
import { backendFetch, getAuthenticatedUser, jsonError } from '@/lib/server-api';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  try {
    const { id } = await params;
    const body = await request.json();
    const data = await backendFetch(
      `/billing/receipts/${encodeURIComponent(id)}/reversal`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      auth.token,
    );
    const response = NextResponse.json(data);
    auth.response.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
