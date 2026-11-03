import { Module } from '@nestjs/common';
import { EmployeeImportController } from './employee-import.controller';
import { EmployeeImportService } from './employee-import.service';
import { TenantsModule } from '../tenants/tenants.module';
import { EmployeesModule } from '../employees/employees.module';
import { PilaWorkLocationImportService } from './pila-work-location-import.service';
import { PilaWorkAssignmentImportService } from './pila-work-assignment-import.service';

@Module({
  imports: [TenantsModule, EmployeesModule],
  controllers: [EmployeeImportController],
  providers: [
    EmployeeImportService,
    PilaWorkLocationImportService,
    PilaWorkAssignmentImportService,
  ],
})
export class EmployeeImportModule {}
