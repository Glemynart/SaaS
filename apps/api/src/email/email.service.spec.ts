import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { AuditService } from '../audit/audit.service';
import { EmailService } from './email.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

type SentMailInput = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

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
    const sendMail = jest
      .fn<Promise<void>, [SentMailInput]>()
      .mockResolvedValue(undefined);
    mockTransport(sendMail);
    const service = createService(smtpConfig());

    service.onModuleInit();
    await expect(service.send(passwordResetParams())).resolves.toBe('sent');

    const sentMail = sendMail.mock.calls[0]?.[0];
    expect(sentMail?.subject).toBe('Restablece tu contraseña');
    expect(sentMail?.html).toContain('Restablecer contraseña');
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Staging <staging@example.com>',
        to: 'recipient@example.com',
      }),
    );
  });

  it('does not log recovery URLs or complete recipients in degraded mode', async () => {
    const recipient = 'recovery-user@example.invalid';
    const resetUrl =
      'https://staging.example.invalid/reset-password?token=RESET_TOKEN_SENTINEL';
    const params = passwordResetParams();
    params.to = recipient;
    params.payload.resetUrl = resetUrl;

    const service = createService({});
    const logger = { log: jest.fn(), error: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });

    service.onModuleInit();
    await expect(service.send(params)).resolves.toBe('degraded');

    const logs = JSON.stringify([
      logger.log.mock.calls,
      logger.error.mock.calls,
    ]);
    expect(logs).toContain('type=password-reset');
    expect(logs).toContain('to=r***@example.invalid');
    expect(logs).not.toContain(recipient);
    expect(logs).not.toContain(resetUrl);
    expect(logs).not.toContain('RESET_TOKEN_SENTINEL');
  });

  it('audits SMTP failures without throwing or degrading readiness', async () => {
    const recipient = 'recovery-user@example.invalid';
    const resetUrl =
      'https://staging.example.invalid/reset-password?token=RESET_TOKEN_SENTINEL';
    const sensitiveError =
      'SMTP_ERROR_SENTINEL recipient=' + recipient + ' url=' + resetUrl;
    const sendMail = jest.fn().mockRejectedValue(new Error(sensitiveError));
    mockTransport(sendMail);
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = createService(smtpConfig(), audit);
    const logger = { log: jest.fn(), error: jest.fn() };
    Object.defineProperty(service, 'logger', { value: logger });

    service.onModuleInit();
    const params = passwordResetParams();
    params.to = recipient;
    params.payload.resetUrl = resetUrl;
    await expect(service.send(params)).resolves.toBe('failed');

    const logs = JSON.stringify([
      logger.log.mock.calls,
      logger.error.mock.calls,
    ]);
    const auditRecords = JSON.stringify(audit.log.mock.calls);
    const recordedOutput = logs + auditRecords;

    expect(logs).toContain('category=SMTP_SEND_FAILED');
    expect(logs).toContain('to=r***@example.invalid');
    expect(recordedOutput).not.toContain(recipient);
    expect(recordedOutput).not.toContain(resetUrl);
    expect(recordedOutput).not.toContain('RESET_TOKEN_SENTINEL');
    expect(recordedOutput).not.toContain('SMTP_ERROR_SENTINEL');
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(auditRecords).toContain('"action":"EMAIL_FAILED"');
    expect(auditRecords).toContain('"to":"r***@example.invalid"');
    expect(auditRecords).toContain('"category":"SMTP_SEND_FAILED"');
    expect(auditRecords).not.toContain('"error"');
    expect(service.getReadiness()).toEqual({ status: 'up' });
  });

  it('sends escaped invitation details and a one-time link', async () => {
    const sendMail = jest
      .fn<Promise<void>, [SentMailInput]>()
      .mockResolvedValue(undefined);
    mockTransport(sendMail);
    const service = createService(smtpConfig());

    service.onModuleInit();
    await expect(
      service.send({
        type: 'user-invitation',
        to: 'new-user@example.com',
        payload: {
          userName: '<Ana>',
          tenantName: 'Colegio & Asociados',
          tenantNit: '900123456',
          roleName: 'Operador',
          invitationUrl: 'https://app.example.com/aceptar?token=secret',
          expiresInDays: 7,
        },
        auditContext: { tenantId: 'tenant-id', userId: 'admin-id' },
      }),
    ).resolves.toBe('sent');

    const sentMail = sendMail.mock.calls[0]?.[0];
    expect(sentMail?.subject).toBe('Invitación a La Oficina Nítida');
    expect(sentMail?.html).toContain('&lt;Ana&gt;');
    expect(sentMail?.html).toContain('Colegio &amp; Asociados');
    expect(sentMail?.html).toContain('900123456');
    expect(sentMail?.html).toContain('Aceptar invitación');
    expect(sentMail?.html).not.toContain('<Ana>');
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
  const transport = { sendMail } as unknown as ReturnType<
    typeof createTransport
  >;
  (
    createTransport as jest.MockedFunction<typeof createTransport>
  ).mockReturnValue(transport);
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
