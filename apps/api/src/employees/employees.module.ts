import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { TenantsModule } from '../tenants/tenants.module';
import { SocialSecurityAffiliationsService } from './social-security-affiliations.service';
import { PilaWorkCentersController } from './pila-work-centers.controller';
import { PilaWorkCentersService } from './pila-work-centers.service';

@Module({
  imports: [TenantsModule],
  controllers: [EmployeesController, PilaWorkCentersController],
  providers: [
    EmployeesService,
    SocialSecurityAffiliationsService,
    PilaWorkCentersService,
  ],
  exports: [EmployeesService],
})
export class EmployeesModule {}
