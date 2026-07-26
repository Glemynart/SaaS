import { ForbiddenException } from '@nestjs/common';
import { TenantContextBoundary } from './tenant-context.boundary';
import { TenantContextService } from './tenant-context.service';

describe('TenantContextBoundary', () => {
  const context = {
    tenantId: 'tenant-a',
    userId: 'user-a',
    rol: 'ADMIN',
    email: 'admin@example.com',
  };

  it('fails closed when no tenant context exists', () => {
    const boundary = new TenantContextBoundary(new TenantContextService());

    expect(() => boundary.require()).toThrow(ForbiddenException);
  });

  it('returns the current context when it has one tenant', () => {
    const service = new TenantContextService();
    const boundary = new TenantContextBoundary(service);

    service.run(context, () => {
      expect(boundary.require()).toEqual(context);
    });
  });

  it('fails closed when the tenant value is not a single non-empty string', () => {
    const service = new TenantContextService();
    const boundary = new TenantContextBoundary(service);
    const invalidContext = { ...context, tenantId: ['tenant-a', 'tenant-b'] };

    service.run(invalidContext as never, () => {
      expect(() => boundary.require()).toThrow(ForbiddenException);
    });
  });
});
