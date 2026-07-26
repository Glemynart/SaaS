import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Injectable,
  Module,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import type { Server } from 'http';
import request from 'supertest';
import { CurrentUserPayload } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { DenyByDefaultGuard } from './deny-by-default.guard';

const missingPolicyHandler = jest.fn(() => ({ executed: true }));
const restrictedHandler = jest.fn(() => ({ executed: true }));

interface RequestWithUser extends Request {
  user?: CurrentUserPayload;
}

@Injectable()
class TestAuthenticationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const httpRequest = context.switchToHttp().getRequest<RequestWithUser>();
    const role = httpRequest.headers['x-test-role'];
    httpRequest.user = {
      userId: 'user-1',
      tenantId: 'tenant-1',
      rol: typeof role === 'string' ? role : '',
      email: 'user@example.com',
    };
    return true;
  }
}

@Controller('authorization-contract')
class AuthorizationContractController {
  @Get('missing-policy')
  missingPolicy() {
    return missingPolicyHandler();
  }

  @Roles(UserRole.ADMIN)
  @UseGuards(TestAuthenticationGuard, RolesGuard)
  @Get('restricted')
  restricted() {
    return restrictedHandler();
  }
}

@Module({
  controllers: [AuthorizationContractController],
  providers: [TestAuthenticationGuard, RolesGuard],
})
class AuthorizationContractModule {}

describe('Authorization and RBAC enforcement composition', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthorizationContractModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalGuards(new DenyByDefaultGuard());
    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('never executes the handler when Deny by Default rejects the operation', async () => {
    await request(server)
      .get('/authorization-contract/missing-policy')
      .expect(403);

    expect(missingPolicyHandler).not.toHaveBeenCalled();
  });

  it('never executes the handler when RBAC rejects an insufficient role', async () => {
    await request(server)
      .get('/authorization-contract/restricted')
      .set('x-test-role', UserRole.VIEWER)
      .expect(403);

    expect(restrictedHandler).not.toHaveBeenCalled();
  });

  it('executes the handler only for a role declared by the operation', async () => {
    await request(server)
      .get('/authorization-contract/restricted')
      .set('x-test-role', UserRole.ADMIN)
      .expect(200, { executed: true });

    expect(restrictedHandler).toHaveBeenCalledTimes(1);
  });
});
