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
import { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GeneratedDocumentAccessService } from './generated-document-access.service';
import { TenantPrismaService } from '../tenant-prisma/tenant-prisma.service';
import { GeneratedDocumentsController } from './generated-documents.controller';
import { GeneratedDocumentsService } from './generated-documents.service';

interface AuthenticatedRequest extends Request {
  user?: CurrentUserPayload;
}

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.headers.authorization;
    const users: Record<string, CurrentUserPayload> = {
      'Bearer test-token': {
        userId: 'user-001',
        tenantId: 'tenant-001',
        rol: UserRole.OPERADOR,
        email: 'operator@example.com',
      },
      'Bearer viewer-token': {
        userId: 'viewer-001',
        tenantId: 'tenant-001',
        rol: UserRole.VIEWER,
        email: 'viewer@example.com',
      },
      'Bearer other-tenant-token': {
        userId: 'user-002',
        tenantId: 'tenant-002',
        rol: UserRole.OPERADOR,
        email: 'other@example.com',
      },
    };
    const user = token ? users[token] : undefined;
    if (!user) throw new UnauthorizedException();

    request.user = user;
    return true;
  }
}

describe('Generated document private delivery', () => {
  let app: INestApplication<App>;

  const documents = new Map([
    [
      'contract-001',
      {
        id: 'contract-001',
        tenantId: 'tenant-001',
        employeeId: 'employee-001',
        templateId: 'template-001',
        nombre: 'Contrato laboral',
        tipo: 'CONTRACT',
        estado: 'MATERIALIZADO',
        pdfStorageKey: 'pdfs/tenant-001-contract-001.pdf',
        pdfSizeBytes: 21,
        pdfUrl: '/uploads/pdfs/tenant-001-contract-001.pdf',
        createdAt: new Date('2026-07-29T00:00:00.000Z'),
        contenidoFinal: '<p>No debe exponerse</p>',
        employee: {
          id: 'employee-001',
          primerNombre: 'Ana',
          segundoNombre: null,
          primerApellido: 'Gómez',
          segundoApellido: null,
          cedula: '123',
          cargo: 'Analista',
          tipoDocumento: 'CC',
          sedeRef: { id: 'sede-001', nombre: 'Principal' },
        },
        template: { id: 'template-001', nombre: 'Contrato', tipo: 'CONTRACT' },
      },
    ],
    [
      'pending-001',
      {
        id: 'pending-001',
        tenantId: 'tenant-001',
        employeeId: 'employee-001',
        templateId: 'template-001',
        nombre: 'Pendiente',
        tipo: 'CONTRACT',
        estado: 'PENDIENTE_MATERIALIZACION',
        pdfStorageKey: null,
        pdfSizeBytes: null,
        pdfUrl: null,
        createdAt: new Date('2026-07-29T00:00:00.000Z'),
        employee: {
          id: 'employee-001',
          primerNombre: 'Ana',
          segundoNombre: null,
          primerApellido: 'Gómez',
          segundoApellido: null,
          cedula: '123',
          cargo: 'Analista',
          tipoDocumento: 'CC',
          sedeRef: null,
        },
        template: { id: 'template-001', nombre: 'Contrato', tipo: 'CONTRACT' },
      },
    ],
  ]);

  const findFirst = jest.fn(
    ({ where }: { where: { id: string; tenantId: string } }) => {
      const document = documents.get(where.id);
      return Promise.resolve(
        document?.tenantId === where.tenantId ? document : null,
      );
    },
  );
  const getObject = jest.fn((storageKey: string) =>
    Promise.resolve(Buffer.from(`PDF:${storageKey}`)),
  );
  const auditLog = jest.fn(() => Promise.resolve(undefined));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GeneratedDocumentsController],
      providers: [
        GeneratedDocumentAccessService,
        { provide: GeneratedDocumentsService, useValue: {} },
        {
          provide: PrismaService,
          useValue: { generatedDocument: { findFirst } },
        },
        {
          provide: TenantPrismaService,
          useValue: {
            execute: (
              work: (prisma: {
                generatedDocument: { findFirst: typeof findFirst };
              }) => unknown,
            ) => work({ generatedDocument: { findFirst } }),
          },
        },
        { provide: StorageService, useValue: { getObject } },
        { provide: AuditService, useValue: { log: auditLog } },
        RolesGuard,
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new TestAuthGuard())
      .overrideGuard(ActiveTenantGuard)
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
    getObject.mockClear();
    auditLog.mockClear();
  });

  it('devuelve sólo metadata segura para el documento del tenant', async () => {
    const response = await request(app.getHttpServer())
      .get('/generated-documents/contract-001')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body).toMatchObject({
      id: 'contract-001',
      nombre: 'Contrato laboral',
      tipo: 'CONTRACT',
      estado: 'MATERIALIZADO',
      pdfSizeBytes: 21,
      pdfAvailable: true,
      employeeId: 'employee-001',
      templateId: 'template-001',
    });
    expect(response.body).not.toHaveProperty('pdfStorageKey');
    expect(response.body).not.toHaveProperty('pdfUrl');
    expect(response.body).not.toHaveProperty('storageKey');
    expect(response.body).not.toHaveProperty('contenidoFinal');
    expect(getObject).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('descarga el PDF mediante el contrato canónico y audita el acceso', async () => {
    const response = await request(app.getHttpServer())
      .get('/generated-documents/contract-001/download')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect('Content-Type', /application\/pdf/)
      .expect('Cache-Control', 'private, no-store');

    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.body).toEqual(
      Buffer.from('PDF:pdfs/tenant-001-contract-001.pdf'),
    );
    expect(getObject).toHaveBeenCalledWith('pdfs/tenant-001-contract-001.pdf');
    expect(auditLog).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      userId: 'user-001',
      action: 'GENERATED_DOCUMENT_ACCESS_GRANTED',
      entityType: 'GeneratedDocument',
      entityId: 'contract-001',
      metadata: { delivery: 'DOWNLOAD', documentType: 'CONTRACT' },
    });
  });

  it('descarga nombres Unicode con un Content-Disposition HTTP válido', async () => {
    const document = documents.get('contract-001');
    if (!document) throw new Error('No se encontró el documento de prueba.');

    const originalName = document.nombre;
    document.nombre = 'Contrato laboral — Ana Gómez';

    try {
      const response = await request(app.getHttpServer())
        .get('/generated-documents/contract-001/download')
        .set('Authorization', 'Bearer test-token')
        .expect(200)
        .expect('Content-Type', /application\/pdf/);

      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="Contrato laboral _ Ana Gomez.pdf"; filename*=UTF-8\'\'Contrato%20laboral%20%E2%80%94%20Ana%20G%C3%B3mez.pdf',
      );
    } finally {
      document.nombre = originalName;
    }
  });

  it('mantiene el endpoint PDF legado con entrega inline', async () => {
    const response = await request(app.getHttpServer())
      .get('/generated-documents/contract-001/pdf')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect('Content-Type', /application\/pdf/);

    expect(response.headers['content-disposition']).toContain('inline');
    expect(response.body).toEqual(
      Buffer.from('PDF:pdfs/tenant-001-contract-001.pdf'),
    );
    expect(auditLog).toHaveBeenCalledTimes(1);
  });

  it('rechaza documento inexistente sin leer storage ni auditar', async () => {
    await request(app.getHttpServer())
      .get('/generated-documents/missing-001/download')
      .set('Authorization', 'Bearer test-token')
      .expect(404);

    expect(getObject).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('rechaza la descarga de un documento no materializado', async () => {
    await request(app.getHttpServer())
      .get('/generated-documents/pending-001/download')
      .set('Authorization', 'Bearer test-token')
      .expect(404);

    expect(getObject).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('oculta un documento de otro tenant', async () => {
    await request(app.getHttpServer())
      .get('/generated-documents/contract-001/download')
      .set('Authorization', 'Bearer other-tenant-token')
      .expect(404);

    expect(getObject).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('bloquea un rol sin permiso antes de consultar el documento', async () => {
    await request(app.getHttpServer())
      .get('/generated-documents/contract-001/download')
      .set('Authorization', 'Bearer viewer-token')
      .expect(403);

    expect(findFirst).not.toHaveBeenCalled();
    expect(getObject).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });
});
