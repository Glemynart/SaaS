import { backendFetch, jsonError } from '@/lib/server-api';
import type { AcceptInvitationResponse } from '@/types/auth';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const body = await backendFetch<AcceptInvitationResponse>('/auth/accept-invitation', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return Response.json(body, { status: 200 });
  } catch (error) {
    return jsonError(error);
  }
}
