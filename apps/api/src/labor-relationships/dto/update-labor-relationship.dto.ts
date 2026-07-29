import { IsBoolean, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class UpdateLaborRelationshipDto {
  @IsUUID()
  @IsOptional()
  perfilContractualId?: string;

  @IsDateString()
  @IsOptional()
  vigenteDesde?: string;

  @IsDateString()
  @IsOptional()
  vigenteHasta?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
