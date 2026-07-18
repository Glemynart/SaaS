import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { ActiveTenantGuard } from '../../auth/guards/active-tenant.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantsService } from '../../tenants/tenants.service';
import { ManualJournalController } from './manual-journal.controller';
import { ManualJournalService } from './manual-journal.service';

describe('ManualJournalController HTTP', () => {
  const manualJournals = { registrar: jest.fn(), anular: jest.fn() };
  const ensureActive = jest.fn();
  const secret = 'acc-03-http-secret';
  const originalSecret = process.env.JWT_SECRET;
  let app: INestApplication;
  let server: Server;
  let jwt: JwtService;

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    const module = await Test.createTestingModule({
      controllers: [ManualJournalController],
      providers: [
        JwtService,
        JwtAuthGuard,
        ActiveTenantGuard,
        RolesGuard,
        { provide: ManualJournalService, useValue: manualJournals },
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

  it('registra con el tenant autenticado y rechaza un tenant enviado en el body', async () => {
    manualJournals.registrar.mockResolvedValue({ id: 'comp-001' });
    const token = await tokenFor('tenant-a', UserRole.ADMIN);

    await request(server)
      .post('/accounting/comprobantes')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validJournal(), tenantId: 'tenant-b' })
      .expect(400);

    expect(manualJournals.registrar).not.toHaveBeenCalled();

    await request(server)
      .post('/accounting/comprobantes')
      .set('Authorization', `Bearer ${token}`)
      .send(validJournal())
      .expect(201, { id: 'comp-001' });

    expect(manualJournals.registrar).toHaveBeenCalledWith(
      'tenant-a',
      'user-a',
      expect.objectContaining(validJournal()),
    );
  });

  it('rechaza operaciones manuales de roles no autorizados', async () => {
    const token = await tokenFor('tenant-a', UserRole.OPERADOR);

    await request(server)
      .post('/accounting/comprobantes')
      .set('Authorization', `Bearer ${token}`)
      .send(validJournal())
      .expect(403);

    expect(manualJournals.registrar).not.toHaveBeenCalled();
  });

  function validJournal() {
    return {
      tipoComprobanteId: 'tipo-cc',
      periodoId: 'periodo-a',
      fecha: '2026-06-30T00:00:00.000Z',
      concepto: 'Ajuste manual',
      lineas: [
        { cuentaId: 'cuenta-debito', debito: 100, credito: 0 },
        { cuentaId: 'cuenta-credito', debito: 0, credito: 100 },
      ],
    };
  }

  function tokenFor(tenantId: string, rol: UserRole) {
    return jwt.signAsync(
      { sub: 'user-a', tenantId, rol, email: 'admin@example.com' },
      { secret, expiresIn: '15m' },
    );
  }
});
