import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { TenantBrandingController } from './tenant-branding.controller';

describe('TenantBrandingController authorization metadata', () => {
  it('reserva la lectura y edición del perfil PILA a ADMIN', () => {
    for (const handler of [
      'getPilaEmployerProfile',
      'updatePilaEmployerProfile',
    ] as const) {
      expect(
        Reflect.getMetadata(
          ROLES_KEY,
          TenantBrandingController.prototype[handler],
        ),
      ).toEqual([UserRole.ADMIN]);
    }
  });
});
