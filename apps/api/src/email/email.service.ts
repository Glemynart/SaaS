import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { AuditService } from '../audit/audit.service';
import { passwordResetTemplate } from './templates/password-reset.template';
import { userInvitationTemplate } from './templates/user-invitation.template';

export type EmailType = 'password-reset' | 'user-invitation';
export type EmailDeliveryStatus = 'sent' | 'degraded' | 'failed';

const SMTP_SEND_FAILURE_CATEGORY = 'SMTP_SEND_FAILED';

export interface EmailReadiness {
  status: 'up' | 'degraded';
}

export interface PasswordResetPayload {
  userName: string;
  resetUrl: string;
  expiresInHours: number;
}

export interface UserInvitationPayload {
  userName: string;
  tenantName: string;
  tenantNit: string;
  roleName: string;
  invitationUrl: string;
  expiresInDays: number;
}

type EmailPayloadMap = {
  'password-reset': PasswordResetPayload;
  'user-invitation': UserInvitationPayload;
};

interface SendParams<T extends EmailType> {
  type: T;
  to: string;
  payload: EmailPayloadMap[T];
  auditContext: {
    tenantId: string;
    userId: string;
  };
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private from: string = 'noreply@laoficinafina.com';
  private fromName: string = 'La Oficina Nítida';
  private degraded = false;

  constructor(
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    const from = this.config.get<string>('email.from');
    const fromName = this.config.get<string>('email.fromName');
    const smtpHost = this.config.get<string>('email.smtp.host');
    const smtpPort = this.config.get<number>('email.smtp.port');
    const smtpUser = this.config.get<string>('email.smtp.user');
    const smtpPassword = this.config.get<string>('email.smtp.password');
    const smtpSecure = this.config.get<boolean>('email.smtp.secure');
    const smtpRequireTls = this.config.get<boolean>('email.smtp.requireTls');

    if (fromName) this.fromName = fromName;
    if (from) this.from = from;

    if (
      !from ||
      !smtpHost ||
      !smtpPort ||
      !smtpUser ||
      !smtpPassword ||
      smtpSecure === undefined ||
      smtpRequireTls === undefined
    ) {
      this.logger.error(
        'Configuración SMTP incompleta. EmailService operará en modo degradado. Configura las variables SMTP y EMAIL_FROM para enviar correos reales.',
      );
      this.degraded = true;
      return;
    }

    if (smtpSecure !== true && smtpRequireTls !== true) {
      this.logger.error(
        'Configuración SMTP insegura. Se requiere TLS implícito o STARTTLS obligatorio; EmailService operará en modo degradado.',
      );
      this.degraded = true;
      return;
    }

    this.transporter = createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      requireTLS: smtpRequireTls,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: { minVersion: 'TLSv1.2' },
    });
    this.logger.log(`EmailService listo — from: ${this.from}`);
  }

  async send<T extends EmailType>(
    params: SendParams<T>,
  ): Promise<EmailDeliveryStatus> {
    const { type, to, payload, auditContext } = params;

    const subject = this.resolveSubject(type);
    const html = this.buildHtml(type, payload);

    if (this.degraded || !this.transporter) {
      this.logger.log(
        `[EMAIL DEGRADADO] type=${type} to=${this.obfuscate(to)} subject="${subject}"`,
      );
      return 'degraded';
    }

    try {
      await this.transporter.sendMail({
        from: `${this.fromName} <${this.from}>`,
        to,
        subject,
        html,
      });
      return 'sent';
    } catch {
      this.logger.error(
        `EMAIL_FAILED type=${type} to=${this.obfuscate(to)} category=${SMTP_SEND_FAILURE_CATEGORY}`,
      );

      await this.audit
        .log({
          tenantId: auditContext.tenantId,
          userId: auditContext.userId,
          action: 'EMAIL_FAILED',
          entityType: 'Email',
          metadata: {
            type,
            to: this.obfuscate(to),
            category: SMTP_SEND_FAILURE_CATEGORY,
          },
        })
        .catch(() => {});
      return 'failed';
    }
  }

  getReadiness(): EmailReadiness {
    return {
      status: this.transporter && !this.degraded ? 'up' : 'degraded',
    };
  }

  private resolveSubject(type: EmailType): string {
    const subjects: Record<EmailType, string> = {
      'password-reset': 'Restablece tu contraseña',
      'user-invitation': 'Invitación a La Oficina Nítida',
    };
    return subjects[type];
  }

  private buildHtml(
    type: EmailType,
    payload: EmailPayloadMap[EmailType],
  ): string {
    if (type === 'password-reset') {
      const p = payload as PasswordResetPayload;
      return passwordResetTemplate({
        userName: p.userName,
        resetUrl: p.resetUrl,
        expiresInHours: p.expiresInHours,
        fromName: this.fromName,
      });
    }
    if (type === 'user-invitation') {
      const p = payload as UserInvitationPayload;
      return userInvitationTemplate({
        userName: p.userName,
        tenantName: p.tenantName,
        tenantNit: p.tenantNit,
        roleName: p.roleName,
        invitationUrl: p.invitationUrl,
        expiresInDays: p.expiresInDays,
        fromName: this.fromName,
      });
    }
    return '';
  }

  private obfuscate(email: string): string {
    return email.replace(/^(.).*?(@.*)$/, '$1***$2');
  }
}
