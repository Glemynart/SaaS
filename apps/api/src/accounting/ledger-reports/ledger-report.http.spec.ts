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
import { LedgerReportController } from './ledger-report.controller';
import { LedgerReportService } from './ledger-report.service';

describe('LedgerReportController HTTP', () => {
  const reports = {
    libroDiario: jest.fn(),
    libroMayor: jest.fn(),
    balancePrueba: jest.fn(),
    auxiliarTercero: jest.fn(),
    auxiliarCentroCosto: jest.fn(),
  };
  const ensureActive = jest.fn();
  const secret = 'acc-05-http-secret';
  const originalSecret = process.env.JWT_SECRET;
  let app: INestApplication;
  let server: Server;
  let jwt: JwtService;

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    const module = await Test.createTestingModule({
      controllers: [LedgerReportController],
      providers: [
        JwtService,
        JwtAuthGuard,
        ActiveTenantGuard,
        RolesGuard,
        { provide: LedgerReportService, useValue: reports },
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

  it('expone Libro Diario con filtros, paginación y tenant autenticado', async () => {
    reports.libroDiario.mockResolvedValue({ items: [], total: 0 });
    const token = await tokenFor('tenant-a');

    await request(server)
      .get(
        '/accounting/reportes/libro-diario?fechaInicio=2026-01-01T00:00:00.000Z&fechaFin=2026-01-31T00:00:00.000Z&tipoComprobanteId=tipo-cc&incluirBorradores=false&page=2&limit=25',
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200, { items: [], total: 0 });

    expect(reports.libroDiario).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({
        tipoComprobanteId: 'tipo-cc',
        incluirBorradores: false,
        page: 2,
        limit: 25,
      }),
    );
  });

  it('expone Libro Mayor, Balance y ambos auxiliares sin cambiar sus consultas', async () => {
    reports.libroMayor.mockResolvedValue({ items: [], total: 0 });
    reports.balancePrueba.mockResolvedValue([]);
    reports.auxiliarTercero.mockResolvedValue({ items: [], total: 0 });
    reports.auxiliarCentroCosto.mockResolvedValue({ items: [], total: 0 });
    const token = await tokenFor('tenant-a');

    await request(server)
      .get('/accounting/reportes/libro-mayor?cuentaId=cuenta-a&page=2&limit=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(server)
      .get(
        '/accounting/reportes/balance-prueba?cuentaDesde=1&cuentaHasta=3&nivel=2',
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(server)
      .get(
        '/accounting/reportes/auxiliares/tercero?cuentaId=cuenta-a&terceroId=tercero-a',
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(server)
      .get(
        '/accounting/reportes/auxiliares/centro-costo?cuentaId=cuenta-a&centroCostoId=centro-a',
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(reports.libroMayor).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({ cuentaId: 'cuenta-a', page: 2, limit: 10 }),
    );
    expect(reports.balancePrueba).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({ cuentaDesde: '1', cuentaHasta: '3', nivel: 2 }),
    );
    expect(reports.auxiliarTercero).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({ cuentaId: 'cuenta-a', terceroId: 'tercero-a' }),
    );
    expect(reports.auxiliarCentroCosto).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({
        cuentaId: 'cuenta-a',
        centroCostoId: 'centro-a',
      }),
    );
  });

  it('rechaza un tenant inyectado en el query y nunca ejecuta la consulta', async () => {
    const token = await tokenFor('tenant-a');

    await request(server)
      .get('/accounting/reportes/balance-prueba?tenantId=tenant-b')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(reports.balancePrueba).not.toHaveBeenCalled();
  });

  function tokenFor(tenantId: string) {
    return jwt.signAsync(
      {
        sub: 'user-a',
        tenantId,
        rol: UserRole.OPERADOR,
        email: 'operator@example.com',
      },
      { secret, expiresIn: '15m' },
    );
  }
});
