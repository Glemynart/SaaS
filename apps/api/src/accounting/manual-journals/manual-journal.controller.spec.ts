import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { ActiveTenantGuard } from '../../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ManualJournalController } from './manual-journal.controller';
import { ManualJournalService } from './manual-journal.service';

const allowGuard = { canActivate: () => true };
const manualJournals = { registrar: jest.fn(), anular: jest.fn() };
const user: CurrentUserPayload = {
  userId: 'user-a',
  tenantId: 'tenant-a',
  rol: 'ADMIN',
  email: 'admin@example.com',
};

describe('ManualJournalController', () => {
  let controller: ManualJournalController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [ManualJournalController],
      providers: [{ provide: ManualJournalService, useValue: manualJournals }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowGuard)
      .overrideGuard(ActiveTenantGuard)
      .useValue(allowGuard)
      .overrideGuard(RolesGuard)
      .useValue(allowGuard)
      .compile();
    controller = module.get(ManualJournalController);
  });

  it('deriva tenant y actor exclusivamente del usuario autenticado al registrar', () => {
    const dto = {
      tipoComprobanteId: 'tipo-cc',
      periodoId: 'periodo-a',
      fecha: '2026-06-30T00:00:00.000Z',
      concepto: 'Ajuste manual',
      lineas: [
        { cuentaId: 'cuenta-debito', debito: 100, credito: 0 },
        { cuentaId: 'cuenta-credito', debito: 0, credito: 100 },
      ],
    };

    controller.registrar(user, dto);

    expect(manualJournals.registrar).toHaveBeenCalledWith(
      'tenant-a',
      'user-a',
      dto,
    );
  });

  it('deriva tenant y actor exclusivamente del usuario autenticado al anular', () => {
    controller.anular(user, 'comp-001', { motivo: 'Error de digitación' });

    expect(manualJournals.anular).toHaveBeenCalledWith(
      'tenant-a',
      'user-a',
      'comp-001',
      'Error de digitación',
    );
  });

  it('restringe registro y anulación manual al rol ADMIN', () => {
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        ManualJournalController.prototype.registrar,
      ),
    ).toEqual([UserRole.ADMIN]);
    expect(
      Reflect.getMetadata(ROLES_KEY, ManualJournalController.prototype.anular),
    ).toEqual([UserRole.ADMIN]);
  });
});
