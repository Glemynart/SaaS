import { backendFetch, jsonError } from '@/lib/server-api';
import type { ValidateResetTokenPayload, ValidateResetTokenResponse } from '@/types/auth';

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ValidateResetTokenPayload;
    const body = await backendFetch<ValidateResetTokenResponse>('/auth/validate-reset-token', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return Response.json(body, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const response = jsonError(error);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
