import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { EmailService } from './email.service';

describe('EmailService readiness', () => {
  it('reports real mode only when Resend and EMAIL_FROM are configured', () => {
    const service = createService({
      'email.apiKey': 're_test_key',
      'email.from': 'staging@example.com',
      'email.fromName': 'Staging',
    });

    service.onModuleInit();

    expect(service.getReadiness()).toEqual({ status: 'up' });
  });

  it.each([
    ['missing api key', { 'email.from': 'staging@example.com' }],
    ['missing sender', { 'email.apiKey': 're_test_key' }],
  ])('reports degraded mode when %s', (_reason, values) => {
    const service = createService(values);

    service.onModuleInit();

    expect(service.getReadiness()).toEqual({ status: 'degraded' });
  });
});

function createService(values: Record<string, string>): EmailService {
  const config = {
    get: jest.fn((key: string) => values[key]),
  };
  const audit = { log: jest.fn() };
  return new EmailService(
    config as unknown as ConfigService,
    audit as unknown as AuditService,
  );
}
