import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { TenantsModule } from '../tenants/tenants.module';
import { SocialSecurityAffiliationsService } from './social-security-affiliations.service';

@Module({
  imports: [TenantsModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, SocialSecurityAffiliationsService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
