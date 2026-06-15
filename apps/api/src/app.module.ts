import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    PrismaModule,
    TenantsModule,
    UsersModule,
    AuthModule,
    ThrottlerModule.forRoot([
      {
        name: 'login',
        ttl: 60000,
        limit: 5,
      },
      {
        name: 'register',
        ttl: 60000,
        limit: 3,
      },
      {
        name: 'refresh',
        ttl: 60000,
        limit: 10,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
