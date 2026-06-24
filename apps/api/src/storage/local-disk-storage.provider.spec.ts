import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import {
  InvalidStorageKeyError,
  StorageObjectNotFoundError,
} from './storage.types';

describe('LocalDiskStorageProvider', () => {
  let root: string;
  let provider: LocalDiskStorageProvider;
  const previousRoot = process.env.STORAGE_LOCAL_ROOT;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    process.env.STORAGE_LOCAL_ROOT = root;
    provider = new LocalDiskStorageProvider();
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
    if (previousRoot === undefined) {
      delete process.env.STORAGE_LOCAL_ROOT;
    } else {
      process.env.STORAGE_LOCAL_ROOT = previousRoot;
    }
  });

  const key = 'tenant-1/expediente/emp-1/CONTRATO/doc_v1.pdf';

  it('persiste un objeto creando los directorios necesarios y devuelve metadata', async () => {
    const body = Buffer.from('contenido pdf');

    const meta = await provider.put({
      key,
      body,
      contentType: 'application/pdf',
    });

    expect(meta).toEqual({
      key,
      size: body.length,
      contentType: 'application/pdf',
    });
    const written = await fs.readFile(path.join(root, key));
    expect(written.equals(body)).toBe(true);
  });

  it('lee el contenido previamente escrito', async () => {
    const body = Buffer.from('hola');
    await provider.put({ key, body });

    const read = await provider.get(key);

    expect(read.equals(body)).toBe(true);
  });

  it('reporta existencia correctamente', async () => {
    expect(await provider.exists(key)).toBe(false);
    await provider.put({ key, body: Buffer.from('x') });
    expect(await provider.exists(key)).toBe(true);
  });

  it('elimina un objeto existente', async () => {
    await provider.put({ key, body: Buffer.from('x') });
    await provider.delete(key);
    expect(await provider.exists(key)).toBe(false);
  });

  it('el borrado es idempotente sobre keys inexistentes', async () => {
    await expect(provider.delete(key)).resolves.toBeUndefined();
  });

  it('lanza StorageObjectNotFoundError al leer una key inexistente', async () => {
    await expect(provider.get('tenant-1/no-existe.pdf')).rejects.toBeInstanceOf(
      StorageObjectNotFoundError,
    );
  });

  it('sobrescribe el contenido al hacer put sobre una key existente', async () => {
    await provider.put({ key, body: Buffer.from('v1') });
    await provider.put({ key, body: Buffer.from('version-2') });
    const read = await provider.get(key);
    expect(read.toString()).toBe('version-2');
  });

  describe('validación de keys (path traversal)', () => {
    it.each([
      ['../escape.txt'],
      ['tenant-1/../../escape.txt'],
      ['tenant-1/sub/../../../escape.txt'],
    ])('rechaza la key con traversal "%s"', async (badKey) => {
      await expect(
        provider.put({ key: badKey, body: Buffer.from('x') }),
      ).rejects.toBeInstanceOf(InvalidStorageKeyError);
    });

    it.each([[''], ['   '], ['/'], ['//']])(
      'rechaza la key vacía o sin segmentos "%s"',
      async (badKey) => {
        await expect(
          provider.put({ key: badKey, body: Buffer.from('x') }),
        ).rejects.toBeInstanceOf(InvalidStorageKeyError);
      },
    );

    it('normaliza separadores de Windows sin escapar del root', async () => {
      const winKey = 'tenant-1\\expediente\\doc.pdf';
      await provider.put({ key: winKey, body: Buffer.from('x') });
      const written = await fs.readFile(
        path.join(root, 'tenant-1', 'expediente', 'doc.pdf'),
      );
      expect(written.toString()).toBe('x');
    });

    it('un prefijo absoluto se trata como relativo al root', async () => {
      await provider.put({ key: '/tenant-1/abs.pdf', body: Buffer.from('x') });
      const written = await fs.readFile(path.join(root, 'tenant-1', 'abs.pdf'));
      expect(written.toString()).toBe('x');
    });
  });
});
