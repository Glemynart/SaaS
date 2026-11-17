import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { CloudflareR2StorageProvider } from './cloudflare-r2-storage.provider';
import {
  CloudflareR2StorageConfigurationError,
  CloudflareR2StorageUnavailableError,
  StorageObjectNotFoundError,
} from './storage.types';

describe('CloudflareR2StorageProvider', () => {
  const accountId = '0123456789abcdef0123456789abcdef';
  const tenantId = '11111111-2222-4333-8444-555555555555';
  const tenantPrefix = `tenants/${tenantId}/pila-exports/`;
  const disbursementPrefix = `tenants/${tenantId}/employee-disbursements/`;
  const environment = [
    'R2_ENDPOINT',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
  ] as const;
  const previous = new Map<string, string | undefined>();
  let send: jest.SpyInstance;

  beforeEach(() => {
    for (const name of environment) {
      previous.set(name, process.env[name]);
      process.env[name] = `test-${name.toLowerCase()}`;
    }
    process.env.R2_ENDPOINT = `https://${accountId}.r2.cloudflarestorage.com`;
    send = jest.spyOn(S3Client.prototype, 'send');
  });

  afterEach(() => {
    send.mockRestore();
    for (const name of environment) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    previous.clear();
  });

  it('usa el SDK S3 para escribir y devuelve metadata del contrato', async () => {
    send.mockResolvedValueOnce({});
    const provider = new CloudflareR2StorageProvider();

    await expect(
      provider.put({
        key: 'tenant-1/document.pdf',
        body: Buffer.from('pdf'),
        contentType: 'application/pdf',
      }),
    ).resolves.toEqual({
      key: 'tenant-1/document.pdf',
      size: 3,
      contentType: 'application/pdf',
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('convierte una respuesta R2 a Buffer', async () => {
    send.mockResolvedValueOnce({
      Body: {
        transformToByteArray: jest
          .fn()
          .mockResolvedValue(Uint8Array.from([1, 2])),
      },
    });
    const provider = new CloudflareR2StorageProvider();

    await expect(provider.get('tenant-1/document.pdf')).resolves.toEqual(
      Buffer.from([1, 2]),
    );
  });

  it('clasifica NotFound y fallos transitorios', async () => {
    const provider = new CloudflareR2StorageProvider();
    send.mockRejectedValueOnce(s3Error('NoSuchKey', 404));
    await expect(provider.get('tenant-1/missing.pdf')).rejects.toBeInstanceOf(
      StorageObjectNotFoundError,
    );

    send.mockRejectedValueOnce(s3Error('TimeoutError'));
    await expect(provider.get('tenant-1/timeout.pdf')).rejects.toBeInstanceOf(
      CloudflareR2StorageUnavailableError,
    );

    send.mockRejectedValueOnce(s3Error('InternalError', 503));
    await expect(
      provider.get('tenant-1/five-hundred.pdf'),
    ).rejects.toBeInstanceOf(CloudflareR2StorageUnavailableError);
  });

  it('preserva errores permanentes sin clasificarlos como transitorios', async () => {
    const provider = new CloudflareR2StorageProvider();
    const accessDenied = s3Error('AccessDenied', 403);
    send.mockRejectedValueOnce(accessDenied);

    await expect(provider.get('tenant-1/private.pdf')).rejects.toBe(
      accessDenied,
    );
  });

  it('preserva NoSuchBucket como error permanente y no como objeto ausente', async () => {
    const provider = new CloudflareR2StorageProvider();
    const noSuchBucket = s3Error('NoSuchBucket', 404);
    send.mockRejectedValueOnce(noSuchBucket);

    await expect(provider.get('tenant-1/document.pdf')).rejects.toBe(
      noSuchBucket,
    );
  });

  it('crea condicionalmente durante migración y detecta una key concurrente', async () => {
    const provider = new CloudflareR2StorageProvider();
    send.mockResolvedValueOnce({});

    await expect(
      provider.putIfAbsent({
        key: 'tenant-1/document.pdf',
        body: Buffer.from('pdf'),
      }),
    ).resolves.toEqual({
      key: 'tenant-1/document.pdf',
      size: 3,
      contentType: undefined,
    });

    send.mockRejectedValueOnce(s3Error('PreconditionFailed', 412));
    await expect(
      provider.putIfAbsent({
        key: 'tenant-1/document.pdf',
        body: Buffer.from('pdf'),
      }),
    ).resolves.toBeNull();
  });

  it('valida credenciales y endpoint antes de operar R2', () => {
    delete process.env.R2_BUCKET;
    const provider = new CloudflareR2StorageProvider();
    expect(() => provider.validateConfiguration()).toThrow(
      CloudflareR2StorageConfigurationError,
    );
  });

  it.each([
    ['rechaza HTTP', `http://${accountId}.r2.cloudflarestorage.com`],
    ['rechaza host externo', 'https://attacker.example.invalid'],
    [
      'rechaza puerto personalizado',
      `https://${accountId}.r2.cloudflarestorage.com:8443`,
    ],
    ['rechaza rutas', `https://${accountId}.r2.cloudflarestorage.com/other`],
    [
      'rechaza credenciales embebidas',
      `https://user:password@${accountId}.r2.cloudflarestorage.com`,
    ],
    [
      'rechaza query string',
      `https://${accountId}.r2.cloudflarestorage.com/?x=1`,
    ],
    [
      'rechaza fragmento',
      `https://${accountId}.r2.cloudflarestorage.com/#fragment`,
    ],
  ])(
    'rechaza endpoint R2 inseguro antes de enviar solicitudes: %s',
    (_, endpoint) => {
      process.env.R2_ENDPOINT = endpoint;
      const provider = new CloudflareR2StorageProvider();

      expect(() => provider.validateConfiguration()).toThrow(
        CloudflareR2StorageConfigurationError,
      );
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('comprueba la disponibilidad de R2 sin leer objetos de negocio', async () => {
    send.mockResolvedValueOnce({});
    const provider = new CloudflareR2StorageProvider();

    await expect(provider.checkReadiness()).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('lista todas las páginas dentro del prefijo sin salir de su namespace', async () => {
    send
      .mockResolvedValueOnce({
        Contents: [
          { Key: `${tenantPrefix}a/type-1.txt`, Size: 10 },
          {
            Key: 'tenants/22222222-2222-4333-8444-555555555555/pila-exports/b/type-1.txt',
            Size: 20,
          },
        ],
        IsTruncated: true,
        NextContinuationToken: 'next-page',
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: `${tenantPrefix}a/type-2.txt`, Size: 12 }],
        IsTruncated: false,
      });
    const provider = new CloudflareR2StorageProvider();

    await expect(provider.list(tenantPrefix)).resolves.toEqual([
      { key: `${tenantPrefix}a/type-1.txt`, size: 10 },
      { key: `${tenantPrefix}a/type-2.txt`, size: 12 },
    ]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(
      send.mock.calls.map(
        ([command]) => (command as ListObjectsV2Command).input,
      ),
    ).toEqual([
      { Bucket: 'test-r2_bucket', Prefix: tenantPrefix, MaxKeys: 1000 },
      {
        Bucket: 'test-r2_bucket',
        Prefix: tenantPrefix,
        MaxKeys: 1000,
        ContinuationToken: 'next-page',
      },
    ]);
  });

  it('lista el namespace de soportes de desembolso del tenant solicitado', async () => {
    send.mockResolvedValueOnce({
      Contents: [{ Key: `${disbursementPrefix}payment/proof.pdf`, Size: 24 }],
      IsTruncated: false,
    });
    const provider = new CloudflareR2StorageProvider();

    await expect(provider.list(disbursementPrefix)).resolves.toEqual([
      { key: `${disbursementPrefix}payment/proof.pdf`, size: 24 },
    ]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(
      send.mock.calls.map(
        ([command]) => (command as ListObjectsV2Command).input,
      ),
    ).toEqual([
      {
        Bucket: 'test-r2_bucket',
        Prefix: disbursementPrefix,
        MaxKeys: 1000,
      },
    ]);
  });

  it('rechaza el listado de un namespace no autorizado antes de llamar R2', async () => {
    const provider = new CloudflareR2StorageProvider();

    await expect(
      provider.list(`tenants/${tenantId}/documents/`),
    ).rejects.toThrow('storageKey inválida');
    expect(send).not.toHaveBeenCalled();
  });

  it('falla de forma cerrada si una página truncada no trae token de continuación', async () => {
    send.mockResolvedValueOnce({ Contents: [], IsTruncated: true });
    const provider = new CloudflareR2StorageProvider();

    await expect(provider.list(tenantPrefix)).rejects.toBeInstanceOf(
      CloudflareR2StorageUnavailableError,
    );
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('falla de forma cerrada si R2 repite un token de continuación', async () => {
    send
      .mockResolvedValueOnce({
        Contents: [],
        IsTruncated: true,
        NextContinuationToken: 'repeated-page',
      })
      .mockResolvedValueOnce({
        Contents: [],
        IsTruncated: true,
        NextContinuationToken: 'repeated-page',
      });
    const provider = new CloudflareR2StorageProvider();

    await expect(provider.list(tenantPrefix)).rejects.toBeInstanceOf(
      CloudflareR2StorageUnavailableError,
    );
    expect(send).toHaveBeenCalledTimes(2);
  });
});

function s3Error(name: string, statusCode?: number): Error {
  return Object.assign(new Error(name), {
    name,
    $metadata:
      statusCode === undefined ? undefined : { httpStatusCode: statusCode },
  });
}
