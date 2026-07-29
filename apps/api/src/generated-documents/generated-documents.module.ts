import { Module } from '@nestjs/common';
import { GeneratedDocumentsController } from './generated-documents.controller';
import { GeneratedDocumentsService } from './generated-documents.service';
import { GeneratedDocumentAccessService } from './generated-document-access.service';
import { TenantsModule } from '../tenants/tenants.module';
import { ExpedienteDocsModule } from '../expediente-docs/expediente-docs.module';

@Module({
  imports: [TenantsModule, ExpedienteDocsModule],
  controllers: [GeneratedDocumentsController],
  providers: [GeneratedDocumentsService, GeneratedDocumentAccessService],
  exports: [GeneratedDocumentsService],
})
export class GeneratedDocumentsModule {}
