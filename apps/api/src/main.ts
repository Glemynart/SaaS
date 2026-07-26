import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { activateDenyByDefault } from './auth/authorization/deny-by-default.activation';
import { applySecurityHeaders } from './security/security-headers';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  applySecurityHeaders(app);
  activateDenyByDefault(app, AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useStaticAssets(join(process.cwd(), '..', '..', 'uploads'), {
    prefix: '/uploads/',
  });

  const origins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim());

  app.enableCors({
    origin: origins,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
