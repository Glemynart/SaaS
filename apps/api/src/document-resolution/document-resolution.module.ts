import { Module } from '@nestjs/common';
import { DocumentResolutionController } from './document-resolution.controller';
import { DocumentResolutionService } from './document-resolution.service';

@Module({
  controllers: [DocumentResolutionController],
  providers: [DocumentResolutionService],
})
export class DocumentResolutionModule {}
