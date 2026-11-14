import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';
import { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { ActiveTenantGuard } from '../../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AccountingProvisioningController } from './accounting-provisioning.controller';
import { AccountingProvisioningService } from './accounting-provisioning.service';

const user: CurrentUserPayload = {
  userId: 'user-a',
  tenantId: 'tenant-a',
  rol: 'ADMIN',
  email: 'admin@example.com',
};

describe('AccountingProvisioningController tenant authorization', () => {
  const provision = jest.fn();
  const service = {
    clonarPlanDeCuentas: provision,
  } as unknown as AccountingProvisioningService;
  const controller = new AccountingProvisioningController(service);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a path tenant that differs from the authenticated tenant', () => {
    expect(() => controller.provisionar(user, 'tenant-b')).toThrow(
      ForbiddenException,
    );
    expect(provision).not.toHaveBeenCalled();
  });

  it('provisions only the authenticated tenant and attributes the actor', () => {
    const result = Promise.resolve({
      status: 'provisioned' as const,
      cuentas: 32,
      mapeos: 29,
    });
    provision.mockReturnValueOnce(result);

    expect(controller.provisionar(user, 'tenant-a')).toBe(result);
    expect(provision).toHaveBeenCalledWith('tenant-a', 'user-a');
  });

  it('requires authentication, an active tenant, and role authorization', () => {
    const provisionHandler = Object.getOwnPropertyDescriptor(
      AccountingProvisioningController.prototype,
      'provisionar',
    )?.value as object;
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AccountingProvisioningController),
    ).toEqual([JwtAuthGuard, ActiveTenantGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, provisionHandler)).toEqual([
      UserRole.ADMIN,
    ]);
  });
});
