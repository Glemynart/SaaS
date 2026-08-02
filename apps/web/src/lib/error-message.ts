const GENERIC_ERROR_MESSAGES = new Set([
  'No se pudo completar la solicitud.',
  'Internal server error',
  'Internal Server Error',
]);

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const message = value.trim();
  return message ? message : null;
}

function messageFromUnknown(value: unknown): string | null {
  const direct = nonEmptyString(value);
  if (direct) return direct;

  if (Array.isArray(value)) {
    const messages = value
      .map((item) => messageFromUnknown(item))
      .filter((message): message is string => Boolean(message));
    return messages.length > 0 ? messages.join(' ') : null;
  }

  return null;
}

export function getApiErrorMessage(body: unknown, fallback: string): string {
  const message =
    body && typeof body === 'object' && 'message' in body
      ? messageFromUnknown((body as { message?: unknown }).message)
      : null;

  return message && !GENERIC_ERROR_MESSAGES.has(message) ? message : fallback;
}

export function getUserFacingError(error: unknown, fallback: string): string {
  const message = messageFromUnknown(error instanceof Error ? error.message : error);
  return message && !GENERIC_ERROR_MESSAGES.has(message) ? message : fallback;
}
