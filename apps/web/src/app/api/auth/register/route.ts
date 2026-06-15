import { backendFetch, jsonError } from '@/lib/server-api';
import type { RegisterPayload, RegisterResponse } from '@/types/auth';

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as RegisterPayload;
    const body = await backendFetch<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return Response.json(body, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
