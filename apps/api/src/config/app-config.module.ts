import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
  ],
})
export class AppConfigModule implements OnModuleInit {
  private readonly logger = new Logger(AppConfigModule.name);

  onModuleInit() {
    const required = ['DATABASE_URL', 'JWT_SECRET', 'AUDIT_LOG_SIGNING_KEY'];
    for (const key of required) {
      if (!process.env[key]) {
        const msg = `FATAL: Variable de entorno ${key} no definida. La aplicación no puede iniciar.`;
        this.logger.error(msg);
        throw new Error(msg);
      }
    }
    const encodedAuditKey = process.env.AUDIT_LOG_SIGNING_KEY!;
    const decodedAuditKey = Buffer.from(encodedAuditKey, 'base64');
    if (
      decodedAuditKey.length < 32 ||
      decodedAuditKey.toString('base64') !== encodedAuditKey
    ) {
      throw new Error(
        'FATAL: AUDIT_LOG_SIGNING_KEY debe ser Base64 canónico de al menos 32 bytes.',
      );
    }
    const auditKeyId = process.env.AUDIT_LOG_SIGNING_KEY_ID ?? 'v1';
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(auditKeyId)) {
      throw new Error('FATAL: AUDIT_LOG_SIGNING_KEY_ID no es válido.');
    }
    if (process.env.JWT_SECRET === 'dev-secret-key-321-go') {
      this.logger.warn(
        'ADVERTENCIA: JWT_SECRET está usando el valor inseguro por defecto.',
      );
    }
    this.logger.log('ConfigModule validado — variables críticas presentes.');
  }
}
