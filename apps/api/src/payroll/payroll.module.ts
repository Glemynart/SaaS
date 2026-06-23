import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { LiquidationController } from './liquidation/liquidation.controller';
import { PayrollService } from './payroll.service';
import { LiquidationService } from './liquidation/liquidation.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [PayrollController, LiquidationController],
  providers: [PayrollService, LiquidationService],
})
export class PayrollModule {}
