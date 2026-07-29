import { NextResponse, type NextRequest } from 'next/server';
import { backendFetch, loginJsonError, loginResponse } from '@/lib/server-api';
import type { LoginPayload, LoginResponse } from '@/types/auth';

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as LoginPayload;
    const body = await backendFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return loginResponse(body);
  } catch (error) {
    return loginJsonError(error);
  }
}

export function GET() {
  return NextResponse.json({ message: 'Metodo no permitido.' }, { status: 405 });
}
