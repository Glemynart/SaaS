import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const queryRaw = jest.fn();
  const checkReadiness = jest.fn();
  const getEmailReadiness = jest.fn();
  const getConfig = jest.fn();
  let service: HealthService;

  beforeEach(() => {
    queryRaw.mockReset().mockResolvedValue([{ '?column?': 1 }]);
    checkReadiness.mockReset().mockResolvedValue(undefined);
    getEmailReadiness.mockReset().mockReturnValue({ status: 'up' });
    getConfig.mockReset().mockReturnValue(false);
    service = new HealthService(
      { $queryRaw: queryRaw } as unknown as PrismaService,
      { checkReadiness } as unknown as StorageService,
      { getReadiness: getEmailReadiness } as unknown as EmailService,
      { get: getConfig } as unknown as ConfigService,
    );
  });

  it('returns a dependency-free liveness response', () => {
    expect(service.getLiveness()).toEqual({ status: 'ok', service: 'api' });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('reports ready when required dependencies are available', async () => {
    await expect(service.getReadiness()).resolves.toEqual({
      status: 'ready',
      checks: {
        database: { status: 'up' },
        storage: { status: 'up' },
        email: { status: 'up', required: false },
      },
    });
  });

  it('reports not_ready when the database is unavailable', async () => {
    queryRaw.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(service.getReadiness()).resolves.toMatchObject({
      status: 'not_ready',
      checks: { database: { status: 'down' } },
    });
  });

  it('reports not_ready when required real email is degraded', async () => {
    getConfig.mockReturnValue(true);
    getEmailReadiness.mockReturnValue({ status: 'degraded' });

    await expect(service.getReadiness()).resolves.toMatchObject({
      status: 'not_ready',
      checks: { email: { status: 'degraded', required: true } },
    });
  });

  it('keeps readiness available in local mode when email is optional', async () => {
    getEmailReadiness.mockReturnValue({ status: 'degraded' });

    await expect(service.getReadiness()).resolves.toMatchObject({
      status: 'ready',
      checks: { email: { status: 'degraded', required: false } },
    });
  });
});
