import { Module } from '@nestjs/common';
import { ContractualProfilesController } from './contractual-profiles.controller';
import { ContractualProfilesService } from './contractual-profiles.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [ContractualProfilesController],
  providers: [ContractualProfilesService],
})
export class ContractualProfilesModule {}
