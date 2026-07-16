import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { TenantPrismaService } from './tenant-prisma.service';

@Global()
@Module({
  imports: [PrismaModule, TenantContextModule],
  providers: [TenantPrismaService],
  exports: [TenantPrismaService],
})
export class TenantPrismaModule {}
