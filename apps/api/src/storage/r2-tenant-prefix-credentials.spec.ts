import { createHash, createHmac } from 'node:crypto';
import {
  CloudflareR2StorageConfigurationError,
  InvalidStorageKeyError,
} from './storage.types';
import { createR2TenantPrefixCredentials } from './r2-tenant-prefix-credentials';

describe('createR2TenantPrefixCredentials', () => {
  const input = {
    endpoint:
      'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com',
    bucket: 'private-test-bucket',
    parentAccessKeyId: 'test-parent-key-id',
    parentSecretAccessKey: 'test-parent-secret-only',
    prefix: 'tenants/11111111-2222-4333-8444-555555555555/pila-exports/',
    action: 'ListObjectsV2' as const,
    nowSeconds: 1_800_000_000,
  };

  it('firma credenciales temporales de solo listado y un único prefijo tenant', () => {
    const credentials = createR2TenantPrefixCredentials(input);
    const jwt = Buffer.from(credentials.sessionToken, 'base64')
      .toString('utf8')
      .replace(/^jwt\//, '');
    const [headerSegment, payloadSegment, signature] = jwt.split('.');
    const signingInput = `${headerSegment}.${payloadSegment}`;
    const payload = JSON.parse(
      Buffer.from(payloadSegment, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;

    expect(
      JSON.parse(Buffer.from(headerSegment, 'base64url').toString('utf8')),
    ).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(payload).toEqual({
      bucket: input.bucket,
      actions: ['ListObjectsV2'],
      paths: {
        prefixPaths: [input.prefix],
        objectPaths: [],
      },
      iss: input.parentAccessKeyId,
      sub: '0123456789abcdef0123456789abcdef',
      aud: new URL(input.endpoint).host,
      iat: input.nowSeconds,
      exp: input.nowSeconds + 900,
    });
    expect(signature).toBe(
      createHmac('sha256', input.parentSecretAccessKey)
        .update(signingInput)
        .digest('base64url'),
    );
    expect(credentials).toEqual({
      accessKeyId: input.parentAccessKeyId,
      secretAccessKey: createHash('sha256').update(jwt).digest('hex'),
      sessionToken: Buffer.from(`jwt/${jwt}`).toString('base64'),
    });
  });

  it('permite listar soportes de desembolsos de un solo tenant', () => {
    const prefix =
      'tenants/11111111-2222-4333-8444-555555555555/employee-disbursements/';
    const credentials = createR2TenantPrefixCredentials({ ...input, prefix });
    const jwt = Buffer.from(credentials.sessionToken, 'base64')
      .toString('utf8')
      .replace(/^jwt\//, '');
    const [, payloadSegment] = jwt.split('.');
    const payload = JSON.parse(
      Buffer.from(payloadSegment, 'base64url').toString('utf8'),
    ) as { actions: string[]; paths: { prefixPaths: string[] } };

    expect(payload.actions).toEqual(['ListObjectsV2']);
    expect(payload.paths.prefixPaths).toEqual([prefix]);
  });

  it('firma credenciales de lectura de objeto limitadas al prefijo del tenant', () => {
    const credentials = createR2TenantPrefixCredentials({
      ...input,
      action: 'GetObject',
    });
    const jwt = Buffer.from(credentials.sessionToken, 'base64')
      .toString('utf8')
      .replace(/^jwt\//, '');
    const [, payloadSegment] = jwt.split('.');
    const payload = JSON.parse(
      Buffer.from(payloadSegment, 'base64url').toString('utf8'),
    ) as { actions: string[]; paths: { prefixPaths: string[] } };

    expect(payload.actions).toEqual(['GetObject']);
    expect(payload.paths.prefixPaths).toEqual([input.prefix]);
  });

  it('rechaza acciones de escritura o acciones no reconocidas en runtime', () => {
    expect(() =>
      createR2TenantPrefixCredentials({
        ...input,
        action: 'PutObject' as never,
      }),
    ).toThrow(CloudflareR2StorageConfigurationError);
  });

  it.each([
    'tenants/11111111-2222-4333-8444-555555555555/',
    'tenants/11111111-2222-4333-8444-555555555555/pila-exports',
    'tenants/11111111-2222-4333-8444-555555555555/pila-exports/../other/',
    'tenants/11111111-2222-4333-8444-555555555555/documents/',
    'tenants/11111111-2222-4333-8444-555555555555/employee-disbursements/../documents/',
    'pila-exports/',
  ])('rechaza prefijos fuera de los namespaces permitidos: %s', (prefix) => {
    expect(() => createR2TenantPrefixCredentials({ ...input, prefix })).toThrow(
      InvalidStorageKeyError,
    );
  });

  it('rechaza endpoints que no identifican exactamente una cuenta R2', () => {
    expect(() =>
      createR2TenantPrefixCredentials({
        ...input,
        endpoint: 'https://attacker.example.invalid',
      }),
    ).toThrow(/R2_ENDPOINT/);
  });
});
