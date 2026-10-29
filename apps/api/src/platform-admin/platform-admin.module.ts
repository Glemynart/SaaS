import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformS2sGuard } from './guards/platform-s2s.guard';
import { PlatformTenantsController } from './tenants/platform-tenants.controller';
import { PlatformTenantsService } from './tenants/platform-tenants.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), PrismaModule],
  controllers: [PlatformTenantsController],
  providers: [PlatformS2sGuard, PlatformTenantsService],
})
export class PlatformAdminModule {}
