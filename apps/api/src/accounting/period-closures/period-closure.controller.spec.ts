import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { ActiveTenantGuard } from '../../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PeriodClosureController } from './period-closure.controller';
import { PeriodClosureService } from './period-closure.service';

const allowGuard = { canActivate: () => true };
const closures = {
  validar: jest.fn(),
  cerrar: jest.fn(),
  reabrir: jest.fn(),
  cerrarAnio: jest.fn(),
};
const user: CurrentUserPayload = {
  userId: 'user-a',
  tenantId: 'tenant-a',
  rol: 'ADMIN',
  email: 'admin@example.com',
};

describe('PeriodClosureController', () => {
  let controller: PeriodClosureController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [PeriodClosureController],
      providers: [{ provide: PeriodClosureService, useValue: closures }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowGuard)
      .overrideGuard(ActiveTenantGuard)
      .useValue(allowGuard)
      .overrideGuard(RolesGuard)
      .useValue(allowGuard)
      .compile();
    controller = module.get(PeriodClosureController);
  });

  it('deriva tenant y actor autenticados para todas las operaciones', () => {
    controller.validar(user, 'periodo-a');
    controller.cerrar(user, 'periodo-a');
    controller.reabrir(user, 'periodo-a', { motivo: 'Corrección' });
    controller.cerrarAnio(user, 2026);

    expect(closures.validar).toHaveBeenCalledWith('tenant-a', 'periodo-a');
    expect(closures.cerrar).toHaveBeenCalledWith(
      'tenant-a',
      'user-a',
      'periodo-a',
    );
    expect(closures.reabrir).toHaveBeenCalledWith(
      'tenant-a',
      'user-a',
      'periodo-a',
      'Corrección',
    );
    expect(closures.cerrarAnio).toHaveBeenCalledWith(
      'tenant-a',
      'user-a',
      2026,
    );
  });

  it('restringe todas las operaciones de cierre al rol ADMIN', () => {
    for (const handler of [
      'validar',
      'cerrar',
      'reabrir',
      'cerrarAnio',
    ] as const) {
      expect(
        Reflect.getMetadata(
          ROLES_KEY,
          PeriodClosureController.prototype[handler],
        ),
      ).toEqual([UserRole.ADMIN]);
    }
  });
});
