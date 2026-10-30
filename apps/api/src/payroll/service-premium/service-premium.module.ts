import { Module } from '@nestjs/common';
import { ExpedienteDocsModule } from '../../expediente-docs/expediente-docs.module';
import { PdfRenderModule } from '../../pdf-render/pdf-render.module';
import { StorageModule } from '../../storage/storage.module';
import { ServicePremiumController } from './service-premium.controller';
import { ServicePremiumService } from './service-premium.service';

@Module({
  imports: [ExpedienteDocsModule, PdfRenderModule, StorageModule],
  controllers: [ServicePremiumController],
  providers: [ServicePremiumService],
  exports: [ServicePremiumService],
})
export class ServicePremiumModule {}
