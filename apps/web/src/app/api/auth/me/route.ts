import { NextResponse, type NextRequest } from 'next/server';
import { clearSessionCookies } from '@/lib/auth-cookies';
import { getAuthenticatedUser, jsonError } from '@/lib/server-api';

export async function GET(request: NextRequest) {
  try {
    const result = await getAuthenticatedUser(request);

    if (!result) {
      const response = NextResponse.json({ message: 'No autenticado.' }, { status: 401 });
      clearSessionCookies(response);
      return response;
    }

    return result.response;
  } catch (error) {
    return jsonError(error);
  }
}
