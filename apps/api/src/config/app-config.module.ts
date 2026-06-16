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
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    for (const key of required) {
      if (!process.env[key]) {
        const msg = `FATAL: Variable de entorno ${key} no definida. La aplicación no puede iniciar.`;
        this.logger.error(msg);
        throw new Error(msg);
      }
    }
    if (process.env.JWT_SECRET === 'dev-secret-key-321-go') {
      this.logger.warn(
        'ADVERTENCIA: JWT_SECRET está usando el valor inseguro por defecto.',
      );
    }
    this.logger.log('ConfigModule validado — variables críticas presentes.');
  }
}
