import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetService reset link delivery', () => {
  it('puts new reset tokens in a URL fragment and keeps the generic response', async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          nit: '900123456',
          activo: true,
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          tenantId: 'tenant-1',
          email: 'admin@example.test',
          nombre: 'Ada',
          apellido: 'Lovelace',
          activo: true,
        }),
      },
      passwordResetToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'reset-token-id' }),
      },
    };
    let sentResetUrl: string | undefined;
    const sendEmail = jest.fn((params: { payload: { resetUrl: string } }) => {
      sentResetUrl = params.payload.resetUrl;
      return Promise.resolve();
    });
    const auditLog = jest.fn().mockResolvedValue(undefined);
    const service = new PasswordResetService(
      prisma as unknown as PrismaService,
      {
        get: jest.fn().mockReturnValue('https://staging.example.test'),
      } as unknown as ConfigService,
      { log: auditLog } as unknown as AuditService,
      { send: sendEmail } as unknown as EmailService,
    );

    const result = await service.requestReset({
      tenantNit: '900123456',
      email: 'admin@example.test',
    });

    expect(result.message).toBe(
      'Si el correo existe, recibirás instrucciones para restablecer tu contraseña.',
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sentResetUrl).toBeDefined();
    if (!sentResetUrl) throw new Error('Reset email was not sent');

    const resetUrl = new URL(sentResetUrl);
    expect(resetUrl.pathname).toBe('/restablecer');
    expect(resetUrl.searchParams.has('token')).toBe(false);

    const token = new URLSearchParams(resetUrl.hash.slice(1)).get('token');
    expect(token).toBeTruthy();
    if (!token) throw new Error('Reset token is missing from the URL fragment');
    expect(Buffer.from(token, 'base64').toString('utf8')).toMatch(
      /^reset-token-id:/,
    );
  });
});
