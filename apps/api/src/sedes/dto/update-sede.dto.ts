import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateSedeDto {
  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  municipioId?: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
