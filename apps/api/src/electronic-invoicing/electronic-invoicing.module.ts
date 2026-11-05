import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TenantsModule } from '../tenants/tenants.module';
import { ElectronicInvoiceConfigurationController } from './electronic-invoice-configuration.controller';
import { ElectronicInvoiceConfigurationService } from './electronic-invoice-configuration.service';
import { ElectronicInvoiceTransmissionService } from './electronic-invoice-transmission.service';

@Module({
  imports: [AuditModule, TenantsModule],
  controllers: [ElectronicInvoiceConfigurationController],
  providers: [
    ElectronicInvoiceConfigurationService,
    ElectronicInvoiceTransmissionService,
  ],
  exports: [
    ElectronicInvoiceConfigurationService,
    ElectronicInvoiceTransmissionService,
  ],
})
export class ElectronicInvoicingModule {}
