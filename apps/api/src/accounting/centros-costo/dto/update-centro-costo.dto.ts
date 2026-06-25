import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateCentroCostoDto {
  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  sedeId?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
