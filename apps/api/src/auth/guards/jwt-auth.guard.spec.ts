import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

interface TestRequest {
  headers: { authorization?: string };
  user?: unknown;
}

describe('JwtAuthGuard authentication security contracts', () => {
  const jwtService = new JwtService();
  const guard = new JwtAuthGuard(jwtService);
  const originalJwtSecret = process.env.JWT_SECRET;
  const secret = 'sts-01-contract-secret';

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it('never creates an authenticated context when the token is absent', async () => {
    const request: TestRequest = { headers: {} };

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.user).toBeUndefined();
  });

  it.each(['Basic credentials', 'bearer token', 'Token value', 'Bearer'])(
    'rejects the invalid Authorization scheme %p',
    async (authorization) => {
      const request: TestRequest = { headers: { authorization } };

      await expect(
        guard.canActivate(contextFor(request)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(request.user).toBeUndefined();
    },
  );

  it('rejects a malformed JWT without creating an authenticated context', async () => {
    const request = requestWithToken('not-a-jwt');

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.user).toBeUndefined();
  });

  it('rejects a JWT signed with a different secret', async () => {
    const token = await jwtService.signAsync(validPayload(), {
      secret: 'different-secret',
    });
    const request = requestWithToken(token);

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.user).toBeUndefined();
  });

  it('rejects an expired JWT', async () => {
    const token = await jwtService.signAsync(validPayload(), {
      secret,
      expiresIn: -1,
    });
    const request = requestWithToken(token);

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.user).toBeUndefined();
  });

  it('fails safely when JWT configuration is absent', async () => {
    delete process.env.JWT_SECRET;
    const token = await jwtService.signAsync(validPayload(), { secret });
    const request = requestWithToken(token);

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.user).toBeUndefined();
  });

  it('creates the trusted authenticated context only from a valid JWT', async () => {
    const token = await jwtService.signAsync(
      { ...validPayload(), untrusted: 'not-copied' },
      { secret, expiresIn: '15m' },
    );
    const request = requestWithToken(token);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      userId: 'user-1',
      tenantId: 'tenant-1',
      rol: 'ADMIN',
      email: 'admin@example.com',
    });
    expect(request.user).not.toHaveProperty('untrusted');
  });
});

function validPayload() {
  return {
    sub: 'user-1',
    tenantId: 'tenant-1',
    rol: 'ADMIN',
    email: 'admin@example.com',
  };
}

function requestWithToken(token: string): TestRequest {
  return { headers: { authorization: `Bearer ${token}` } };
}

function contextFor(request: TestRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => undefined,
      getNext: () => undefined,
    }),
  } as ExecutionContext;
}
