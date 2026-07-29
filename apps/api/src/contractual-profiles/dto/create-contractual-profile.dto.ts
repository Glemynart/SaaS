import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateContractualProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  codigo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nombre: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  descripcion?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
