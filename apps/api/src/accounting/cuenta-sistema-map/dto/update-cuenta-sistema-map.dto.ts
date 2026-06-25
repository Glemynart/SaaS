import { IsString, IsOptional, IsBoolean } from 'class-validator';

// El `rol` es la clave del mapeo y no se edita: para reasignar, cambia cuentaId.
export class UpdateCuentaSistemaMapDto {
  @IsString()
  @IsOptional()
  cuentaId?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
