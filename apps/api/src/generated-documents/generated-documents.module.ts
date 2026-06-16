import { Module } from '@nestjs/common';
import { GeneratedDocumentsController } from './generated-documents.controller';
import { GeneratedDocumentsService } from './generated-documents.service';
import { TenantsModule } from '../tenants/tenants.module';
import { EmployeeFilesModule } from '../employee-files/employee-files.module';

@Module({
  imports: [TenantsModule, EmployeeFilesModule],
  controllers: [GeneratedDocumentsController],
  providers: [GeneratedDocumentsService],
  exports: [GeneratedDocumentsService],
})
export class GeneratedDocumentsModule {}
