import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateCuentaSistemaMapDto {
  @IsString()
  @IsNotEmpty()
  rol: string; // código de rol estable, p. ej. 'IVA_GENERADO'

  @IsString()
  @IsNotEmpty()
  cuentaId: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
