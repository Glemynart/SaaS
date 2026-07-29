import { CloudflareR2StorageProvider } from './cloudflare-r2-storage.provider';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { R2MigrationStorageProvider } from './r2-migration-storage.provider';
import {
  CloudflareR2StorageUnavailableError,
  StorageObjectNotFoundError,
  StorageProvider,
} from './storage.types';

describe('R2MigrationStorageProvider', () => {
  const key = 'tenant-1/document.pdf';

  it('hace fallback a LocalDisk cuando R2 no encuentra el objeto', async () => {
    const local = mockStorage({
      get: jest.fn().mockResolvedValue(Buffer.from('local')),
    });
    const r2 = mockStorage({
      get: jest.fn().mockRejectedValue(new StorageObjectNotFoundError(key)),
    });
    const migration = createMigration(local.storage, r2.storage);

    await expect(migration.get(key)).resolves.toEqual(Buffer.from('local'));
    expect(local.get).toHaveBeenCalledWith(key);
  });

  it.each(['timeout', '5xx'])(
    'hace fallback a LocalDisk ante fallo transitorio de R2: %s',
    async () => {
      const local = mockStorage({
        get: jest.fn().mockResolvedValue(Buffer.from('local')),
      });
      const r2 = mockStorage({
        get: jest
          .fn()
          .mockRejectedValue(
            new CloudflareR2StorageUnavailableError('temporal'),
          ),
      });
      const migration = createMigration(local.storage, r2.storage);

      await expect(migration.get(key)).resolves.toEqual(Buffer.from('local'));
      expect(local.get).toHaveBeenCalledWith(key);
    },
  );

  it('no hace fallback ante un error permanente de R2', async () => {
    const local = mockStorage({ get: jest.fn() });
    const permanent = new Error('AccessDenied');
    const r2 = mockStorage({ get: jest.fn().mockRejectedValue(permanent) });
    const migration = createMigration(local.storage, r2.storage);

    await expect(migration.get(key)).rejects.toBe(permanent);
    expect(local.get).not.toHaveBeenCalled();
  });

  it('no hace fallback ante NoSuchBucket', async () => {
    const local = mockStorage({ get: jest.fn() });
    const noSuchBucket = Object.assign(new Error('NoSuchBucket'), {
      name: 'NoSuchBucket',
      $metadata: { httpStatusCode: 404 },
    });
    const r2 = mockStorage({ get: jest.fn().mockRejectedValue(noSuchBucket) });
    const migration = createMigration(local.storage, r2.storage);

    await expect(migration.get(key)).rejects.toBe(noSuchBucket);
    expect(local.get).not.toHaveBeenCalled();
  });

  it('preserva el error original de R2 si LocalDisk tampoco encuentra el objeto', async () => {
    const r2NotFound = new StorageObjectNotFoundError(key);
    const local = mockStorage({
      get: jest.fn().mockRejectedValue(new StorageObjectNotFoundError(key)),
    });
    const r2 = mockStorage({ get: jest.fn().mockRejectedValue(r2NotFound) });
    const migration = createMigration(local.storage, r2.storage);

    await expect(migration.get(key)).rejects.toBe(r2NotFound);
  });

  it('mantiene writes, deletes y exists exclusivamente en R2', async () => {
    const local = mockStorage();
    const r2 = mockStorage({ exists: jest.fn().mockResolvedValue(false) });
    const migration = createMigration(local.storage, r2.storage);

    await migration.put({ key, body: Buffer.from('r2') });
    await migration.delete(key);
    await expect(migration.exists(key)).resolves.toBe(false);
    expect(local.put).not.toHaveBeenCalled();
    expect(local.delete).not.toHaveBeenCalled();
    expect(local.exists).not.toHaveBeenCalled();
  });
});

function createMigration(
  local: StorageProvider,
  r2: StorageProvider,
): R2MigrationStorageProvider {
  return new R2MigrationStorageProvider(
    local as LocalDiskStorageProvider,
    r2 as CloudflareR2StorageProvider,
  );
}

function mockStorage(overrides: Partial<jest.Mocked<StorageProvider>> = {}): {
  storage: StorageProvider;
  put: jest.Mock;
  get: jest.Mock;
  delete: jest.Mock;
  exists: jest.Mock;
} {
  const put = jest.fn().mockResolvedValue({ key: 'default', size: 2 });
  const get = jest.fn().mockResolvedValue(Buffer.from('r2'));
  const remove = jest.fn().mockResolvedValue(undefined);
  const exists = jest.fn().mockResolvedValue(true);
  const storage = { put, get, delete: remove, exists, ...overrides };

  return {
    storage,
    put: storage.put as jest.Mock,
    get: storage.get as jest.Mock,
    delete: storage.delete as jest.Mock,
    exists: storage.exists as jest.Mock,
  };
}
