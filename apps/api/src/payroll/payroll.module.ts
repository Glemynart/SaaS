import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { LiquidationController } from './liquidation/liquidation.controller';
import { PayrollService } from './payroll.service';
import { LiquidationService } from './liquidation/liquidation.service';
import { TenantsModule } from '../tenants/tenants.module';
import { AccountingModule } from '../accounting/accounting.module';
import { PayrollAccountingPreflightService } from './accounting-preflight/payroll-accounting-preflight.service';
import { PayrollCorrectionAccountingService } from './accounting/payroll-correction-accounting.service';
import { ServicePremiumModule } from './service-premium/service-premium.module';
import { PilaExportController } from './pila-export.controller';
import { PilaExportService } from './pila-export.service';

@Module({
  imports: [TenantsModule, AccountingModule, ServicePremiumModule],
  controllers: [PayrollController, LiquidationController, PilaExportController],
  providers: [
    PayrollService,
    LiquidationService,
    PayrollAccountingPreflightService,
    PayrollCorrectionAccountingService,
    PilaExportService,
  ],
})
export class PayrollModule {}
