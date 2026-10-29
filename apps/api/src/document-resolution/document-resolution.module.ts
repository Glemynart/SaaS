import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { DocumentResolutionController } from './document-resolution.controller';
import { DocumentResolutionService } from './document-resolution.service';

@Module({
  imports: [TenantsModule],
  controllers: [DocumentResolutionController],
  providers: [DocumentResolutionService],
})
export class DocumentResolutionModule {}
