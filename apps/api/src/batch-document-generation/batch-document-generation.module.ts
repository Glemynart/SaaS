import { Module } from '@nestjs/common';
import { ExpedienteDocsModule } from '../expediente-docs/expediente-docs.module';
import { BatchDocumentGenerationService } from './batch-document-generation.service';

@Module({
  imports: [ExpedienteDocsModule],
  providers: [BatchDocumentGenerationService],
  exports: [BatchDocumentGenerationService],
})
export class BatchDocumentGenerationModule {}
