import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { CurrentUserPayload } from '../decorators/current-user.decorator';
import { TenantsService } from '../../tenants/tenants.service';
import { ActiveTenantGuard } from './active-tenant.guard';

describe('ActiveTenantGuard tenant isolation contracts', () => {
  const ensureActive = jest.fn();
  const guard = new ActiveTenantGuard({
    ensureActive,
  } as unknown as TenantsService);

  beforeEach(() => {
    ensureActive
      .mockReset()
      .mockResolvedValue({ id: 'tenant-a', activo: true });
  });

  it('rejects a request without an active tenant context before consulting tenant state', async () => {
    await expect(guard.canActivate(contextFor())).resolves.toBe(false);

    expect(ensureActive).not.toHaveBeenCalled();
  });

  it('rejects an authenticated context with an empty tenant before consulting tenant state', async () => {
    await expect(
      guard.canActivate(contextFor({ user: userFor('') })),
    ).resolves.toBe(false);

    expect(ensureActive).not.toHaveBeenCalled();
  });

  it('rejects a user context without a tenant claim before consulting tenant state', async () => {
    const incompleteUser = {
      userId: 'user-a',
      rol: 'ADMIN',
      email: 'admin@example.com',
    } as CurrentUserPayload;

    await expect(
      guard.canActivate(contextFor({ user: incompleteUser })),
    ).resolves.toBe(false);

    expect(ensureActive).not.toHaveBeenCalled();
  });
  it('validates exactly the tenant from the authenticated request context', async () => {
    const request = {
      headers: { 'x-tenant-id': 'tenant-b' },
      user: userFor('tenant-a'),
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(ensureActive).toHaveBeenCalledTimes(1);
    expect(ensureActive).toHaveBeenCalledWith('tenant-a');
  });

  it('propagates an inactive-tenant rejection before a protected handler can run', async () => {
    const inactiveTenantError = new BadRequestException('Tenant inactive');
    ensureActive.mockRejectedValue(inactiveTenantError);

    await expect(
      guard.canActivate(contextFor({ user: userFor('tenant-a') })),
    ).rejects.toBe(inactiveTenantError);
  });
});

function userFor(tenantId: string): CurrentUserPayload {
  return {
    userId: 'user-a',
    tenantId,
    rol: 'ADMIN',
    email: 'admin@example.com',
  };
}

function contextFor(
  request: {
    headers?: Record<string, string>;
    user?: CurrentUserPayload;
  } = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => undefined,
      getNext: () => undefined,
    }),
  } as ExecutionContext;
}
