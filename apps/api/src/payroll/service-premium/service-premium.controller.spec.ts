import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { ServicePremiumController } from './service-premium.controller';

function rolesFor(method: 'list' | 'getOne' | 'listByYear' | 'approve') {
  const handler: unknown = Object.getOwnPropertyDescriptor(
    ServicePremiumController.prototype,
    method,
  )?.value;
  return typeof handler === 'function'
    ? (Reflect.getMetadata(ROLES_KEY, handler) as unknown)
    : undefined;
}

describe('ServicePremiumController authorization metadata', () => {
  it('restringe la lectura de liquidaciones y bases salariales a Payroll', () => {
    expect(rolesFor('list')).toEqual([UserRole.ADMIN, UserRole.OPERADOR]);
    expect(rolesFor('getOne')).toEqual([UserRole.ADMIN, UserRole.OPERADOR]);
    expect(rolesFor('listByYear')).toEqual([UserRole.ADMIN, UserRole.OPERADOR]);
  });

  it('reserva aprobación a ADMIN', () => {
    expect(rolesFor('approve')).toEqual([UserRole.ADMIN]);
  });
});
