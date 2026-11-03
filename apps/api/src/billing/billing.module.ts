import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { TenantsModule } from '../tenants/tenants.module';
import { AccountingModule } from '../accounting/accounting.module';
import { CustomerReceiptsController } from './customer-receipts.controller';
import { CustomerReceiptsService } from './customer-receipts.service';

@Module({
  imports: [TenantsModule, AccountingModule],
  controllers: [BillingController, CustomerReceiptsController],
  providers: [BillingService, CustomerReceiptsService],
})
export class BillingModule {}
