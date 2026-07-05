import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { AuditService } from '../audit/audit.service';
import { passwordResetTemplate } from './templates/password-reset.template';

export type EmailType = 'password-reset';

export interface PasswordResetPayload {
  userName: string;
  resetUrl: string;
  expiresInHours: number;
}

type EmailPayloadMap = {
  'password-reset': PasswordResetPayload;
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
  private resend: Resend | null = null;
  private from: string = 'noreply@laoficinafina.com';
  private fromName: string = 'La Oficina Nítida';
  private degraded = false;

  constructor(
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    const apiKey = this.config.get<string>('email.apiKey');
    const from = this.config.get<string>('email.from');
    const fromName = this.config.get<string>('email.fromName');

    if (fromName) this.fromName = fromName;
    if (from) this.from = from;

    if (!apiKey) {
      this.logger.error(
        'RESEND_API_KEY no está definida. EmailService operará en modo degradado (console.log). Configura la variable de entorno para enviar correos reales.',
      );
      this.degraded = true;
      return;
    }

    if (!from) {
      this.logger.error(
        'EMAIL_FROM no está definida. EmailService operará en modo degradado. Configura la variable de entorno para enviar correos reales.',
      );
      this.degraded = true;
      return;
    }

    this.resend = new Resend(apiKey);
    this.logger.log(`EmailService listo — from: ${this.from}`);
  }

  async send<T extends EmailType>(params: SendParams<T>): Promise<void> {
    const { type, to, payload, auditContext } = params;

    const subject = this.resolveSubject(type);
    const html = this.buildHtml(type, payload);

    if (this.degraded || !this.resend) {
      this.logger.log(
        `[EMAIL DEGRADADO] type=${type} to=${to} subject="${subject}"`,
      );
      if (type === 'password-reset') {
        const p = payload;
        this.logger.log(`[EMAIL DEGRADADO] resetUrl=${p.resetUrl}`);
      }
      return;
    }

    try {
      await this.resend.emails.send({
        from: `${this.fromName} <${this.from}>`,
        to,
        subject,
        html,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`EMAIL_FAILED type=${type} to=${to} error=${message}`);

      await this.audit
        .log({
          tenantId: auditContext.tenantId,
          userId: auditContext.userId,
          action: 'EMAIL_FAILED',
          entityType: 'Email',
          metadata: {
            type,
            to: this.obfuscate(to),
            error: message,
          },
        })
        .catch(() => {});
    }
  }

  private resolveSubject(type: EmailType): string {
    const subjects: Record<EmailType, string> = {
      'password-reset': 'Restablece tu contraseña',
    };
    return subjects[type];
  }

  private buildHtml(
    type: EmailType,
    payload: EmailPayloadMap[EmailType],
  ): string {
    if (type === 'password-reset') {
      const p = payload;
      return passwordResetTemplate({
        userName: p.userName,
        resetUrl: p.resetUrl,
        expiresInHours: p.expiresInHours,
        fromName: this.fromName,
      });
    }
    return '';
  }

  private obfuscate(email: string): string {
    return email.replace(/^(.).*?(@.*)$/, '$1***$2');
  }
}
