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
import type { Server } from 'http';
import request from 'supertest';
import { CurrentUser } from './decorators/current-user.decorator';
import type { CurrentUserPayload } from './decorators/current-user.decorator';
import { ActiveTenantGuard } from './guards/active-tenant.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TenantsService } from '../tenants/tenants.service';

const protectedHandler = jest.fn((user: CurrentUserPayload) => ({
  tenantId: user.tenantId,
}));
const ensureActive = jest.fn();

@Controller('tenant-isolation-contract')
@UseGuards(JwtAuthGuard, ActiveTenantGuard)
class TenantIsolationContractController {
  @Get('context')
  context(@CurrentUser() user: CurrentUserPayload) {
    return protectedHandler(user);
  }
}

@Module({
  controllers: [TenantIsolationContractController],
  providers: [
    JwtAuthGuard,
    ActiveTenantGuard,
    JwtService,
    { provide: TenantsService, useValue: { ensureActive } },
  ],
})
class TenantIsolationContractModule {}

describe('Tenant isolation request contracts', () => {
  let app: INestApplication;
  let server: Server;
  let jwtService: JwtService;
  const originalJwtSecret = process.env.JWT_SECRET;
  const secret = 'sts-03-contract-secret';

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    const moduleRef = await Test.createTestingModule({
      imports: [TenantIsolationContractModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
    jwtService = moduleRef.get(JwtService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ensureActive.mockResolvedValue({ id: 'tenant-a', activo: true });
  });

  afterAll(async () => {
    await app.close();
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it('never executes a tenant-protected handler when the authenticated context has no tenant', async () => {
    const token = await tokenFor({
      sub: 'user-a',
      rol: 'ADMIN',
      email: 'admin@example.com',
    });

    await request(server)
      .get('/tenant-isolation-contract/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(ensureActive).not.toHaveBeenCalled();
    expect(protectedHandler).not.toHaveBeenCalled();
  });

  it('uses only the tenant authenticated by the JWT, ignoring a conflicting tenant change attempt', async () => {
    const token = await tokenFor({
      sub: 'user-a',
      tenantId: 'tenant-a',
      rol: 'ADMIN',
      email: 'admin@example.com',
    });

    await request(server)
      .get('/tenant-isolation-contract/context')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', 'tenant-b')
      .expect(200, { tenantId: 'tenant-a' });

    expect(ensureActive).toHaveBeenCalledWith('tenant-a');
    expect(protectedHandler).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a' }),
    );
  });

  it('rejects an inactive authenticated tenant before executing protected logic', async () => {
    ensureActive.mockRejectedValue(new BadRequestException('Tenant inactive'));
    const token = await tokenFor({
      sub: 'user-b',
      tenantId: 'tenant-b',
      rol: 'ADMIN',
      email: 'admin@example.com',
    });

    await request(server)
      .get('/tenant-isolation-contract/context')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(ensureActive).toHaveBeenCalledWith('tenant-b');
    expect(protectedHandler).not.toHaveBeenCalled();
  });

  function tokenFor(payload: Record<string, string>) {
    return jwtService.signAsync(payload, { secret, expiresIn: '15m' });
  }
});
