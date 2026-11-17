import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { EmployeeDisbursementReconciliationController } from './employee-disbursement-reconciliation.controller';
import { EmployeeDisbursementReconciliationService } from './employee-disbursement-reconciliation.service';

describe('EmployeeDisbursementReconciliationController', () => {
  const service = { reconcile: jest.fn() };
  const controller = new EmployeeDisbursementReconciliationController(
    service as unknown as EmployeeDisbursementReconciliationService,
  );
  const user: CurrentUserPayload = {
    userId: 'admin-a',
    tenantId: 'tenant-a',
    rol: UserRole.ADMIN,
    email: 'admin@example.test',
  };

  it('permite el diagnóstico solo a ADMIN y deriva tenant y actor de la sesión', async () => {
    const reflector = new Reflector();
    const handler = Object.getOwnPropertyDescriptor(
      EmployeeDisbursementReconciliationController.prototype,
      'reconcileSupports',
    )?.value as unknown as (...args: never[]) => unknown;
    expect(reflector.get<UserRole[]>(ROLES_KEY, handler)).toEqual([
      UserRole.ADMIN,
    ]);

    await controller.reconcileSupports(user);

    expect(service.reconcile).toHaveBeenCalledWith('tenant-a', 'admin-a');
  });
});
