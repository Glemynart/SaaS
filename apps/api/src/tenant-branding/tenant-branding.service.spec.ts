import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import { join } from 'path';
import { TenantBrandingService } from './tenant-branding.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StorageObjectNotFoundError } from '../storage/storage.types';

describe('TenantBrandingService', () => {
  let service: TenantBrandingService;

  const mockTenantFindUnique = jest.fn();
  const mockTenantUpdate = jest.fn();
  const mockPutObject = jest.fn();
  const mockGetObject = jest.fn();

  beforeEach(async () => {
    mockTenantFindUnique.mockReset().mockResolvedValue({ id: 't1' });
    mockTenantUpdate
      .mockReset()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(data),
      );
    mockPutObject.mockReset().mockResolvedValue({ key: 'k', size: 1 });
    mockGetObject.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [
        TenantBrandingService,
        {
          provide: PrismaService,
          useValue: {
            tenant: {
              findUnique: mockTenantFindUnique,
              update: mockTenantUpdate,
            },
          },
        },
        {
          provide: StorageService,
          useValue: {
            putObject: mockPutObject,
            getObject: mockGetObject,
          },
        },
      ],
    }).compile();

    service = moduleRef.get(TenantBrandingService);
  });

  it('uploadLogo persiste vía StorageService con la storageKey y URL esperadas', async () => {
    const buffer = Buffer.from('imagen');

    const result = await service.uploadLogo('t1', 'logo.png', buffer);

    expect(mockPutObject).toHaveBeenCalledTimes(1);
    expect(mockPutObject).toHaveBeenCalledWith({
      key: expect.stringMatching(/^logos\/t1-logo-\d+\.png$/) as string,
      body: buffer,
    });
    expect(result.logoUrl).toMatch(/^\/uploads\/logos\/t1-logo-\d+\.png$/);
  });

  it('uploadFirma persiste vía StorageService con la storageKey y URL esperadas', async () => {
    const buffer = Buffer.from('firma');

    const result = await service.uploadFirma('t1', 'firma.jpg', buffer);

    expect(mockPutObject).toHaveBeenCalledTimes(1);
    expect(mockPutObject).toHaveBeenCalledWith({
      key: expect.stringMatching(/^firmas\/t1-firma-\d+\.jpg$/) as string,
      body: buffer,
    });
    expect(result.firmaRepresentanteUrl).toMatch(
      /^\/uploads\/firmas\/t1-firma-\d+\.jpg$/,
    );
  });

  it('lanza NotFound y no escribe nada si la empresa no existe', async () => {
    mockTenantFindUnique.mockResolvedValue(null);

    await expect(
      service.uploadLogo('t1', 'logo.png', Buffer.from('x')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mockPutObject).not.toHaveBeenCalled();
  });

  it('lee la firma privada mediante StorageService', async () => {
    const body = Buffer.from('firma privada');
    mockTenantFindUnique.mockResolvedValue({
      firmaRepresentanteUrl: '/uploads/firmas/t1-firma.png',
    });
    mockGetObject.mockResolvedValue(body);

    await expect(service.getFirma('t1')).resolves.toEqual({
      body,
      contentType: 'image/png',
    });
    expect(mockTenantFindUnique).toHaveBeenCalledWith({
      where: { id: 't1' },
      select: { firmaRepresentanteUrl: true },
    });
    expect(mockGetObject).toHaveBeenCalledWith('firmas/t1-firma.png');
  });

  it('no expone una firma inexistente', async () => {
    mockTenantFindUnique.mockResolvedValue({
      firmaRepresentanteUrl: '/uploads/firmas/missing.png',
    });
    mockGetObject.mockRejectedValue(
      new StorageObjectNotFoundError('firmas/missing.png'),
    );

    await expect(service.getFirma('t1')).rejects.toThrow(
      'Archivo de firma no encontrado',
    );
  });

  it('el código fuente no contiene escrituras directas a fs', () => {
    const src = fs.readFileSync(
      join(__dirname, 'tenant-branding.service.ts'),
      'utf8',
    );
    expect(src).not.toMatch(
      /writeFileSync|writeFile\(|createWriteStream|mkdirSync/,
    );
    expect(src).toMatch(/storage\.putObject/);
    expect(src).toMatch(/storage\.getObject/);
  });
});
