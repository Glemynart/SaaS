import { IsDateString } from 'class-validator';

export class ClosePilaWorkLocationDto {
  @IsDateString({ strict: true })
  vigenteHasta: string;
}
