import { Global, Module } from '@nestjs/common';
import { PdfRenderService } from './pdf-render.service';

@Global()
@Module({
  providers: [PdfRenderService],
  exports: [PdfRenderService],
})
export class PdfRenderModule {}
