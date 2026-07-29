import { Module } from '@nestjs/common';
import { BatchDocumentGenerationService } from './batch-document-generation.service';

@Module({
  providers: [BatchDocumentGenerationService],
  exports: [BatchDocumentGenerationService],
})
export class BatchDocumentGenerationModule {}
