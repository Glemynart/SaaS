import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateSedeDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  municipioId: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
