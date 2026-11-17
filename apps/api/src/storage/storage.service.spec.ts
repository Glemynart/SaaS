import { Test } from '@nestjs/testing';
import { StorageService } from './storage.service';
import {
  InvalidStorageKeyError,
  StoragePrefixScopedReadUnavailableError,
  StorageProvider,
  STORAGE_PROVIDER,
} from './storage.types';

describe('StorageService', () => {
  let service: StorageService;

  const mockPut = jest.fn();
  const mockGet = jest.fn();
  const mockGetWithinPrefix = jest.fn();
  const mockDelete = jest.fn();
  const mockExists = jest.fn();
  const mockList = jest.fn();
  const mockCheckReadiness = jest.fn();

  beforeEach(async () => {
    mockPut.mockReset();
    mockGet.mockReset();
    mockGetWithinPrefix.mockReset();
    mockDelete.mockReset();
    mockExists.mockReset();
    mockList.mockReset();
    mockCheckReadiness.mockReset();

    const provider: StorageProvider = {
      put: mockPut,
      get: mockGet,
      delete: mockDelete,
      exists: mockExists,
      list: mockList,
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: STORAGE_PROVIDER, useValue: provider },
      ],
    }).compile();

    service = moduleRef.get(StorageService);
  });

  it('delega putObject en el proveedor', async () => {
    const input = {
      key: 'k',
      body: Buffer.from('x'),
      contentType: 'text/plain',
    };
    const meta = { key: 'k', size: 1, contentType: 'text/plain' };
    mockPut.mockResolvedValue(meta);

    await expect(service.putObject(input)).resolves.toBe(meta);
    expect(mockPut).toHaveBeenCalledWith(input);
  });

  it('delega getObject en el proveedor', async () => {
    const body = Buffer.from('x');
    mockGet.mockResolvedValue(body);

    await expect(service.getObject('k')).resolves.toBe(body);
    expect(mockGet).toHaveBeenCalledWith('k');
  });

  it('falla de forma cerrada si el proveedor no admite lectura con prefijo', async () => {
    await expect(
      Promise.resolve().then(() =>
        service.getObjectWithinPrefix(
          'tenants/tenant-a/pila-exports/file.pdf',
          'tenants/tenant-a/pila-exports/',
        ),
      ),
    ).rejects.toBeInstanceOf(StoragePrefixScopedReadUnavailableError);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('rechaza keys fuera del prefijo antes de invocar al proveedor', async () => {
    await expect(
      Promise.resolve().then(() =>
        service.getObjectWithinPrefix(
          'tenants/tenant-b/pila-exports/file.pdf',
          'tenants/tenant-a/pila-exports/',
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidStorageKeyError);
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockGetWithinPrefix).not.toHaveBeenCalled();
  });

  it('rechaza traversal aunque la key empiece con el prefijo permitido', async () => {
    await expect(
      Promise.resolve().then(() =>
        service.getObjectWithinPrefix(
          'tenants/tenant-a/pila-exports/../private/file.pdf',
          'tenants/tenant-a/pila-exports/',
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidStorageKeyError);
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockGetWithinPrefix).not.toHaveBeenCalled();
  });

  it('delega lecturas acotadas sin recurrir al get general', async () => {
    const provider: StorageProvider = {
      put: mockPut,
      get: mockGet,
      getWithinPrefix: mockGetWithinPrefix,
      delete: mockDelete,
      exists: mockExists,
      list: mockList,
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: STORAGE_PROVIDER, useValue: provider },
      ],
    }).compile();
    service = moduleRef.get(StorageService);
    const body = Buffer.from('scoped');
    mockGetWithinPrefix.mockResolvedValue(body);

    await expect(
      service.getObjectWithinPrefix(
        'tenants/tenant-a/pila-exports/file.pdf',
        'tenants/tenant-a/pila-exports/',
      ),
    ).resolves.toBe(body);
    expect(mockGetWithinPrefix).toHaveBeenCalledWith(
      'tenants/tenant-a/pila-exports/file.pdf',
      'tenants/tenant-a/pila-exports/',
    );
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('delega deleteObject en el proveedor', async () => {
    mockDelete.mockResolvedValue(undefined);

    await service.deleteObject('k');
    expect(mockDelete).toHaveBeenCalledWith('k');
  });

  it('delega objectExists en el proveedor', async () => {
    mockExists.mockResolvedValue(true);

    await expect(service.objectExists('k')).resolves.toBe(true);
    expect(mockExists).toHaveBeenCalledWith('k');
  });

  it('delega listObjects en el proveedor', async () => {
    const result = [{ key: 'tenants/a/pila-exports/x/type-1.txt', size: 3 }];
    mockList.mockResolvedValue(result);

    await expect(service.listObjects('tenants/a/pila-exports/')).resolves.toBe(
      result,
    );
    expect(mockList).toHaveBeenCalledWith('tenants/a/pila-exports/');
  });

  it('delega checkReadiness en el proveedor cuando está disponible', async () => {
    const provider: StorageProvider = {
      put: mockPut,
      get: mockGet,
      delete: mockDelete,
      exists: mockExists,
      list: mockList,
      checkReadiness: mockCheckReadiness,
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: STORAGE_PROVIDER, useValue: provider },
      ],
    }).compile();
    service = moduleRef.get(StorageService);

    await service.checkReadiness();

    expect(mockCheckReadiness).toHaveBeenCalledTimes(1);
    expect(mockExists).not.toHaveBeenCalled();
  });
});
