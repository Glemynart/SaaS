import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuditService } from '../audit/audit.service';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { ExpedienteDocsController } from './expediente-docs.controller';
import { ExpedienteDocsService } from './expediente-docs.service';

interface AuthenticatedRequest extends Request {
  user?: CurrentUserPayload;
}

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.headers.authorization;
    const users: Record<string, CurrentUserPayload> = {
      'Bearer tenant-a-token': {
        userId: 'user-a',
        tenantId: 'tenant-a',
        rol: UserRole.OPERADOR,
        email: 'operator-a@example.test',
      },
      'Bearer tenant-b-token': {
        userId: 'user-b',
        tenantId: 'tenant-b',
        rol: UserRole.OPERADOR,
        email: 'operator-b@example.test',
      },
    };
    const user = token ? users[token] : undefined;
    if (!user) throw new UnauthorizedException();

    request.user = user;
    return true;
  }
}

describe('Expediente document private delivery', () => {
  let app: INestApplication<App>;

  const storageKey = 'tenant-a/expediente/employee-a/family-a_v1.pdf';
  const document = {
    id: 'doc-a',
    tenantId: 'tenant-a',
    nombre: 'Acta.pdf',
    mimeType: 'application/pdf',
    storageKey,
    familiaId: 'family-a',
    version: 1,
    categoria: 'OTRO',
    generatedDocumentId: null,
    contratoId: null,
  };

  const findFirst = jest.fn(
    ({ where }: { where: { id: string; tenantId: string } }) =>
      Promise.resolve(
        document.id === where.id && document.tenantId === where.tenantId
          ? document
          : null,
      ),
  );
  const getObject = jest.fn(() =>
    Promise.resolve(Buffer.from('%PDF-1.7 test')),
  );
  const auditLog = jest.fn(() => Promise.resolve(undefined));
  const ensureActive = jest.fn(() => Promise.resolve(undefined));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ExpedienteDocsController],
      providers: [
        ExpedienteDocsService,
        {
          provide: PrismaService,
          useValue: { expedienteDoc: { findFirst } },
        },
        { provide: TenantPrismaService, useValue: {} },
        { provide: AuditService, useValue: { log: auditLog } },
        { provide: StorageService, useValue: { getObject } },
        { provide: TenantsService, useValue: { ensureActive } },
        ActiveTenantGuard,
        RolesGuard,
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findFirst.mockClear();
    getObject.mockClear();
    auditLog.mockClear();
    ensureActive.mockClear();
  });

  it('downloads the expediente PDF for its tenant and records authorized access', async () => {
    const response = await request(app.getHttpServer())
      .get('/expediente-docs/doc-a/download')
      .set('Authorization', 'Bearer tenant-a-token')
      .expect(200)
      .expect('Content-Type', /application\/pdf/)
      .expect('Cache-Control', 'private, no-store');

    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.body).toEqual(Buffer.from('%PDF-1.7 test'));
    expect(ensureActive).toHaveBeenCalledWith('tenant-a');
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'doc-a', tenantId: 'tenant-a' } }),
    );
    expect(getObject).toHaveBeenCalledWith(storageKey);
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        userId: 'user-a',
        action: 'EXPEDIENTE_DOCUMENT_ACCESS_GRANTED',
        entityId: 'doc-a',
      }),
    );
  });

  it('hides another tenant’s document before reading storage or auditing access', async () => {
    await request(app.getHttpServer())
      .get('/expediente-docs/doc-a/download')
      .set('Authorization', 'Bearer tenant-b-token')
      .expect(404);

    expect(ensureActive).toHaveBeenCalledWith('tenant-b');
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'doc-a', tenantId: 'tenant-b' } }),
    );
    expect(getObject).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });
});
