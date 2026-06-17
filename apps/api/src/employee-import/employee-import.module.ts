import { Module } from '@nestjs/common';
import { EmployeeImportController } from './employee-import.controller';
import { EmployeeImportService } from './employee-import.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [EmployeeImportController],
  providers: [EmployeeImportService],
})
export class EmployeeImportModule {}
