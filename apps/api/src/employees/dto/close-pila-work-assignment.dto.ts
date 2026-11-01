import { IsDateString } from 'class-validator';

export class ClosePilaWorkAssignmentDto {
  @IsDateString({ strict: true })
  vigenteHasta: string;
}
