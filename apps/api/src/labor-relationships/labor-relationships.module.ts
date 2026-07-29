import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { LaborRelationshipsController } from './labor-relationships.controller';
import { LaborRelationshipsService } from './labor-relationships.service';

@Module({
  imports: [TenantsModule],
  controllers: [LaborRelationshipsController],
  providers: [LaborRelationshipsService],
  exports: [LaborRelationshipsService],
})
export class LaborRelationshipsModule {}
