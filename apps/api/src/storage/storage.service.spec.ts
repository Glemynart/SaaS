import { Test } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { StorageProvider, STORAGE_PROVIDER } from './storage.types';

describe('StorageService', () => {
  let service: StorageService;

  const mockPut = jest.fn();
  const mockGet = jest.fn();
  const mockDelete = jest.fn();
  const mockExists = jest.fn();

  beforeEach(async () => {
    mockPut.mockReset();
    mockGet.mockReset();
    mockDelete.mockReset();
    mockExists.mockReset();

    const provider: StorageProvider = {
      put: mockPut,
      get: mockGet,
      delete: mockDelete,
      exists: mockExists,
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
});
