import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { DocumentProfileConfigurationsController } from './document-profile-configurations.controller';
import { DocumentProfileConfigurationsService } from './document-profile-configurations.service';

@Module({
  imports: [TenantsModule],
  controllers: [DocumentProfileConfigurationsController],
  providers: [DocumentProfileConfigurationsService],
})
export class DocumentProfileConfigurationsModule {}
