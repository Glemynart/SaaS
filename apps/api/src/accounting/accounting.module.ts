import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';

import { CuentasContablesController } from './cuentas-contables/cuentas-contables.controller';
import { CuentasContablesService } from './cuentas-contables/cuentas-contables.service';
import { TercerosController } from './terceros/terceros.controller';
import { TercerosService } from './terceros/terceros.service';
import { PeriodosContablesController } from './periodos-contables/periodos-contables.controller';
import { PeriodosContablesService } from './periodos-contables/periodos-contables.service';
import { CentrosCostoController } from './centros-costo/centros-costo.controller';
import { CentrosCostoService } from './centros-costo/centros-costo.service';
import { CuentaSistemaMapController } from './cuenta-sistema-map/cuenta-sistema-map.controller';
import { CuentaSistemaMapService } from './cuenta-sistema-map/cuenta-sistema-map.service';
import { TiposComprobanteController } from './tipos-comprobante/tipos-comprobante.controller';
import { TiposComprobanteService } from './tipos-comprobante/tipos-comprobante.service';
import { AccountingProvisioningController } from './provisioning/accounting-provisioning.controller';
import { AccountingProvisioningService } from './provisioning/accounting-provisioning.service';
import { LedgerService } from './ledger/ledger.service';
import { ReportingService } from './reporting/reporting.service';

// Motor contable ADR-001 · Fase C1.1 — C0 catálogos + C1 Ledger Core.
@Module({
  imports: [TenantsModule],
  controllers: [
    CuentasContablesController,
    TercerosController,
    PeriodosContablesController,
    CentrosCostoController,
    CuentaSistemaMapController,
    TiposComprobanteController,
    AccountingProvisioningController,
  ],
  providers: [
    CuentasContablesService,
    TercerosService,
    PeriodosContablesService,
    CentrosCostoService,
    CuentaSistemaMapService,
    TiposComprobanteService,
    AccountingProvisioningService,
    LedgerService,
    ReportingService,
  ],
  exports: [AccountingProvisioningService, LedgerService],
})
export class AccountingModule {}
