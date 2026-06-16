import { Module } from '@nestjs/common';
import { DaneService } from './dane.service';
import { DaneController } from './dane.controller';

@Module({
  controllers: [DaneController],
  providers: [DaneService],
})
export class DaneModule {}
