import { ExecutionContext, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractsModule } from './contracts.module';
import { LotesController } from '../lotes/lotes.controller';
import { LotesService } from '../lotes/lotes.service';
import { LotesModule } from '../lotes/lotes.module';
import { ActiveTenantGuard } from '../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

const user: CurrentUserPayload = {
  userId: 'user-id',
  tenantId: 'tenant-id',
  rol: 'ADMIN',
  email: 'admin@example.com',
};

const routeGuard = {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: CurrentUserPayload }>();
    request.user = user;
    return true;
  },
};

const contractsFindOne = jest.fn();
const lotesFindAll = jest.fn();

@Module({
  controllers: [LotesController],
  providers: [
    { provide: LotesService, useValue: { findAll: lotesFindAll } },
    { provide: JwtAuthGuard, useValue: routeGuard },
    { provide: ActiveTenantGuard, useValue: routeGuard },
    { provide: RolesGuard, useValue: routeGuard },
  ],
})
class LotesRoutesModule {}

@Module({
  controllers: [ContractsController],
  providers: [
    { provide: ContractsService, useValue: { findOne: contractsFindOne } },
    { provide: JwtAuthGuard, useValue: routeGuard },
    { provide: ActiveTenantGuard, useValue: routeGuard },
    { provide: RolesGuard, useValue: routeGuard },
  ],
})
class ContractsRoutesModule {}

@Module({ imports: [LotesRoutesModule, ContractsRoutesModule] })
class ContractsRoutesTestModule {}

describe('Contracts route ordering', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      imports: [ContractsRoutesTestModule],
    });

    moduleBuilder
      .overrideGuard(JwtAuthGuard)
      .useValue(routeGuard)
      .overrideGuard(ActiveTenantGuard)
      .useValue(routeGuard)
      .overrideGuard(RolesGuard)
      .useValue(routeGuard);

    const moduleRef = await moduleBuilder.compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    contractsFindOne.mockReset();
    lotesFindAll.mockReset().mockReturnValue({
      data: [],
      meta: { total: 0, page: 1, limit: 50, totalPages: 0 },
    });
  });

  it('registers LotesModule before ContractsModule', () => {
    const imports = Reflect.getMetadata('imports', AppModule) as unknown[];

    expect(imports.indexOf(LotesModule)).toBeLessThan(
      imports.indexOf(ContractsModule),
    );
  });

  it('routes GET /contracts/lotes to LotesController', async () => {
    await request(app.getHttpServer())
      .get('/contracts/lotes?limit=50')
      .expect(200)
      .expect({
        data: [],
        meta: { total: 0, page: 1, limit: 50, totalPages: 0 },
      });

    expect(lotesFindAll).toHaveBeenCalledWith(
      'tenant-id',
      expect.objectContaining({ limit: '50' }),
    );
    expect(contractsFindOne).not.toHaveBeenCalled();
  });
});
