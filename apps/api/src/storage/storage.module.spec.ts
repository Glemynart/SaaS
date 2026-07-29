import { Test } from '@nestjs/testing';
import { CloudflareR2StorageProvider } from './cloudflare-r2-storage.provider';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { StorageModule } from './storage.module';
import { StorageService } from './storage.service';
import { STORAGE_PROVIDER, UnknownStorageProviderError } from './storage.types';

describe('StorageModule', () => {
  const previousProvider = process.env.STORAGE_PROVIDER;

  afterEach(() => {
    if (previousProvider === undefined) delete process.env.STORAGE_PROVIDER;
    else process.env.STORAGE_PROVIDER = previousProvider;
  });

  it('registra StorageService y conserva LocalDisk como proveedor predeterminado', async () => {
    delete process.env.STORAGE_PROVIDER;

    const moduleRef = await Test.createTestingModule({
      imports: [StorageModule],
    }).compile();

    expect(moduleRef.get(StorageService)).toBeInstanceOf(StorageService);
    expect(moduleRef.get(STORAGE_PROVIDER)).toBeInstanceOf(
      LocalDiskStorageProvider,
    );
    expect(moduleRef.get(CloudflareR2StorageProvider)).toBeInstanceOf(
      CloudflareR2StorageProvider,
    );
  });

  it('resuelve R2 detrás del mismo token cuando se selecciona explícitamente', async () => {
    process.env.STORAGE_PROVIDER = 'r2';

    const moduleRef = await Test.createTestingModule({
      imports: [StorageModule],
    }).compile();

    expect(moduleRef.get(STORAGE_PROVIDER)).toBeInstanceOf(
      CloudflareR2StorageProvider,
    );
  });

  it('rechaza explícitamente un provider desconocido', async () => {
    process.env.STORAGE_PROVIDER = 'otro';

    await expect(
      Test.createTestingModule({ imports: [StorageModule] }).compile(),
    ).rejects.toBeInstanceOf(UnknownStorageProviderError);
  });
});
