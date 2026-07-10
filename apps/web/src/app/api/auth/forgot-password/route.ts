import { backendFetch, jsonError } from '@/lib/server-api';
import type { ForgotPasswordPayload, MessageResponse } from '@/types/auth';

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ForgotPasswordPayload;
    const body = await backendFetch<MessageResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return Response.json(body, { status: 200 });
  } catch (error) {
    return jsonError(error);
  }
}
