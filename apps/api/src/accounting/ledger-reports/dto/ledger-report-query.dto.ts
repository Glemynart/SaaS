import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class DateRangeQueryDto {
  @IsDateString()
  @IsOptional()
  fechaInicio?: string;

  @IsDateString()
  @IsOptional()
  fechaFin?: string;
}

export class PaginationQueryDto extends DateRangeQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}

export class LibroDiarioQueryDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  tipoComprobanteId?: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  incluirBorradores?: boolean;
}

export class LibroMayorQueryDto extends PaginationQueryDto {
  @IsString()
  @IsNotEmpty()
  cuentaId: string;
}

export class BalancePruebaQueryDto extends DateRangeQueryDto {
  @IsString()
  @IsOptional()
  cuentaDesde?: string;

  @IsString()
  @IsOptional()
  cuentaHasta?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  nivel?: number;
}

export class AuxiliarTerceroQueryDto extends LibroMayorQueryDto {
  @IsString()
  @IsNotEmpty()
  terceroId: string;
}

export class AuxiliarCentroCostoQueryDto extends LibroMayorQueryDto {
  @IsString()
  @IsNotEmpty()
  centroCostoId: string;
}
