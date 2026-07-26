import { IsNotEmpty, IsString } from 'class-validator';

export class VoidManualJournalDto {
  @IsString()
  @IsNotEmpty()
  motivo: string;
}
