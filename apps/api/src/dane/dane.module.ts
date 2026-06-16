import { Module } from '@nestjs/common';
import { DaneService } from './dane.service';
import { DaneController } from './dane.controller';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [DaneController],
  providers: [DaneService],
})
export class DaneModule {}
