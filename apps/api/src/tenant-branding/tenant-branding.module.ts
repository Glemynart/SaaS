import { Module } from '@nestjs/common';
import { TenantBrandingController } from './tenant-branding.controller';
import { TenantBrandingService } from './tenant-branding.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [TenantBrandingController],
  providers: [TenantBrandingService],
})
export class TenantBrandingModule {}
