import { TenantContextService } from './tenant-context.service';

describe('TenantContextService', () => {
  const context = {
    tenantId: 'tenant-a',
    userId: 'user-a',
    rol: 'ADMIN',
    email: 'admin@example.com',
  };

  it('makes an immutable context available only inside its execution scope', () => {
    const service = new TenantContextService();

    expect(service.get()).toBeUndefined();

    service.run(context, () => {
      expect(service.get()).toEqual(context);
      expect(Object.isFrozen(service.get())).toBe(true);
    });

    expect(service.get()).toBeUndefined();
  });

  it('propagates the context through asynchronous work in the same scope', async () => {
    const service = new TenantContextService();

    await service.run(context, async () => {
      await Promise.resolve();
      expect(service.get()).toEqual(context);
    });
  });
});
