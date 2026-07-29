import { Module } from '@nestjs/common';
import { LoteEngineService } from './lote-engine.service';
import { LotesService } from './lotes.service';
import { LotesController } from './lotes.controller';
import { ContractsModule } from '../contracts/contracts.module';
import { GeneratedDocumentsModule } from '../generated-documents/generated-documents.module';
import { ExpedienteDocsModule } from '../expediente-docs/expediente-docs.module';
import { TenantsModule } from '../tenants/tenants.module';
import { BatchDocumentGenerationModule } from '../batch-document-generation/batch-document-generation.module';

/**
 * LotesModule — Generación masiva de contratos.
 *
 * N3A.4B: motor de reconciliación (LoteEngineService).
 * N3A.5:  API de lotes (LotesController + LotesService) sobre el motor.
 *
 * Aún sin ZIP, BullMQ, Redis ni R2 (procesamiento síncrono).
 */
@Module({
  imports: [
    ContractsModule,
    GeneratedDocumentsModule,
    ExpedienteDocsModule,
    TenantsModule,
    BatchDocumentGenerationModule,
  ],
  controllers: [LotesController],
  providers: [LoteEngineService, LotesService],
  exports: [LoteEngineService],
})
export class LotesModule {}
