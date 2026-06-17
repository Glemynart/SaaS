import { Module } from '@nestjs/common';
import { GeneratedDocumentsController } from './generated-documents.controller';
import { GeneratedDocumentsService } from './generated-documents.service';
import { TenantsModule } from '../tenants/tenants.module';
import { EmployeeFilesModule } from '../employee-files/employee-files.module';
import { ExpedienteDocsModule } from '../expediente-docs/expediente-docs.module';

@Module({
  imports: [TenantsModule, EmployeeFilesModule, ExpedienteDocsModule],
  controllers: [GeneratedDocumentsController],
  providers: [GeneratedDocumentsService],
  exports: [GeneratedDocumentsService],
})
export class GeneratedDocumentsModule {}
