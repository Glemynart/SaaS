import { Test } from '@nestjs/testing';
import { CloudflareR2StorageProvider } from './cloudflare-r2-storage.provider';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { R2MigrationStorageProvider } from './r2-migration-storage.provider';
import { StorageModule } from './storage.module';
import { StorageService } from './storage.service';
import {
  CloudflareR2StorageConfigurationError,
  STORAGE_PROVIDER,
  UnknownStorageProviderError,
} from './storage.types';

describe('StorageModule', () => {
  const environment = [
    'STORAGE_PROVIDER',
    'R2_ENDPOINT',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
  ] as const;
  const previous = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const name of environment) previous.set(name, process.env[name]);
  });

  afterEach(() => {
    for (const name of environment) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    previous.clear();
  });

  it('selecciona LocalDisk por defecto', async () => {
    delete process.env.STORAGE_PROVIDER;
    const moduleRef = await Test.createTestingModule({
      imports: [StorageModule],
    }).compile();

    expect(moduleRef.get(StorageService)).toBeInstanceOf(StorageService);
    expect(moduleRef.get(STORAGE_PROVIDER)).toBeInstanceOf(
      LocalDiskStorageProvider,
    );
  });

  it('selecciona R2 cuando se configura r2', async () => {
    setR2Environment('r2');
    const moduleRef = await Test.createTestingModule({
      imports: [StorageModule],
    }).compile();

    expect(moduleRef.get(STORAGE_PROVIDER)).toBeInstanceOf(
      CloudflareR2StorageProvider,
    );
  });

  it('selecciona el proveedor transitorio para r2-migration', async () => {
    setR2Environment('r2-migration');
    const moduleRef = await Test.createTestingModule({
      imports: [StorageModule],
    }).compile();

    expect(moduleRef.get(STORAGE_PROVIDER)).toBeInstanceOf(
      R2MigrationStorageProvider,
    );
  });

  it('permite rollback por configuración a local', async () => {
    setR2Environment('r2-migration');
    await Test.createTestingModule({ imports: [StorageModule] }).compile();
    process.env.STORAGE_PROVIDER = 'local';

    const rollbackModule = await Test.createTestingModule({
      imports: [StorageModule],
    }).compile();
    expect(rollbackModule.get(STORAGE_PROVIDER)).toBeInstanceOf(
      LocalDiskStorageProvider,
    );
  });

  it('falla al iniciar R2 con configuración incompleta', async () => {
    process.env.STORAGE_PROVIDER = 'r2';
    delete process.env.R2_BUCKET;

    await expect(
      Test.createTestingModule({ imports: [StorageModule] }).compile(),
    ).rejects.toBeInstanceOf(CloudflareR2StorageConfigurationError);
  });

  it('rechaza un modo de provider desconocido', async () => {
    process.env.STORAGE_PROVIDER = 'otro';
    await expect(
      Test.createTestingModule({ imports: [StorageModule] }).compile(),
    ).rejects.toBeInstanceOf(UnknownStorageProviderError);
  });
});

function setR2Environment(provider: 'r2' | 'r2-migration'): void {
  process.env.STORAGE_PROVIDER = provider;
  process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
  process.env.R2_ACCESS_KEY_ID = 'access-key';
  process.env.R2_SECRET_ACCESS_KEY = 'secret-key';
  process.env.R2_BUCKET = 'documents';
}
