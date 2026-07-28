import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { TenantsModule } from '../tenants/tenants.module';
import { GeneratedDocumentsModule } from '../generated-documents/generated-documents.module';
import { ExpedienteDocsModule } from '../expediente-docs/expediente-docs.module';

@Module({
  imports: [TenantsModule, GeneratedDocumentsModule, ExpedienteDocsModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
