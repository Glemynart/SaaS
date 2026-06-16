import { Module } from '@nestjs/common';
import { DaneService } from './dane.service';

@Module({
  providers: [DaneService],
})
export class DaneModule {}
