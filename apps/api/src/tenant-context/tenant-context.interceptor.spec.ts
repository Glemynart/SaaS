import { ExecutionContext } from '@nestjs/common';
import { CallHandler } from '@nestjs/common/interfaces/features/nest-interceptor.interface';
import { lastValueFrom, of } from 'rxjs';
import { TenantContextBoundary } from './tenant-context.boundary';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantContextService } from './tenant-context.service';

type RequestUser = {
  userId: string;
  tenantId: string;
  rol: string;
  email: string;
};

describe('TenantContextInterceptor', () => {
  const user: RequestUser = {
    userId: 'user-a',
    tenantId: 'tenant-a',
    rol: 'ADMIN',
    email: 'admin@example.com',
  };

  it('propagates the validated request user as tenant context', async () => {
    const service = new TenantContextService();
    const interceptor = new TenantContextInterceptor(
      service,
      new TenantContextBoundary(service),
    );

    const result = await lastValueFrom(
      interceptor.intercept(
        contextFor({ user }),
        handlerFor(() => service.get()),
      ),
    );

    expect(result).toEqual(user);
    expect(service.get()).toBeUndefined();
  });

  it('does not create a tenant context for a request without a user', async () => {
    const service = new TenantContextService();
    const interceptor = new TenantContextInterceptor(
      service,
      new TenantContextBoundary(service),
    );

    const result = await lastValueFrom(
      interceptor.intercept(
        contextFor({}),
        handlerFor(() => service.get()),
      ),
    );

    expect(result).toBeUndefined();
  });

  it('fails closed before the handler when the request tenant is invalid', async () => {
    const service = new TenantContextService();
    const interceptor = new TenantContextInterceptor(
      service,
      new TenantContextBoundary(service),
    );
    const handler = jest.fn(() => 'executed');

    await expect(
      lastValueFrom(
        interceptor.intercept(
          contextFor({ user: { ...user, tenantId: ' ' } }),
          handlerFor(handler),
        ),
      ),
    ).rejects.toThrow('Se requiere un contexto de tenant válido.');

    expect(handler).not.toHaveBeenCalled();
  });
});

function contextFor(request: { user?: RequestUser }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => undefined,
      getNext: () => undefined,
    }),
  } as ExecutionContext;
}

function handlerFor<T>(callback: () => T): CallHandler<T> {
  return { handle: () => of(callback()) };
}
