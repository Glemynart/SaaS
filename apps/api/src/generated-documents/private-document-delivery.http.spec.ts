import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { UserRole } from '@prisma/client';
import { GeneratedDocumentsController } from './generated-documents.controller';
import { GeneratedDocumentsService } from './generated-documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { ExpedienteDocsService } from '../expediente-docs/expediente-docs.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { PdfRenderService } from '../pdf-render/pdf-render.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantBrandingController } from '../tenant-branding/tenant-branding.controller';
import { TenantBrandingService } from '../tenant-branding/tenant-branding.service';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    tenantId: string;
    rol: UserRole;
    email: string;
  };
}

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const httpRequest = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    if (httpRequest.headers.authorization !== 'Bearer test-token') {
      throw new UnauthorizedException();
    }

    httpRequest.user = {
      userId: 'user-001',
      tenantId: 'tenant-001',
      rol: UserRole.OPERADOR,
      email: 'operator@example.com',
    };
    return true;
  }
}

describe('Authenticated private document delivery', () => {
  let app: INestApplication<App>;

  const documents = new Map([
    [
      'contract-001',
      {
        id: 'contract-001',
        nombre: 'Contrato laboral',
        pdfStorageKey: 'pdfs/tenant-001-contract-001.pdf',
        pdfUrl: '/uploads/pdfs/tenant-001-contract-001.pdf',
      },
    ],
    [
      'certification-001',
      {
        id: 'certification-001',
        nombre: 'Certificación laboral',
        pdfStorageKey: 'pdfs/tenant-001-certification-001.pdf',
        pdfUrl: '/uploads/pdfs/tenant-001-certification-001.pdf',
      },
    ],
  ]);

  const findFirst = jest.fn(
    ({ where }: { where: { id: string; tenantId: string } }) =>
      where.tenantId === 'tenant-001'
        ? Promise.resolve(documents.get(where.id) ?? null)
        : Promise.resolve(null),
  );
  const findTenant = jest.fn(() =>
    Promise.resolve({
      firmaRepresentanteUrl: '/uploads/firmas/tenant-001-signature.png',
    }),
  );
  const getObject = jest.fn((storageKey: string) =>
    Promise.resolve(
      Buffer.from(
        storageKey.startsWith('firmas/')
          ? `SIGNATURE:${storageKey}`
          : `PDF:${storageKey}`,
      ),
    ),
  );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GeneratedDocumentsController, TenantBrandingController],
      providers: [
        GeneratedDocumentsService,
        TenantBrandingService,
        {
          provide: PrismaService,
          useValue: {
            generatedDocument: { findFirst },
            tenant: { findUnique: findTenant },
          },
        },
        { provide: TenantPrismaService, useValue: {} },
        { provide: ExpedienteDocsService, useValue: {} },
        { provide: AuditService, useValue: {} },
        { provide: StorageService, useValue: { getObject } },
        { provide: PdfRenderService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new TestAuthGuard())
      .overrideGuard(ActiveTenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findFirst.mockClear();
    findTenant.mockClear();
    getObject.mockClear();
  });

  it('bloquea la descarga sin autenticación antes de consultar el documento', async () => {
    await request(app.getHttpServer())
      .get('/generated-documents/contract-001/pdf')
      .expect(401);

    expect(findFirst).not.toHaveBeenCalled();
    expect(getObject).not.toHaveBeenCalled();
  });

  it.each([
    ['contrato', 'contract-001', 'pdfs/tenant-001-contract-001.pdf'],
    [
      'certificación',
      'certification-001',
      'pdfs/tenant-001-certification-001.pdf',
    ],
  ])(
    'permite descargar %s mediante el endpoint autenticado',
    async (_documentType, documentId, storageKey) => {
      const response = await request(app.getHttpServer())
        .get(`/generated-documents/${documentId}/pdf`)
        .set('Authorization', 'Bearer test-token')
        .expect(200)
        .expect('Content-Type', /application\/pdf/)
        .expect('Cache-Control', 'private, no-store');

      expect(response.body).toEqual(Buffer.from(`PDF:${storageKey}`));
      expect(findFirst).toHaveBeenCalledWith({
        where: { id: documentId, tenantId: 'tenant-001' },
        select: {
          id: true,
          nombre: true,
          pdfStorageKey: true,
          pdfUrl: true,
        },
      });
      expect(getObject).toHaveBeenCalledWith(storageKey);
    },
  );

  it('mantiene la firma disponible únicamente mediante el endpoint autenticado', async () => {
    await request(app.getHttpServer())
      .get('/tenant-branding/firma')
      .expect(401);

    const response = await request(app.getHttpServer())
      .get('/tenant-branding/firma')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect('Content-Type', /image\/png/)
      .expect('Cache-Control', 'private, no-store');

    expect(response.body).toEqual(
      Buffer.from('SIGNATURE:firmas/tenant-001-signature.png'),
    );
    expect(findTenant).toHaveBeenCalledWith({
      where: { id: 'tenant-001' },
      select: { firmaRepresentanteUrl: true },
    });
    expect(getObject).toHaveBeenCalledWith('firmas/tenant-001-signature.png');
  });
});
