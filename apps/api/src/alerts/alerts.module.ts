import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsSchedulerService } from './alerts-scheduler.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsSchedulerService],
  exports: [AlertsService],
})
export class AlertsModule {}
