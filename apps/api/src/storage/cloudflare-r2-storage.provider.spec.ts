import { S3Client } from '@aws-sdk/client-s3';
import { CloudflareR2StorageProvider } from './cloudflare-r2-storage.provider';
import {
  CloudflareR2StorageConfigurationError,
  CloudflareR2StorageUnavailableError,
  StorageObjectNotFoundError,
} from './storage.types';

describe('CloudflareR2StorageProvider', () => {
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
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
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
    ['rechaza HTTP', 'http://account.r2.cloudflarestorage.com'],
    ['rechaza host externo', 'https://attacker.example.invalid'],
    [
      'rechaza puerto personalizado',
      'https://account.r2.cloudflarestorage.com:8443',
    ],
    ['rechaza rutas', 'https://account.r2.cloudflarestorage.com/other'],
    [
      'rechaza credenciales embebidas',
      'https://user:password@account.r2.cloudflarestorage.com',
    ],
    ['rechaza query string', 'https://account.r2.cloudflarestorage.com/?x=1'],
    ['rechaza fragmento', 'https://account.r2.cloudflarestorage.com/#fragment'],
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
});

function s3Error(name: string, statusCode?: number): Error {
  return Object.assign(new Error(name), {
    name,
    $metadata:
      statusCode === undefined ? undefined : { httpStatusCode: statusCode },
  });
}
