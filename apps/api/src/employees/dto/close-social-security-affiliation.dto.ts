import { IsDateString, Matches } from 'class-validator';

export class CloseSocialSecurityAffiliationDto {
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  vigenteHasta: string;
}
