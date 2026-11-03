import { Module } from '@nestjs/common';
import { EmployeeImportController } from './employee-import.controller';
import { EmployeeImportService } from './employee-import.service';
import { TenantsModule } from '../tenants/tenants.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [TenantsModule, EmployeesModule],
  controllers: [EmployeeImportController],
  providers: [EmployeeImportService],
})
export class EmployeeImportModule {}
