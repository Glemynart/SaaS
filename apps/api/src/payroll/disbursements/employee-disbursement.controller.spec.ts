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
    listObligations: jest.fn(),
    listPendingVerification: jest.fn(),
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
    expect(roles('listObligations')).toEqual([
      UserRole.ADMIN,
      UserRole.OPERADOR,
    ]);
    expect(roles('listPendingVerification')).toEqual([
      UserRole.ADMIN,
      UserRole.OPERADOR,
    ]);
    expect(roles('verify')).toEqual([UserRole.ADMIN]);
    expect(roles('reverse')).toEqual([UserRole.ADMIN]);
  });

  it('deriva el tenant autenticado para listar obligaciones y la cola de verificación', async () => {
    const obligationsQuery = {
      sourceType: 'PAYROLL_RUN',
      page: 2,
      limit: 10,
    } as never;
    const pendingQuery = { page: 1, limit: 25 } as never;

    await controller.listObligations(user, obligationsQuery);
    await controller.listPendingVerification(user, pendingQuery);

    expect(service.listObligations).toHaveBeenCalledWith(
      'tenant-a',
      obligationsQuery,
    );
    expect(service.listPendingVerification).toHaveBeenCalledWith(
      'tenant-a',
      pendingQuery,
    );
  });

  it('rechaza un resumen sin tipo de obligación reconocido', () => {
    expect(() =>
      controller.getSummary(user, 'other' as never, 'source'),
    ).toThrow();
    expect(service.getSummary).not.toHaveBeenCalled();
  });
});
