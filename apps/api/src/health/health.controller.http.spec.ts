import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DenyByDefaultGuard } from '../auth/authorization/deny-by-default.guard';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('Health HTTP endpoints', () => {
  let app: INestApplication;
  const getLiveness = jest.fn();
  const getReadiness = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: { getLiveness, getReadiness },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalGuards(new DenyByDefaultGuard());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    getLiveness.mockReset().mockReturnValue({ status: 'ok', service: 'api' });
    getReadiness.mockReset().mockResolvedValue({
      status: 'ready',
      checks: {
        database: { status: 'up' },
        storage: { status: 'up' },
        email: { status: 'up', required: true },
      },
    });
  });

  it('serves public liveness without authentication', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', service: 'api' });
  });

  it('returns 200 when readiness checks pass', async () => {
    await request(app.getHttpServer())
      .get('/readiness')
      .expect(200)
      .expect((response) => {
        const body = response.body as { status?: unknown };
        expect(body.status).toBe('ready');
      });
  });

  it('returns 503 when readiness checks fail', async () => {
    getReadiness.mockResolvedValueOnce({
      status: 'not_ready',
      checks: {
        database: { status: 'down' },
        storage: { status: 'up' },
        email: { status: 'degraded', required: true },
      },
    });

    await request(app.getHttpServer())
      .get('/readiness')
      .expect(503)
      .expect((response) => {
        const body = response.body as { status?: unknown };
        expect(body.status).toBe('not_ready');
      });
  });
});
