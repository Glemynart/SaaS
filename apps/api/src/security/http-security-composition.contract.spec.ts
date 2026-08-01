import {
  BadRequestException,
  Controller,
  Get,
  INestApplication,
  Module,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import type { Server } from 'http';
import request from 'supertest';
import { Unauthenticated } from '../auth/authorization/authorization-policy';
import { DenyByDefaultGuard } from '../auth/authorization/deny-by-default.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantsService } from '../tenants/tenants.service';
import { applySecurityHeaders } from './security-headers';

const protectedHandler = jest.fn((user: CurrentUserPayload) => ({
  userId: user.userId,
  tenantId: user.tenantId,
}));
const missingPolicyHandler = jest.fn(() => ({ executed: true }));
const ensureActive = jest.fn();
const pipelineTrace: string[] = [];
const denyByDefaultCanActivate = DenyByDefaultGuard.prototype.canActivate;
const jwtCanActivate = JwtAuthGuard.prototype.canActivate;
const activeTenantCanActivate = ActiveTenantGuard.prototype.canActivate;
const rolesCanActivate = RolesGuard.prototype.canActivate;

@Controller('http-security-contract')
class HttpSecurityContractController {
  @Unauthenticated()
  @Get('public')
  publicRoute() {
    return { ok: true };
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, ActiveTenantGuard, RolesGuard)
  @Get('protected')
  protectedRoute(@CurrentUser() user: CurrentUserPayload) {
    return protectedHandler(user);
  }

  @Get('missing-policy')
  missingPolicy() {
    return missingPolicyHandler();
  }
}

@Module({
  controllers: [HttpSecurityContractController],
  providers: [
    JwtService,
    JwtAuthGuard,
    ActiveTenantGuard,
    RolesGuard,
    { provide: TenantsService, useValue: { ensureActive } },
  ],
})
class HttpSecurityContractModule {}

describe('HTTP security composition contracts', () => {
  let app: INestApplication;
  let server: Server;
  let jwtService: JwtService;
  const originalJwtSecret = process.env.JWT_SECRET;
  const secret = 'sts-04-contract-secret';

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    jest
      .spyOn(DenyByDefaultGuard.prototype, 'canActivate')
      .mockImplementation(function (context) {
        pipelineTrace.push('deny-by-default');
        return denyByDefaultCanActivate.call(this, context);
      });
    jest
      .spyOn(JwtAuthGuard.prototype, 'canActivate')
      .mockImplementation(async function (context) {
        pipelineTrace.push('jwt');
        return jwtCanActivate.call(this, context);
      });
    jest
      .spyOn(ActiveTenantGuard.prototype, 'canActivate')
      .mockImplementation(async function (context) {
        pipelineTrace.push('active-tenant');
        return activeTenantCanActivate.call(this, context);
      });
    jest
      .spyOn(RolesGuard.prototype, 'canActivate')
      .mockImplementation(function (context) {
        pipelineTrace.push('rbac');
        return rolesCanActivate.call(this, context);
      });
    const moduleRef = await Test.createTestingModule({
      imports: [HttpSecurityContractModule],
    }).compile();
    app = moduleRef.createNestApplication();
    applySecurityHeaders(app);
    app.useGlobalGuards(new DenyByDefaultGuard());
    await app.init();
    server = app.getHttpServer() as Server;
    jwtService = moduleRef.get(JwtService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    pipelineTrace.length = 0;
    ensureActive.mockResolvedValue({ id: 'tenant-a', activo: true });
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it('keeps production security headers on public, 401, 403, and authorized responses', async () => {
    const adminToken = await tokenFor(UserRole.ADMIN);
    const responses = [
      await request(server).get('/http-security-contract/public').expect(200),
      await request(server)
        .get('/http-security-contract/protected')
        .expect(401),
      await request(server)
        .get('/http-security-contract/protected')
        .set('Authorization', `Bearer ${await tokenFor(UserRole.VIEWER)}`)
        .expect(403),
      await request(server)
        .get('/http-security-contract/protected')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200),
    ];

    responses.forEach(({ headers }) => expectSecurityHeaders(headers));
  });

  it('rejects missing authorization before tenant, RBAC, or handler execution', async () => {
    await request(server).get('/http-security-contract/protected').expect(401);

    expect(ensureActive).not.toHaveBeenCalled();
    expect(protectedHandler).not.toHaveBeenCalled();
  });

  it('rejects an inactive tenant before RBAC or handler execution', async () => {
    ensureActive.mockRejectedValue(new BadRequestException('Tenant inactive'));

    await request(server)
      .get('/http-security-contract/protected')
      .set('Authorization', `Bearer ${await tokenFor(UserRole.ADMIN)}`)
      .expect(400);

    expect(ensureActive).toHaveBeenCalledWith('tenant-a');
    expect(protectedHandler).not.toHaveBeenCalled();
  });

  it('rejects an insufficient role before handler execution', async () => {
    await request(server)
      .get('/http-security-contract/protected')
      .set('Authorization', `Bearer ${await tokenFor(UserRole.VIEWER)}`)
      .expect(403);

    expect(ensureActive).toHaveBeenCalledWith('tenant-a');
    expect(protectedHandler).not.toHaveBeenCalled();
  });

  it('keeps Deny by Default in the HTTP pipeline and stops unclassified handlers', async () => {
    await request(server)
      .get('/http-security-contract/missing-policy')
      .expect(403);

    expect(missingPolicyHandler).not.toHaveBeenCalled();
  });

  it('allows an authorized request through JWT, tenant validation, and RBAC to the handler', async () => {
    await request(server)
      .get('/http-security-contract/protected')
      .set('Authorization', `Bearer ${await tokenFor(UserRole.ADMIN)}`)
      .expect(200, { userId: 'user-a', tenantId: 'tenant-a' });

    expect(ensureActive).toHaveBeenCalledWith('tenant-a');
    expect(protectedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-a',
        tenantId: 'tenant-a',
        rol: UserRole.ADMIN,
      }),
    );
    expect(pipelineTrace).toEqual([
      'deny-by-default',
      'jwt',
      'active-tenant',
      'rbac',
    ]);
  });

  function tokenFor(role: UserRole) {
    return jwtService.signAsync(
      {
        sub: 'user-a',
        tenantId: 'tenant-a',
        rol: role,
        email: 'admin@example.com',
      },
      { secret, expiresIn: '15m' },
    );
  }
});

function expectSecurityHeaders(headers: Record<string, unknown>) {
  expect(headers['strict-transport-security']).toBe(
    'max-age=31536000; includeSubDomains',
  );
  expect(headers['x-frame-options']).toBe('SAMEORIGIN');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['x-powered-by']).toBeUndefined();
}
