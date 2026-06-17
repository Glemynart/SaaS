import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { ExpedienteDocsController } from './expediente-docs.controller';
import { ExpedienteDocsService } from './expediente-docs.service';

@Module({
  imports: [TenantsModule],
  controllers: [ExpedienteDocsController],
  providers: [ExpedienteDocsService],
  exports: [ExpedienteDocsService],
})
export class ExpedienteDocsModule {}
