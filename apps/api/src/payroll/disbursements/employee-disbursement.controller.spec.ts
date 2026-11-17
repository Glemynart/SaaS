import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { EmployeeDisbursementController } from './employee-disbursement.controller';
import { EmployeeDisbursementService } from './employee-disbursement.service';

const user: CurrentUserPayload = {
  userId: 'user-a',
  tenantId: 'tenant-a',
  rol: UserRole.ADMIN,
  email: 'admin@example.test',
};

describe('EmployeeDisbursementController authorization and dispatch', () => {
  const service = {
    create: jest.fn(),
    getSummary: jest.fn(),
    attachSupport: jest.fn(),
    verify: jest.fn(),
    cancel: jest.fn(),
    reverse: jest.fn(),
    downloadSupport: jest.fn(),
  };
  const controller = new EmployeeDisbursementController(
    service as unknown as EmployeeDisbursementService,
  );
  const reflector = new Reflector();

  beforeEach(() => jest.clearAllMocks());

  it('deriva tenant y actor de la sesión autenticada al declarar', async () => {
    const dto = { sourceType: 'PAYROLL_RUN', sourceId: 'run-a' } as never;
    await controller.create(user, dto);

    expect(service.create).toHaveBeenCalledWith('tenant-a', 'user-a', dto);
  });

  it('permite declarar y adjuntar soporte a ADMIN y OPERADOR, pero verificar solo como ADMIN', () => {
    const roles = (name: keyof EmployeeDisbursementController) =>
      reflector.get<UserRole[]>(ROLES_KEY, controller[name]);

    expect(roles('create')).toEqual([UserRole.ADMIN, UserRole.OPERADOR]);
    expect(roles('attachSupport')).toEqual([UserRole.ADMIN, UserRole.OPERADOR]);
    expect(roles('verify')).toEqual([UserRole.ADMIN]);
    expect(roles('reverse')).toEqual([UserRole.ADMIN]);
  });

  it('rechaza un resumen sin tipo de obligación reconocido', () => {
    expect(() =>
      controller.getSummary(user, 'other' as never, 'source'),
    ).toThrow();
    expect(service.getSummary).not.toHaveBeenCalled();
  });
});
