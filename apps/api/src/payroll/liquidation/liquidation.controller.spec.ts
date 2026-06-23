import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { LiquidationController } from './liquidation.controller';
import { LiquidationService } from './liquidation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ActiveTenantGuard } from '../../auth/guards/active-tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';

// Guards de auth/tenant se prueban en sus propios specs; aquí se neutralizan
// para aislar la lógica de delegación del controller.
const allowGuard = { canActivate: () => true };

// ── Mock del service ────────────────────────────────────────────────────────────

const mockService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  createLiquidacion: jest.fn(),
  approveLiquidation: jest.fn(),
  markLiquidationPaid: jest.fn(),
  voidLiquidation: jest.fn(),
};

const USER: CurrentUserPayload = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  rol: 'ADMIN',
  email: 'admin@test.co',
};

describe('LiquidationController (N2D.6)', () => {
  let controller: LiquidationController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [LiquidationController],
      providers: [{ provide: LiquidationService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowGuard)
      .overrideGuard(ActiveTenantGuard)
      .useValue(allowGuard)
      .overrideGuard(RolesGuard)
      .useValue(allowGuard)
      .compile();

    controller = module.get(LiquidationController);
  });

  it('GET /liquidations → delega con tenantId del usuario y query', () => {
    const query = { page: 1, limit: 10 };
    controller.findAll(USER, query);

    expect(mockService.findAll).toHaveBeenCalledWith('tenant-1', query);
  });

  it('GET /liquidations/:id → delega con tenantId del usuario', () => {
    controller.findOne(USER, 'liq-001');

    expect(mockService.findOne).toHaveBeenCalledWith('tenant-1', 'liq-001');
  });

  it('POST /liquidations/:empleadoId → delega create con tenant + user + empleadoId', () => {
    controller.create(USER, 'emp-001');

    expect(mockService.createLiquidacion).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'emp-001',
    );
  });

  it('POST /liquidations/:id/approve → delega approve', () => {
    controller.approve(USER, 'liq-001');

    expect(mockService.approveLiquidation).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'liq-001',
    );
  });

  it('POST /liquidations/:id/pay → delega markLiquidationPaid', () => {
    controller.pay(USER, 'liq-001');

    expect(mockService.markLiquidationPaid).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'liq-001',
    );
  });

  it('POST /liquidations/:id/void → delega voidLiquidation', () => {
    controller.void(USER, 'liq-001');

    expect(mockService.voidLiquidation).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'liq-001',
    );
  });

  it('tenant isolation: el tenantId proviene del usuario, no de los params', () => {
    const attacker: CurrentUserPayload = {
      ...USER,
      tenantId: 'tenant-victima',
    };
    controller.findOne(attacker, 'liq-de-otro-tenant');

    // El service recibe SIEMPRE el tenant del token, nunca un valor del path.
    expect(mockService.findOne).toHaveBeenCalledWith(
      'tenant-victima',
      'liq-de-otro-tenant',
    );
  });
});

// ── Role enforcement via metadata (N2D.6) ──────────────────────────────────────

describe('LiquidationController — role enforcement (N2D.6)', () => {
  it('pay requiere solo ADMIN', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      LiquidationController.prototype.pay,
    );
    expect(roles).toEqual([UserRole.ADMIN]);
  });

  it('void requiere solo ADMIN', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      LiquidationController.prototype.void,
    );
    expect(roles).toEqual([UserRole.ADMIN]);
  });

  it('approve permite ADMIN y OPERADOR', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      LiquidationController.prototype.approve,
    );
    expect(roles).toEqual([UserRole.ADMIN, UserRole.OPERADOR]);
  });

  it('create permite ADMIN y OPERADOR', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      LiquidationController.prototype.create,
    );
    expect(roles).toEqual([UserRole.ADMIN, UserRole.OPERADOR]);
  });

  it('findAll no tiene restricción de rol', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      LiquidationController.prototype.findAll,
    );
    expect(roles).toBeUndefined();
  });

  it('findOne no tiene restricción de rol', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      LiquidationController.prototype.findOne,
    );
    expect(roles).toBeUndefined();
  });
});
