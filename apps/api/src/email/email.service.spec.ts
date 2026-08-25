import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { AuditService } from '../audit/audit.service';
import { EmailService } from './email.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports degraded mode when SMTP configuration is absent', () => {
    const service = createService({});

    service.onModuleInit();

    expect(service.getReadiness()).toEqual({ status: 'degraded' });
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('initializes the SMTP transport when configured', () => {
    mockTransport(jest.fn());
    const service = createService(smtpConfig());

    service.onModuleInit();

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-password',
      },
    });
    expect(service.getReadiness()).toEqual({ status: 'up' });
  });

  it('sends through SMTP using EMAIL_FROM', async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    mockTransport(sendMail);
    const service = createService(smtpConfig());

    service.onModuleInit();
    await service.send(passwordResetParams());

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Staging <staging@example.com>',
        to: 'recipient@example.com',
        subject: expect.any(String),
        html: expect.any(String),
      }),
    );
  });

  it('audits SMTP failures without throwing or degrading readiness', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('SMTP unavailable'));
    mockTransport(sendMail);
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = createService(smtpConfig(), audit);

    service.onModuleInit();
    await expect(service.send(passwordResetParams())).resolves.toBeUndefined();

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EMAIL_FAILED',
        metadata: expect.objectContaining({
          to: 'r***@example.com',
          error: 'SMTP unavailable',
        }),
      }),
    );
    expect(service.getReadiness()).toEqual({ status: 'up' });
  });
});

function createService(
  values: Record<string, unknown>,
  audit = { log: jest.fn().mockResolvedValue(undefined) },
): EmailService {
  const config = {
    get: jest.fn((key: string) => values[key]),
  };
  return new EmailService(
    config as unknown as ConfigService,
    audit as unknown as AuditService,
  );
}

function smtpConfig(): Record<string, unknown> {
  return {
    'email.from': 'staging@example.com',
    'email.fromName': 'Staging',
    'email.smtp.host': 'smtp.example.com',
    'email.smtp.port': 587,
    'email.smtp.user': 'smtp-user',
    'email.smtp.password': 'smtp-password',
    'email.smtp.secure': false,
    'email.smtp.requireTls': true,
  };
}

function mockTransport(sendMail: jest.Mock): void {
  (
    createTransport as jest.MockedFunction<typeof createTransport>
  ).mockReturnValue({ sendMail } as unknown as Transporter);
}

function passwordResetParams() {
  return {
    type: 'password-reset' as const,
    to: 'recipient@example.com',
    payload: {
      userName: 'Staging User',
      resetUrl: 'https://staging.example.com/reset-password?token=test-token',
      expiresInHours: 1,
    },
    auditContext: { tenantId: 'tenant-id', userId: 'user-id' },
  };
}
