import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TenantsModule } from '../tenants/tenants.module';
import { ElectronicInvoiceConfigurationController } from './electronic-invoice-configuration.controller';
import { ElectronicInvoiceConfigurationService } from './electronic-invoice-configuration.service';

@Module({
  imports: [AuditModule, TenantsModule],
  controllers: [ElectronicInvoiceConfigurationController],
  providers: [ElectronicInvoiceConfigurationService],
  exports: [ElectronicInvoiceConfigurationService],
})
export class ElectronicInvoicingModule {}
