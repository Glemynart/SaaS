import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ClaseContable, NaturalezaContable } from '@prisma/client';

export class CreateCuentaContableDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEnum(ClaseContable)
  claseContable: ClaseContable;

  @IsEnum(NaturalezaContable)
  naturaleza: NaturalezaContable;

  @IsInt()
  @Min(1)
  @Max(5)
  nivel: number;

  @IsString()
  @IsOptional()
  cuentaPadreId?: string;

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

  // esCuentaSistema NO es asignable por API: solo lo fija el seed / clonado.
}
