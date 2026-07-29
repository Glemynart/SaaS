import { IsBoolean, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class UpdateDocumentProfileConfigurationDto {
  @IsUUID()
  @IsOptional()
  plantillaId?: string;

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
