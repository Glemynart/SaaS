import { IsBoolean, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateLaborRelationshipDto {
  @IsUUID()
  empleadoId: string;

  @IsUUID()
  perfilContractualId: string;

  @IsDateString()
  vigenteDesde: string;

  @IsDateString()
  @IsOptional()
  vigenteHasta?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
