import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { TenantsModule } from '../tenants/tenants.module';
import { GeneratedDocumentsModule } from '../generated-documents/generated-documents.module';

@Module({
  imports: [TenantsModule, GeneratedDocumentsModule],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
