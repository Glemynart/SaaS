import { Module } from '@nestjs/common';
import { EmployeeFilesController } from './employee-files.controller';
import { EmployeeFilesService } from './employee-files.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [EmployeeFilesController],
  providers: [EmployeeFilesService],
  exports: [EmployeeFilesService],
})
export class EmployeeFilesModule {}
