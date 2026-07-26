import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import type { Server } from 'http';
import request from 'supertest';
import { ActiveTenantGuard } from '../../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantsService } from '../../tenants/tenants.service';
import { PeriodClosureController } from './period-closure.controller';
import { PeriodClosureService } from './period-closure.service';

describe('PeriodClosureController HTTP', () => {
  const closures = {
    validar: jest.fn(),
    cerrar: jest.fn(),
    reabrir: jest.fn(),
    cerrarAnio: jest.fn(),
  };
  const ensureActive = jest.fn();
  const secret = 'acc-04-http-secret';
  const originalSecret = process.env.JWT_SECRET;
  let app: INestApplication;
  let server: Server;
  let jwt: JwtService;

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    const module = await Test.createTestingModule({
      controllers: [PeriodClosureController],
      providers: [
        JwtService,
        JwtAuthGuard,
        ActiveTenantGuard,
        RolesGuard,
        { provide: PeriodClosureService, useValue: closures },
        { provide: TenantsService, useValue: { ensureActive } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
    jwt = module.get(JwtService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ensureActive.mockResolvedValue({ id: 'tenant-a', activo: true });
  });

  afterAll(async () => {
    await app.close();
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  it('expone validación y cierre permitido con el tenant autenticado', async () => {
    closures.validar.mockResolvedValue({ procede: true, bloqueos: [] });
    closures.cerrar.mockResolvedValue({
      cerrado: true,
      yaEstabaCerrado: false,
    });
    const token = await tokenFor('tenant-a', UserRole.ADMIN);

    await request(server)
      .get('/accounting/cierres/periodos/periodo-a/validar')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, { procede: true, bloqueos: [] });
    await request(server)
      .post('/accounting/cierres/periodos/periodo-a/cerrar')
      .set('Authorization', `Bearer ${token}`)
      .expect(201, { cerrado: true, yaEstabaCerrado: false });

    expect(closures.validar).toHaveBeenCalledWith('tenant-a', 'periodo-a');
    expect(closures.cerrar).toHaveBeenCalledWith(
      'tenant-a',
      'user-a',
      'periodo-a',
    );
  });

  it('preserva bloqueos LIFO y el motivo de reapertura sin reinterpretarlos', async () => {
    const resultado = {
      reabierto: false,
      yaEstabaAbierto: false,
      bloqueos: ['NO_ES_ULTIMO_PERIODO_CERRADO'],
    };
    closures.reabrir.mockResolvedValue(resultado);
    const token = await tokenFor('tenant-a', UserRole.ADMIN);

    await request(server)
      .post('/accounting/cierres/periodos/periodo-a/reabrir')
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: 'Corrección autorizada' })
      .expect(201, resultado);

    expect(closures.reabrir).toHaveBeenCalledWith(
      'tenant-a',
      'user-a',
      'periodo-a',
      'Corrección autorizada',
    );
  });

  it('expone el cierre anual con el actor autenticado y protege la ruta para ADMIN', async () => {
    closures.cerrarAnio.mockResolvedValue({
      posteado: true,
      yaEstabaPosteado: false,
      diciembreCerrado: true,
    });
    const admin = await tokenFor('tenant-a', UserRole.ADMIN);

    await request(server)
      .post('/accounting/cierres/anios/2026/cerrar')
      .set('Authorization', `Bearer ${admin}`)
      .expect(201);
    expect(closures.cerrarAnio).toHaveBeenCalledWith(
      'tenant-a',
      'user-a',
      2026,
    );

    const operador = await tokenFor('tenant-b', UserRole.OPERADOR);
    await request(server)
      .post('/accounting/cierres/periodos/periodo-b/cerrar')
      .set('Authorization', `Bearer ${operador}`)
      .expect(403);
    expect(closures.cerrar).toHaveBeenCalledTimes(0);
  });

  function tokenFor(tenantId: string, rol: UserRole) {
    return jwt.signAsync(
      { sub: 'user-a', tenantId, rol, email: 'admin@example.com' },
      { secret, expiresIn: '15m' },
    );
  }
});
