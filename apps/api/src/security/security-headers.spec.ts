import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { applySecurityHeaders } from './security-headers';

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const httpRequest = context.switchToHttp().getRequest<Request>();
    if (httpRequest.headers.authorization !== 'Bearer test-token') {
      throw new UnauthorizedException();
    }
    return true;
  }
}

@Controller()
class SecurityHeadersTestController {
  @Get('public')
  publicRoute() {
    return { ok: true };
  }

  @UseGuards(TestAuthGuard)
  @Get('protected')
  protectedRoute() {
    return { ok: true };
  }

  @Get('document.pdf')
  pdf(@Res() response: Response) {
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', 'inline; filename="test.pdf"');
    response.send(Buffer.from('%PDF-1.4'));
  }
}

describe('Security Headers', () => {
  let app: INestApplication;
  let uploadsDirectory: string;

  beforeAll(async () => {
    uploadsDirectory = await mkdtemp(join(tmpdir(), 'saas-security-headers-'));
    await mkdir(join(uploadsDirectory, 'logos'));
    await mkdir(join(uploadsDirectory, 'pdfs'));
    await mkdir(join(uploadsDirectory, 'firmas'));
    await writeFile(join(uploadsDirectory, 'logos', 'logo.png'), 'public logo');
    await writeFile(
      join(uploadsDirectory, 'pdfs', 'contract.pdf'),
      'private contract',
    );
    await writeFile(
      join(uploadsDirectory, 'firmas', 'signature.png'),
      'private signature',
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [SecurityHeadersTestController],
    }).compile();

    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    applySecurityHeaders(nestApp);
    nestApp.useStaticAssets(join(uploadsDirectory, 'logos'), {
      prefix: '/uploads/logos/',
    });
    await nestApp.init();
    app = nestApp;
  });

  afterAll(async () => {
    await app.close();
    await rm(uploadsDirectory, { recursive: true, force: true });
  });

  function expectSecurityHeaders(headers: Record<string, unknown>) {
    expect(headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['x-content-type-options']).toBe('nosniff');
    const contentSecurityPolicy = headers['content-security-policy'];
    expect(contentSecurityPolicy).toEqual(expect.any(String));
    expect(contentSecurityPolicy).toContain("default-src 'self'");
    expect(contentSecurityPolicy).toContain("base-uri 'none'");
    expect(contentSecurityPolicy).toContain("form-action 'none'");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'self'");
    expect(contentSecurityPolicy).toContain("object-src 'none'");
    expect(contentSecurityPolicy).toContain("script-src 'none'");
    expect(contentSecurityPolicy).toContain("script-src-attr 'none'");
    expect(contentSecurityPolicy).toContain("style-src 'self' 'unsafe-inline'");
    expect(contentSecurityPolicy).toContain("img-src 'self' data:");
    expect(contentSecurityPolicy).not.toContain('upgrade-insecure-requests');
    expect(contentSecurityPolicy).not.toContain('font-src');
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['x-powered-by']).toBeUndefined();
  }

  it('applies the headers to unauthenticated responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/public')
      .expect(200);

    expectSecurityHeaders(response.headers);
  });

  it('applies the headers to authenticated and denied responses', async () => {
    const denied = await request(app.getHttpServer())
      .get('/protected')
      .expect(401);
    const authenticated = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expectSecurityHeaders(denied.headers);
    expectSecurityHeaders(authenticated.headers);
  });

  it('keeps public logos consumable across origins', async () => {
    const response = await request(app.getHttpServer())
      .get('/uploads/logos/logo.png')
      .expect(200);

    expectSecurityHeaders(response.headers);
    expect(response.body).toEqual(Buffer.from('public logo'));
    expect(response.headers['cross-origin-resource-policy']).toBeUndefined();
  });

  it('does not expose private documents through /uploads', async () => {
    await request(app.getHttpServer())
      .get('/uploads/pdfs/contract.pdf')
      .expect(404);
    await request(app.getHttpServer())
      .get('/uploads/firmas/signature.png')
      .expect(404);
  });

  it('preserves inline PDF responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/document.pdf')
      .expect(200)
      .expect('Content-Type', /application\/pdf/)
      .expect('Content-Disposition', 'inline; filename="test.pdf"');

    expectSecurityHeaders(response.headers);
  });
});
