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
import { mkdtemp, rm, writeFile } from 'fs/promises';
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
    await writeFile(join(uploadsDirectory, 'asset.txt'), 'static asset');

    const moduleRef = await Test.createTestingModule({
      controllers: [SecurityHeadersTestController],
    }).compile();

    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    applySecurityHeaders(nestApp);
    nestApp.useStaticAssets(uploadsDirectory, { prefix: '/uploads/' });
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

  it('keeps static uploads consumable across origins', async () => {
    const response = await request(app.getHttpServer())
      .get('/uploads/asset.txt')
      .expect(200)
      .expect('static asset');

    expectSecurityHeaders(response.headers);
    expect(response.headers['cross-origin-resource-policy']).toBeUndefined();
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
