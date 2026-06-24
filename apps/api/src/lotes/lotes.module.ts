import { Module } from '@nestjs/common';
import { LoteEngineService } from './lote-engine.service';
import { ContractsModule } from '../contracts/contracts.module';
import { GeneratedDocumentsModule } from '../generated-documents/generated-documents.module';
import { ExpedienteDocsModule } from '../expediente-docs/expediente-docs.module';

/**
 * LotesModule — Generación masiva de contratos (N3A.4B).
 *
 * Fase 1: solo el motor de reconciliación (LoteEngineService).
 * Aún sin controller, ZIP, BullMQ, Redis ni R2.
 */
@Module({
  imports: [ContractsModule, GeneratedDocumentsModule, ExpedienteDocsModule],
  providers: [LoteEngineService],
  exports: [LoteEngineService],
})
export class LotesModule {}
