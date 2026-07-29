import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DenyByDefaultGuard } from '../auth/authorization/deny-by-default.guard';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StorageObjectNotFoundError } from '../storage/storage.types';
import { PublicLogoController } from './public-logo.controller';
import { TenantBrandingService } from './tenant-branding.service';

describe('Public logo delivery', () => {
  let app: INestApplication;
  const getObject = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicLogoController],
      providers: [
        TenantBrandingService,
        { provide: PrismaService, useValue: {} },
        { provide: StorageService, useValue: { getObject } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalGuards(new DenyByDefaultGuard());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    getObject.mockReset();
  });

  it('mantiene la URL pública y entrega el logo mediante StorageService', async () => {
    getObject.mockResolvedValue(Buffer.from('logo'));

    const response = await request(app.getHttpServer())
      .get('/uploads/logos/tenant-1-logo.png')
      .expect(200);

    expect(response.headers['content-type']).toMatch(/^image\/png/);
    expect(response.body).toEqual(Buffer.from('logo'));
    expect(getObject).toHaveBeenCalledWith('logos/tenant-1-logo.png');
  });

  it('devuelve 404 cuando el logo no existe en el provider activo', async () => {
    getObject.mockRejectedValue(
      new StorageObjectNotFoundError('logos/missing.png'),
    );

    await request(app.getHttpServer())
      .get('/uploads/logos/missing.png')
      .expect(404);
  });
});
