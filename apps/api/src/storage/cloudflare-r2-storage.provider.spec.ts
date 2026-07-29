import { CloudflareR2StorageProvider } from './cloudflare-r2-storage.provider';
import { CloudflareR2StorageUnavailableError } from './storage.types';

describe('CloudflareR2StorageProvider', () => {
  const environment = [
    'R2_ENDPOINT',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
  ] as const;
  const previous = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const name of environment) {
      previous.set(name, process.env[name]);
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of environment) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    previous.clear();
  });

  it('falla cerradamente sin credenciales y no inicia transferencias reales', async () => {
    const provider = new CloudflareR2StorageProvider();

    await expect(
      provider.put({ key: 'tenant-1/document.pdf', body: Buffer.from('pdf') }),
    ).rejects.toBeInstanceOf(CloudflareR2StorageUnavailableError);
    await expect(provider.get('tenant-1/document.pdf')).rejects.toThrow(
      'R2_ENDPOINT',
    );
    await expect(provider.delete('tenant-1/document.pdf')).rejects.toThrow(
      'R2_BUCKET',
    );
    await expect(provider.exists('tenant-1/document.pdf')).rejects.toThrow(
      CloudflareR2StorageUnavailableError,
    );
  });
});
