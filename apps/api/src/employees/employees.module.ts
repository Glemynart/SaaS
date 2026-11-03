import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { TenantsModule } from '../tenants/tenants.module';
import { SocialSecurityAffiliationsService } from './social-security-affiliations.service';
import { PilaWorkCentersController } from './pila-work-centers.controller';
import { PilaWorkCentersService } from './pila-work-centers.service';
import { PilaWorkLocationsController } from './pila-work-locations.controller';
import { PilaWorkLocationsService } from './pila-work-locations.service';

@Module({
  imports: [TenantsModule],
  controllers: [
    EmployeesController,
    PilaWorkCentersController,
    PilaWorkLocationsController,
  ],
  providers: [
    EmployeesService,
    SocialSecurityAffiliationsService,
    PilaWorkCentersService,
    PilaWorkLocationsService,
  ],
  exports: [
    EmployeesService,
    SocialSecurityAffiliationsService,
    PilaWorkCentersService,
    PilaWorkLocationsService,
  ],
})
export class EmployeesModule {}
