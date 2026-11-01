import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { TenantsModule } from '../tenants/tenants.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [TenantsModule, AccountingModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
