import { createHash, createHmac } from 'node:crypto';
import { InvalidStorageKeyError } from './storage.types';

const TEMPORARY_CREDENTIAL_TTL_SECONDS = 15 * 60;
const PILA_EXPORT_PREFIX =
  /^tenants\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/pila-exports\/$/i;

export interface R2PilaPrefixCredentialInput {
  endpoint: string;
  bucket: string;
  parentAccessKeyId: string;
  parentSecretAccessKey: string;
  prefix: string;
  nowSeconds?: number;
}

export interface R2TemporaryCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

/**
 * Locally signs short-lived Cloudflare R2 credentials for listing one tenant's
 * PILA exports. The parent key is used only to sign the token; the returned
 * S3 credentials can call ListObjectsV2 only and only within this prefix.
 */
export function createR2PilaPrefixCredentials(
  input: R2PilaPrefixCredentialInput,
): R2TemporaryCredentials {
  if (!PILA_EXPORT_PREFIX.test(input.prefix)) {
    throw new InvalidStorageKeyError(
      input.prefix,
      'el prefijo debe pertenecer a las exportaciones PILA de un tenant',
    );
  }
  if (
    !input.bucket.trim() ||
    !input.parentAccessKeyId.trim() ||
    !input.parentSecretAccessKey.trim()
  ) {
    throw new Error('Configuración incompleta para credenciales temporales R2');
  }

  const endpoint = new URL(input.endpoint);
  const accountMatch = endpoint.hostname.match(
    /^([a-f0-9]{32})\.r2\.cloudflarestorage\.com$/i,
  );
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.port !== '' ||
    endpoint.pathname !== '/' ||
    endpoint.username !== '' ||
    endpoint.password !== '' ||
    endpoint.search !== '' ||
    endpoint.hash !== '' ||
    !accountMatch
  ) {
    throw new Error('R2_ENDPOINT no identifica una cuenta R2 válida');
  }

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeBase64Url({
    bucket: input.bucket,
    actions: ['ListObjectsV2'],
    paths: { prefixPaths: [input.prefix], objectPaths: [] },
    iss: input.parentAccessKeyId,
    sub: accountMatch[1].toLowerCase(),
    aud: endpoint.host,
    iat: now,
    exp: now + TEMPORARY_CREDENTIAL_TTL_SECONDS,
  });
  const signingInput = `${header}.${payload}`;
  const signature = createHmac('sha256', input.parentSecretAccessKey)
    .update(signingInput)
    .digest('base64url');
  const jwt = `${signingInput}.${signature}`;
  const temporarySecretAccessKey = createHash('sha256')
    .update(jwt, 'utf8')
    .digest('hex');

  return {
    accessKeyId: input.parentAccessKeyId,
    secretAccessKey: temporarySecretAccessKey,
    sessionToken: Buffer.from(`jwt/${jwt}`, 'utf8').toString('base64'),
  };
}

function encodeBase64Url(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}
