import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { CloudflareR2StorageProvider } from './cloudflare-r2-storage.provider';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { LocalToR2Migrator } from './local-to-r2-migrator';
import { StorageProvider } from './storage.types';

describe('LocalToR2Migrator', () => {
  let root: string;
  let local: LocalDiskStorageProvider;
  const previousRoot = process.env.STORAGE_LOCAL_ROOT;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'r2-migrator-test-'));
    process.env.STORAGE_LOCAL_ROOT = root;
    local = new LocalDiskStorageProvider();
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
    if (previousRoot === undefined) delete process.env.STORAGE_LOCAL_ROOT;
    else process.env.STORAGE_LOCAL_ROOT = previousRoot;
  });

  it('copia, verifica hash y es idempotente sin sobrescribir objetos existentes', async () => {
    const key = 'tenant-1/expediente/employee-1/CONTRATO/document.pdf';
    await local.put({ key, body: Buffer.from('local-document') });
    const r2 = memoryStorage();
    const migrator = new LocalToR2Migrator(
      local,
      r2.storage as CloudflareR2StorageProvider,
      root,
    );

    await expect(migrator.migrate()).resolves.toEqual({
      copied: [key],
      existing: [],
      differences: [],
      errors: [],
    });
    await expect(migrator.migrate()).resolves.toEqual({
      copied: [],
      existing: [key],
      differences: [],
      errors: [],
    });
    expect(r2.putIfAbsent).toHaveBeenCalledTimes(2);
  });

  it('reporta diferencias sin sobrescribir la copia existente en R2', async () => {
    const key = 'tenant-1/expediente/employee-1/CONTRATO/document.pdf';
    await local.put({ key, body: Buffer.from('local-document') });
    const r2 = memoryStorage([[key, Buffer.from('different-document')]]);
    const migrator = new LocalToR2Migrator(
      local,
      r2.storage as CloudflareR2StorageProvider,
      root,
    );

    await expect(migrator.migrate()).resolves.toEqual({
      copied: [],
      existing: [key],
      differences: [key],
      errors: [],
    });
    expect(r2.put).not.toHaveBeenCalled();
  });

  it('no sobrescribe una key creada por un escritor concurrente', async () => {
    const key = 'tenant-1/expediente/employee-1/CONTRATO/document.pdf';
    await local.put({ key, body: Buffer.from('local-document') });
    const r2 = memoryStorage();
    r2.beforePutIfAbsent = () => r2.objects.set(key, Buffer.from('r2-writer'));
    const migrator = new LocalToR2Migrator(
      local,
      r2.storage as CloudflareR2StorageProvider,
      root,
    );

    await expect(migrator.migrate()).resolves.toEqual({
      copied: [],
      existing: [key],
      differences: [key],
      errors: [],
    });
    expect(r2.putIfAbsent).toHaveBeenCalledTimes(1);
    expect(r2.objects.get(key)).toEqual(Buffer.from('r2-writer'));
  });
});

function memoryStorage(initial: Array<[string, Buffer]> = []): {
  storage: StorageProvider;
  put: jest.Mock;
  putIfAbsent: jest.Mock;
  objects: Map<string, Buffer>;
  beforePutIfAbsent?: () => void;
} {
  const objects = new Map(initial);
  const put = jest
    .fn()
    .mockImplementation((input: Parameters<StorageProvider['put']>[0]) => {
      objects.set(input.key, input.body);
      return Promise.resolve({
        key: input.key,
        size: input.body.length,
        contentType: input.contentType,
      });
    });
  const get = jest.fn().mockImplementation((key: string) => {
    const body = objects.get(key);
    return body
      ? Promise.resolve(body)
      : Promise.reject(new Error(`not found: ${key}`));
  });
  const remove = jest.fn().mockImplementation((key: string) => {
    objects.delete(key);
    return Promise.resolve();
  });
  const exists = jest.fn().mockImplementation((key: string) => {
    return Promise.resolve(objects.has(key));
  });

  const memory = {
    storage: { put, get, delete: remove, exists } as StorageProvider,
    put,
    putIfAbsent: jest.fn(),
    objects,
    beforePutIfAbsent: undefined as (() => void) | undefined,
  };
  memory.putIfAbsent.mockImplementation(
    (input: Parameters<StorageProvider['put']>[0]) => {
      memory.beforePutIfAbsent?.();
      if (objects.has(input.key)) return Promise.resolve(null);
      objects.set(input.key, input.body);
      return Promise.resolve({
        key: input.key,
        size: input.body.length,
        contentType: input.contentType,
      });
    },
  );

  memory.storage = {
    put,
    get,
    delete: remove,
    exists,
    putIfAbsent: memory.putIfAbsent,
  } as unknown as StorageProvider;
  return memory;
}
