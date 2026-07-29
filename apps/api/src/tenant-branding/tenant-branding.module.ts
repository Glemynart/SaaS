import { Module } from '@nestjs/common';
import { PublicLogoController } from './public-logo.controller';
import { TenantBrandingController } from './tenant-branding.controller';
import { TenantBrandingService } from './tenant-branding.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [TenantBrandingController, PublicLogoController],
  providers: [TenantBrandingService],
})
export class TenantBrandingModule {}
