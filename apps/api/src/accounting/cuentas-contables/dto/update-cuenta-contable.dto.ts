import { IsString, IsOptional, IsBoolean } from 'class-validator';

// Solo se permiten cambios "blandos". codigo, claseContable, naturaleza, nivel y
// cuentaPadreId NO se editan tras crear la cuenta (estabilidad del árbol PUC).
export class UpdateCuentaContableDto {
  @IsString()
  @IsOptional()
  nombre?: string;

  @IsBoolean()
  @IsOptional()
  imputable?: boolean;

  @IsBoolean()
  @IsOptional()
  requiereTercero?: boolean;

  @IsBoolean()
  @IsOptional()
  requiereCentroCosto?: boolean;

  @IsBoolean()
  @IsOptional()
  requiereBase?: boolean;

  @IsBoolean()
  @IsOptional()
  activa?: boolean;
}
